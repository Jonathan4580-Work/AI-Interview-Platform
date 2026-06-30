import { describe, expect, it } from "vitest";

import { AuditWriter, type AuditEventStore, type PersistedAuditEventInput } from "@/modules/audit";
import { permissionKeys } from "@/modules/access-control";
import {
  EmailProviderError,
  EmailService,
  EmailTemplateError,
  EnvironmentSmtpSecretResolver,
  PreviewEmailProvider,
  getDefaultEmailTemplate,
  renderEmailTemplate,
} from "@/modules/email";
import type {
  EmailDeliveryAttemptRecord,
  EmailDeliveryId,
  EmailDeliveryRecord,
  EmailProvider,
  EmailProviderSendResult,
  EmailRepository,
} from "@/modules/email";
import type { CompanyUserId } from "@/modules/tenant";
import type { TenantContext, TenantId } from "@/modules/tenant";

describe("email template rendering", () => {
  it("escapes untrusted variables in html while preserving plain text", () => {
    const rendered = renderEmailTemplate(getDefaultEmailTemplate("interview_invitation"), {
      companyName: "Acme <script>",
      recipientName: "Ada",
      supportEmail: "help@example.com",
      actionUrl: "https://example.com/interview?token=<unsafe>",
      expirationDate: new Date("2026-07-01T10:30:00.000Z"),
      jobTitle: "Engineer",
      estimatedDuration: "35 minutes",
      interviewWindow: "June 30 to July 1",
    });

    expect(rendered.subject).toContain("Acme <script>");
    expect(rendered.html).toContain("Acme &lt;script&gt;");
    expect(rendered.html).toContain("token=&lt;unsafe&gt;");
    expect(rendered.html).not.toContain("<script>");
    expect(rendered.text).toContain("Acme <script>");
    expect(rendered.text).toContain("Webcam and microphone access will be required");
  });

  it("rejects missing and unsupported variables", () => {
    const template = getDefaultEmailTemplate("password_reset");

    expect(() =>
      renderEmailTemplate(template, {
        companyName: "Aptly",
        recipientName: "Ada",
        supportEmail: "help@example.com",
        actionUrl: "https://example.com/reset",
        expirationDate: null,
      }),
    ).toThrow(EmailTemplateError);

    expect(() =>
      renderEmailTemplate(template, {
        companyName: "Aptly",
        recipientName: "Ada",
        supportEmail: "help@example.com",
        actionUrl: "https://example.com/reset",
        expirationDate: "Tomorrow",
        rawHtml: "<b>unsafe</b>",
      }),
    ).toThrow(EmailTemplateError);
  });
});

describe("preview email provider", () => {
  it("accepts messages without contacting external SMTP infrastructure", async () => {
    const provider = new PreviewEmailProvider();
    const result = await provider.send({
      from: { email: "no-reply@aptly.test", name: "Aptly" },
      to: { email: "candidate@example.com", name: "Candidate" },
      subject: "Preview",
      html: "<p>Hello</p>",
      text: "Hello",
    });

    expect(result.provider).toBe("preview");
    expect(result.providerMessageId).toMatch(/^preview_/u);
    expect(result.accepted).toEqual(["candidate@example.com"]);
    expect(result.rejected).toEqual([]);
  });
});

describe("SMTP secret resolver", () => {
  it("resolves only configured secret references", async () => {
    const resolver = new EnvironmentSmtpSecretResolver({
      NODE_ENV: "test",
      SMTP_SECRET_REF: "tenant/acme/smtp",
      SMTP_USERNAME: "mailer",
      SMTP_PASSWORD: "secret",
    });

    await expect(resolver.resolve("tenant/acme/smtp")).resolves.toEqual({
      username: "mailer",
      password: "secret",
    });
    await expect(resolver.resolve("tenant/other/smtp")).rejects.toThrow(
      "SMTP secret reference is not available.",
    );
  });
});

