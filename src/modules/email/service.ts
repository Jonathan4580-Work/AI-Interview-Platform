import type { Queue } from "bullmq";

import { AuditWriter } from "@/modules/audit";
import type { TenantContext } from "@/modules/tenant";

import { getDefaultEmailTemplate } from "./default-templates";
import {
  renderEmailTemplate,
  type EmailTemplateDefinition,
  type EmailTemplateVariables,
} from "./template-renderer";
import {
  EmailProviderError,
  type EmailDeliveryId,
  type EmailDeliveryRecord,
  type EmailMutationContext,
  type EmailProvider,
  type EmailProviderKind,
  type EmailRepository,
  type EmailTemplateKey,
  type SmtpProfileRecord,
} from "./types";

export interface EmailDeliveryJob {
  readonly companyId: string;
  readonly deliveryId: string;
  readonly requestId: string;
  readonly correlationId: string;
}

export interface EmailProviderFactory {
  createProvider(input: {
    readonly provider: EmailProviderKind;
    readonly smtpProfile: SmtpProfileRecord | null;
  }): EmailProvider;
}

export class EmailDomainError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "EmailDomainError";
  }
}

export class EmailService {
  public constructor(
    private readonly repository: EmailRepository,
    private readonly providerFactory: EmailProviderFactory,
    private readonly queue: Queue<EmailDeliveryJob>,
    private readonly auditWriter: AuditWriter,
  ) {}

  public async createDelivery(input: {
    readonly context: EmailMutationContext;
    readonly templateKey: EmailTemplateKey;
    readonly templateVariables: EmailTemplateVariables;
    readonly recipientEmail: string;
    readonly recipientName?: string | null;
    readonly notificationIntentId?: string | null;
    readonly smtpProfileId?: string | null;
    readonly provider: EmailProviderKind;
    readonly idempotencyKey?: string | null;
  }): Promise<EmailDeliveryRecord> {
    const normalizedRecipientEmail = normalizeEmail(input.recipientEmail);
    const idempotencyKey = normalizeOptionalIdempotencyKey(input.idempotencyKey ?? null);
    if (idempotencyKey !== null) {
      const existing = await this.repository.findDeliveryByIdempotency({
        companyId: input.context.tenant.companyId,
        idempotencyKey,
      });
      if (existing !== null) {
        return existing;
      }
    }

    const template = resolveTemplateDefinition(
      input.templateKey,
      await this.repository.findTemplate({
        tenant: input.context.tenant,
        key: input.templateKey,
      }),
    );
    const rendered = renderEmailTemplate(template, input.templateVariables);
    const delivery = await this.repository.createDelivery({
      companyId: input.context.tenant.companyId,
      notificationIntentId: input.notificationIntentId ?? null,
      templateId: template.templateId,
      templateKey: input.templateKey,
      templateVersion: template.version,
      smtpProfileId: (input.smtpProfileId ?? null) as EmailDeliveryRecord["smtpProfileId"],
      recipientEmail: input.recipientEmail.trim(),
      normalizedRecipientEmail,
      recipientName: normalizeOptionalText(input.recipientName ?? null, 160),
      subject: rendered.subject,
      idempotencyKey,
      provider: input.provider,
      metadata: {
        schemaVersion: 1,
        templateVariables: input.templateVariables,
      },
    });

    await this.writeAudit(input.context, "email.delivery_created", "email_delivery", delivery.id, {
      after: safeDeliveryAuditSnapshot(delivery),
    });
    return delivery;
  }

  public async enqueueDelivery(input: {
    readonly context: EmailMutationContext;
    readonly deliveryId: EmailDeliveryId;
  }): Promise<EmailDeliveryRecord> {
    const delivery = await this.requireDelivery(input.context.tenant, input.deliveryId);
    if (
      delivery.status === "queued" ||
      delivery.status === "sending" ||
      delivery.status === "sent"
    ) {
      return delivery;
    }
    if (
      delivery.status !== "pending" &&
      delivery.status !== "failed" &&
      delivery.status !== "deferred"
    ) {
      throw new EmailDomainError(
        "Only pending, deferred, or failed email deliveries can be queued.",
      );
    }

    const queued = await this.repository.updateDeliveryStatus({
      companyId: input.context.tenant.companyId,
      deliveryId: delivery.id,
      fromStatuses: [delivery.status],
      toStatus: "queued",
      at: new Date(),
    });
    if (queued === null) {
      throw new EmailDomainError("Email delivery could not be queued from its current status.");
    }

    await this.queue.add(
      "send",
      {
        companyId: String(queued.companyId),
        deliveryId: String(queued.id),
        requestId: input.context.request.requestId ?? `email-${String(queued.id)}`,
        correlationId: input.context.request.correlationId ?? `email-${String(queued.id)}`,
      },
      {
        jobId: `email:${queued.companyId}:${queued.id}`,
        attempts: 5,
        backoff: {
          type: "exponential",
          delay: 2_000,
        },
        removeOnComplete: 1_000,
        removeOnFail: 10_000,
      },
    );

    await this.writeAudit(input.context, "email.delivery_queued", "email_delivery", queued.id, {
      before: safeDeliveryAuditSnapshot(delivery),
      after: safeDeliveryAuditSnapshot(queued),
    });
    return queued;
  }