describe("email delivery lifecycle", () => {
  it("prevents duplicate delivery creation with an idempotency key", async () => {
    const repo = new InMemoryEmailRepository();
    const existing = repo.seedDelivery({ idempotencyKey: "invite-1" });
    const service = createTestEmailService(repo);

    const delivery = await service.createDelivery({
      context: mutationContext,
      templateKey: "password_reset",
      templateVariables: passwordResetVariables(),
      recipientEmail: "Candidate@Example.com",
      provider: "preview",
      idempotencyKey: "invite-1",
    });

    expect(delivery.id).toBe(existing.id);
    expect(repo.createdDeliveryCount).toBe(0);
  });

  it("queues only minimal non-secret delivery identifiers", async () => {
    const repo = new InMemoryEmailRepository();
    const delivery = repo.seedDelivery({ status: "pending" });
    const queue = new FakeQueue();
    const service = createTestEmailService(repo, { queue });

    await service.enqueueDelivery({
      context: mutationContext,
      deliveryId: delivery.id,
    });

    expect(queue.jobs).toHaveLength(1);
    expect(queue.jobs[0]?.data).toEqual({
      companyId: tenant.companyId,
      deliveryId: delivery.id,
      requestId: "req_1",
      correlationId: "corr_1",
    });
    expect(JSON.stringify(queue.jobs[0]?.data)).not.toContain("candidate@example.com");
    expect(JSON.stringify(queue.jobs[0]?.data)).not.toContain("https://");
  });

  it("records deferred attempts and allows BullMQ retry for temporary provider failures", async () => {
    const repo = new InMemoryEmailRepository();
    const delivery = repo.seedDelivery({ status: "queued" });
    const provider = new ThrowingProvider(true);
    const service = createTestEmailService(repo, { provider });

    await expect(
      service.processQueuedDelivery({
        tenant,
        deliveryId: delivery.id,
      }),
    ).rejects.toThrow(EmailProviderError);

    expect(repo.deliveries.get(delivery.id)?.status).toBe("deferred");
    expect(repo.attempts[0]?.status).toBe("deferred");
    expect(repo.attempts[0]?.errorCode).toBe("SMTP_421");
  });

  it("records terminal provider failures without retrying permanently rejected messages", async () => {
    const repo = new InMemoryEmailRepository();
    const delivery = repo.seedDelivery({ status: "queued" });
    const provider = new ThrowingProvider(false);
    const service = createTestEmailService(repo, { provider });

    const failed = await service.processQueuedDelivery({
      tenant,
      deliveryId: delivery.id,
    });

    expect(failed.status).toBe("failed");
    expect(repo.attempts[0]?.status).toBe("failed");
    expect(repo.attempts[0]?.errorCode).toBe("SMTP_550");
  });
});

describe("email access-control surface", () => {
  it("registers central permissions for settings, templates, deliveries, and sender domains", () => {
    expect(permissionKeys).toEqual(
      expect.arrayContaining([
        "email_settings:read",
        "email_settings:manage",
        "email_templates:read",
        "email_templates:manage",
        "email_deliveries:read",
        "email_deliveries:manage",
        "sender_domains:read",
        "sender_domains:manage",
      ]),
    );
  });
});

const tenant: TenantContext = {
  companyId: "company_test" as TenantId,
};

const mutationContext = {
  tenant,
  actor: { type: "user" as const, id: "user_1" as CompanyUserId },
  request: {
    requestId: "req_1",
    correlationId: "corr_1",
    sessionId: "sess_1",
    ipAddress: "127.0.0.1",
    userAgent: "vitest",
  },
};

function passwordResetVariables() {
  return {
    companyName: "Aptly",
    recipientName: "Ada",
    supportEmail: "help@example.com",
    actionUrl: "https://example.com/reset",
    expirationDate: "Tomorrow",
  };
}

function createTestEmailService(
  repo: InMemoryEmailRepository,
  options: {
    readonly queue?: FakeQueue;
    readonly provider?: EmailProvider;
  } = {},
): EmailService {
  return new EmailService(
    repo,
    {
      createProvider: () => options.provider ?? new PreviewEmailProvider(),
    },
    (options.queue ?? new FakeQueue()) as never,
    new AuditWriter(new InMemoryAuditStore()),
  );
}

class FakeQueue {
  public readonly jobs: {
    readonly name: string;
    readonly data: unknown;
    readonly options: unknown;
  }[] = [];

  public add(name: string, data: unknown, options: unknown): Promise<void> {
    this.jobs.push({ name, data, options });
    return Promise.resolve();
  }
}

class ThrowingProvider implements EmailProvider {
  public readonly kind = "smtp";

  public constructor(private readonly temporary: boolean) {}

  public send(): Promise<EmailProviderSendResult> {
    return Promise.reject(
      new EmailProviderError({
        code: this.temporary ? "SMTP_421" : "SMTP_550",
        message: this.temporary
          ? "SMTP provider deferred the message."
          : "SMTP provider rejected the request.",
        temporary: this.temporary,
      }),
    );
  }

  public testConnection(): Promise<void> {
    return Promise.resolve();
  }
}

class InMemoryAuditStore implements AuditEventStore {
  public readonly events: PersistedAuditEventInput[] = [];

  public append(event: PersistedAuditEventInput): Promise<void> {
    this.events.push(event);
    return Promise.resolve();
  }
}

class InMemoryEmailRepository implements EmailRepository {
  public readonly deliveries = new Map<string, EmailDeliveryRecord>();
  public readonly attempts: EmailDeliveryAttemptRecord[] = [];
  public createdDeliveryCount = 0;

  public seedDelivery(overrides: Partial<EmailDeliveryRecord> = {}): EmailDeliveryRecord {
    const delivery = createDeliveryRecord(overrides);
    this.deliveries.set(delivery.id, delivery);
    return delivery;
  }

  public findSettings(): ReturnType<EmailRepository["findSettings"]> {
    return Promise.resolve(null);
  }

  public upsertSettings(): ReturnType<EmailRepository["upsertSettings"]> {
    throw new Error("Not implemented in test repository.");
  }

  public findSmtpProfile(): ReturnType<EmailRepository["findSmtpProfile"]> {
    return Promise.resolve(null);
  }

  public listSmtpProfiles(): ReturnType<EmailRepository["listSmtpProfiles"]> {
    return Promise.resolve([]);
  }

  public upsertSmtpProfile(): ReturnType<EmailRepository["upsertSmtpProfile"]> {
    throw new Error("Not implemented in test repository.");
  }

  public findTemplate(): ReturnType<EmailRepository["findTemplate"]> {
    return Promise.resolve(null);
  }

  public upsertTemplate(): ReturnType<EmailRepository["upsertTemplate"]> {
    throw new Error("Not implemented in test repository.");
  }

  public createDelivery(
    input: Parameters<EmailRepository["createDelivery"]>[0],
  ): ReturnType<EmailRepository["createDelivery"]> {
    this.createdDeliveryCount += 1;
    const delivery = createDeliveryRecord({
      ...input,
      id: `delivery_${String(this.deliveries.size + 1)}` as EmailDeliveryId,
      status: "pending",
    });
    this.deliveries.set(delivery.id, delivery);
    return Promise.resolve(delivery);
  }

  public findDelivery(
    _tenant: TenantContext,
    id: EmailDeliveryId,
  ): ReturnType<EmailRepository["findDelivery"]> {
    return Promise.resolve(this.deliveries.get(id) ?? null);
  }

  public findDeliveryByIdempotency(
    input: Parameters<EmailRepository["findDeliveryByIdempotency"]>[0],
  ): ReturnType<EmailRepository["findDeliveryByIdempotency"]> {
    return Promise.resolve(
      [...this.deliveries.values()].find(
        (delivery) =>
          delivery.companyId === input.companyId &&
          delivery.idempotencyKey === input.idempotencyKey,
      ) ?? null,
    );
  }

  public updateDeliveryStatus(
    input: Parameters<EmailRepository["updateDeliveryStatus"]>[0],
  ): ReturnType<EmailRepository["updateDeliveryStatus"]> {
    const existing = this.deliveries.get(input.deliveryId);
    if (existing === undefined || !input.fromStatuses.includes(existing.status)) {
      return Promise.resolve(null);
    }
    const updated: EmailDeliveryRecord = {
      ...existing,
      status: input.toStatus,
      providerMessageId: input.providerMessageId ?? existing.providerMessageId,
      errorCode: input.errorCode ?? existing.errorCode,
      errorMessage: input.errorMessage ?? existing.errorMessage,
      updatedAt: input.at,
    };
    this.deliveries.set(updated.id, updated);
    return Promise.resolve(updated);
  }

  public createAttempt(
    input: Parameters<EmailRepository["createAttempt"]>[0],
  ): ReturnType<EmailRepository["createAttempt"]> {
    const attempt: EmailDeliveryAttemptRecord = {
      id: `attempt_${String(this.attempts.length + 1)}` as EmailDeliveryAttemptRecord["id"],
      ...input,
      createdAt: new Date(),
    };
    this.attempts.push(attempt);
    return Promise.resolve(attempt);
  }

  public countAttempts(): ReturnType<EmailRepository["countAttempts"]> {
    return Promise.resolve(this.attempts.length);
  }

  public recordEvent(): ReturnType<EmailRepository["recordEvent"]> {
    return Promise.resolve();
  }
}

function createDeliveryRecord(overrides: Partial<EmailDeliveryRecord>): EmailDeliveryRecord {
  const now = new Date("2026-06-30T00:00:00.000Z");
  return {
    id: "delivery_1" as EmailDeliveryId,
    companyId: tenant.companyId,
    notificationIntentId: null,
    templateId: null,
    templateKey: "password_reset",
    templateVersion: 1,
    smtpProfileId: null,
    recipientEmail: "candidate@example.com",
    normalizedRecipientEmail: "candidate@example.com",
    recipientName: "Candidate",
    subject: "Reset your Aptly password",
    status: "pending",
    idempotencyKey: null,
    provider: "preview",
    providerMessageId: null,
    queuedAt: null,
    sendingAt: null,
    sentAt: null,
    deliveredAt: null,
    deferredAt: null,
    bouncedAt: null,
    complainedAt: null,
    failedAt: null,
    cancelledAt: null,
    errorCode: null,
    errorMessage: null,
    metadata: {
      schemaVersion: 1,
      templateVariables: passwordResetVariables(),
    },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