  public async cancelDelivery(input: {
    readonly context: EmailMutationContext;
    readonly deliveryId: EmailDeliveryId;
  }): Promise<EmailDeliveryRecord> {
    const delivery = await this.requireDelivery(input.context.tenant, input.deliveryId);
    const cancelled = await this.repository.updateDeliveryStatus({
      companyId: input.context.tenant.companyId,
      deliveryId: delivery.id,
      fromStatuses: ["pending", "queued", "deferred", "failed"],
      toStatus: "cancelled",
      at: new Date(),
    });
    if (cancelled === null) {
      throw new EmailDomainError("Email delivery cannot be cancelled after sending has started.");
    }
    await this.writeAudit(
      input.context,
      "email.delivery_cancelled",
      "email_delivery",
      cancelled.id,
      {
        before: safeDeliveryAuditSnapshot(delivery),
        after: safeDeliveryAuditSnapshot(cancelled),
      },
    );
    return cancelled;
  }

  public async processQueuedDelivery(input: {
    readonly tenant: TenantContext;
    readonly deliveryId: EmailDeliveryId;
  }): Promise<EmailDeliveryRecord> {
    const delivery = await this.requireDelivery(input.tenant, input.deliveryId);
    const sending = await this.repository.updateDeliveryStatus({
      companyId: input.tenant.companyId,
      deliveryId: delivery.id,
      fromStatuses: ["queued"],
      toStatus: "sending",
      at: new Date(),
    });
    if (sending === null) {
      return delivery;
    }

    const startedAt = new Date();
    const attemptNumber = (await this.repository.countAttempts(input.tenant, delivery.id)) + 1;
    const template = resolveTemplateDefinition(
      sending.templateKey,
      await this.repository.findTemplate({
        tenant: input.tenant,
        key: sending.templateKey,
        version: sending.templateVersion,
      }),
    );
    const rendered = renderEmailTemplate(template, readTemplateVariables(sending));
    const smtpProfile =
      sending.smtpProfileId === null
        ? null
        : await this.repository.findSmtpProfile(input.tenant, sending.smtpProfileId);
    const provider = this.providerFactory.createProvider({
      provider: sending.provider,
      smtpProfile,
    });

    try {
      const result = await provider.send({
        from: {
          email: smtpProfile?.fromEmail ?? "no-reply@aptly.local",
          name: smtpProfile?.fromName ?? "Aptly",
        },
        replyTo:
          smtpProfile?.replyToEmail === null || smtpProfile?.replyToEmail === undefined
            ? null
            : { email: smtpProfile.replyToEmail },
        to: {
          email: sending.recipientEmail,
          name: sending.recipientName,
        },
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        headers: {
          "X-Aptly-Delivery-Id": sending.id,
        },
      });
      await this.repository.createAttempt({
        companyId: input.tenant.companyId,
        deliveryId: sending.id,
        attemptNumber,
        status: "sent",
        provider: result.provider,
        providerMessageId: result.providerMessageId,
        errorCode: null,
        errorMessage: null,
        startedAt,
        completedAt: new Date(),
        metadata: {
          acceptedCount: result.accepted.length,
          rejectedCount: result.rejected.length,
          responseCode: result.responseCode,
        },
      });
      const sent = await this.repository.updateDeliveryStatus({
        companyId: input.tenant.companyId,
        deliveryId: sending.id,
        fromStatuses: ["sending"],
        toStatus: "sent",
        providerMessageId: result.providerMessageId,
        at: new Date(),
      });
      if (sent === null) {
        throw new EmailDomainError("Email delivery state changed while sending.");
      }
      return sent;
    } catch (error) {
      const details =
        error instanceof EmailProviderError
          ? error.details
          : {
              code: "EMAIL_PROVIDER_UNKNOWN",
              message: "Email provider failed to send the message.",
              temporary: false,
            };
      const status = details.temporary ? "deferred" : "failed";
      await this.repository.createAttempt({
        companyId: input.tenant.companyId,
        deliveryId: sending.id,
        attemptNumber,
        status,
        provider: sending.provider,
        providerMessageId: null,
        errorCode: details.code,
        errorMessage: details.message,
        startedAt,
        completedAt: new Date(),
        metadata: {},
      });
      const updated = await this.repository.updateDeliveryStatus({
        companyId: input.tenant.companyId,
        deliveryId: sending.id,
        fromStatuses: ["sending"],
        toStatus: status,
        errorCode: details.code,
        errorMessage: details.message,
        at: new Date(),
      });
      if (updated === null) {
        throw new EmailDomainError(
          "Email delivery state changed while recording provider failure.",
        );
      }
      if (details.temporary) {
        throw error;
      }
      return updated;
    }
  }

  public async recordProviderEvent(input: {
    readonly tenant: TenantContext;
    readonly deliveryId: EmailDeliveryId;
    readonly type: "delivered" | "deferred" | "bounced" | "complained" | "failed";
    readonly providerMessageId?: string | null;
    readonly reasonCode?: string | null;
    readonly reasonText?: string | null;
  }): Promise<EmailDeliveryRecord> {
    const delivery = await this.requireDelivery(input.tenant, input.deliveryId);
    await this.repository.recordEvent({
      companyId: input.tenant.companyId,
      deliveryId: delivery.id,
      type: input.type,
      provider: delivery.provider,
      providerMessageId: input.providerMessageId ?? delivery.providerMessageId,
      reasonCode: input.reasonCode ?? null,
      reasonText: normalizeProviderText(input.reasonText ?? null),
      occurredAt: new Date(),
      metadata: {},
    });
    const updated = await this.repository.updateDeliveryStatus({
      companyId: input.tenant.companyId,
      deliveryId: delivery.id,
      fromStatuses: ["sent", "deferred", "sending"],
      toStatus: input.type === "complained" ? "complained" : input.type,
      providerMessageId: input.providerMessageId ?? delivery.providerMessageId,
      errorCode: input.reasonCode ?? null,
      errorMessage: normalizeProviderText(input.reasonText ?? null),
      at: new Date(),
    });
    if (updated === null) {
      throw new EmailDomainError("Email delivery event cannot be applied from its current status.");
    }
    return updated;
  }

  private async requireDelivery(
    tenant: TenantContext,
    deliveryId: EmailDeliveryId,
  ): Promise<EmailDeliveryRecord> {
    const delivery = await this.repository.findDelivery(tenant, deliveryId);
    if (delivery === null) {
      throw new EmailDomainError("Email delivery was not found for this company.");
    }
    return delivery;
  }

  private async writeAudit(
    context: EmailMutationContext,
    action: string,
    resourceType: string,
    resourceId: string,
    snapshots: { readonly before?: unknown; readonly after?: unknown },
  ): Promise<void> {
    await this.auditWriter.record({
      companyId: context.tenant.companyId,
      actor: context.actor,
      request: context.request,
      supportAccessSessionId: context.supportAccessSessionId ?? null,
      action,
      resourceType,
      resourceId,
      riskLevel: "medium",
      before: snapshots.before,
      after: snapshots.after,
    });
  }
}

export function normalizeEmail(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(normalized)) {
    throw new EmailDomainError("Email address must be valid.");
  }
  return normalized;
}

export function normalizeOptionalText(value: string | null, maxLength: number): string | null {
  if (value === null || value.trim().length === 0) {
    return null;
  }
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length > maxLength) {
    throw new EmailDomainError("Text value exceeds maximum length.");
  }
  return normalized;
}

function normalizeOptionalIdempotencyKey(value: string | null): string | null {
  if (value === null || value.trim().length === 0) {
    return null;
  }
  const normalized = value.trim();
  if (normalized.length > 160) {
    throw new EmailDomainError("Idempotency key cannot exceed 160 characters.");
  }
  return normalized;
}

function readTemplateVariables(delivery: EmailDeliveryRecord): EmailTemplateVariables {
  const variables = delivery.metadata.templateVariables;
  if (typeof variables !== "object" || variables === null || Array.isArray(variables)) {
    throw new EmailDomainError("Email delivery is missing template variables.");
  }
  return variables as EmailTemplateVariables;
}

function resolveTemplateDefinition(
  key: EmailTemplateKey,
  record: Awaited<ReturnType<EmailRepository["findTemplate"]>>,
): EmailTemplateDefinition & {
  readonly templateId: EmailDeliveryRecord["templateId"];
  readonly version: number;
} {
  const defaults = getDefaultEmailTemplate(key);
  if (record === null) {
    return {
      ...defaults,
      templateId: null,
      version: 1,
    };
  }

  return {
    key: record.key,
    name: record.name,
    schemaVersion: record.schemaVersion,
    subject: record.subject,
    htmlBody: record.htmlBody,
    textBody: record.textBody,
    variables: defaults.variables,
    templateId: record.id,
    version: record.version,
  };
}

function normalizeProviderText(value: string | null): string | null {
  return normalizeOptionalText(value, 500);
}

function safeDeliveryAuditSnapshot(delivery: EmailDeliveryRecord): Record<string, unknown> {
  return {
    id: delivery.id,
    companyId: delivery.companyId,
    templateKey: delivery.templateKey,
    status: delivery.status,
    provider: delivery.provider,
    recipientEmail: delivery.normalizedRecipientEmail,
    subject: delivery.subject,
    idempotencyKey: delivery.idempotencyKey,
    providerMessageId: delivery.providerMessageId,
  };
}
