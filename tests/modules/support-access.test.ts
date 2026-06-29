import { describe, expect, it } from "vitest";

import { AuditWriter } from "@/modules/audit";
import { SupportAccessError, SupportAccessService } from "@/modules/support-access";
import { createTenantContext } from "@/modules/tenant";

import type { AuditEventStore, PersistedAuditEventInput } from "@/modules/audit";
import type {
  PlatformUserId,
  SupportAccessSession,
  SupportAccessSessionId,
  SupportAccessSessionStore,
  SupportAccessStatus,
} from "@/modules/support-access";
import type { TenantContext, TenantId } from "@/modules/tenant";

const request = {
  requestId: "req-1",
  correlationId: "corr-1",
  sessionId: "sess-1",
  ipAddress: "127.0.0.1",
  userAgent: "vitest",
};

class RecordingAuditStore implements AuditEventStore {
  public readonly events: PersistedAuditEventInput[] = [];

  public append(event: PersistedAuditEventInput): Promise<void> {
    this.events.push(event);
    return Promise.resolve();
  }
}

class MemorySupportAccessStore implements SupportAccessSessionStore {
  public readonly sessions: SupportAccessSession[] = [];

  public createActive(
    input: Parameters<SupportAccessSessionStore["createActive"]>[0],
  ): Promise<SupportAccessSession> {
    const session: SupportAccessSession = {
      id: `support-${String(this.sessions.length + 1)}` as SupportAccessSessionId,
      companyId: input.companyId,
      platformUserId: input.platformUserId,
      status: "active",
      reasonCode: input.reasonCode,
      reasonText: input.reasonText,
      approvedByPlatformUserId: input.approvedByPlatformUserId,
      startedAt: input.startedAt,
      expiresAt: input.expiresAt,
      endedAt: null,
      createdAt: input.startedAt,
      updatedAt: input.startedAt,
    };

    this.sessions.push(session);
    return Promise.resolve(session);
  }

  public findById(id: SupportAccessSessionId): Promise<SupportAccessSession | null> {
    return Promise.resolve(this.sessions.find((session) => session.id === id) ?? null);
  }

  public end(input: {
    readonly id: SupportAccessSessionId;
    readonly status: Extract<SupportAccessStatus, "expired" | "revoked">;
    readonly endedAt: Date;
  }): Promise<SupportAccessSession> {
    const index = this.sessions.findIndex((session) => session.id === input.id);
    if (index < 0) {
      throw new Error("missing session");
    }

    const updated: SupportAccessSession = {
      ...this.sessions[index],
      status: input.status,
      endedAt: input.endedAt,
      updatedAt: input.endedAt,
    };
    this.sessions[index] = updated;
    return Promise.resolve(updated);
  }

  public listForCompany(tenant: TenantContext): Promise<readonly SupportAccessSession[]> {
    return Promise.resolve(
      this.sessions.filter((session) => session.companyId === tenant.companyId),
    );
  }
}

describe("support access module", () => {
  it("starts a time-limited support session and audits the access", async () => {
    const tenant = createTenantContext("cm0tenant001");
    const auditStore = new RecordingAuditStore();
    const store = new MemorySupportAccessStore();
    const now = new Date("2026-06-30T00:00:00.000Z");
    const service = new SupportAccessService(
      store,
      new AuditWriter(auditStore),
      () => now,
    );

    const session = await service.startSession({
      companyId: tenant.companyId,
      platformUserId: "platform-1" as PlatformUserId,
      approvedByPlatformUserId: "platform-2" as PlatformUserId,
      reasonCode: "customer_support",
      reasonText: "Investigating tenant queue failure",
      expiresAt: new Date("2026-06-30T01:00:00.000Z"),
      request,
    });

    expect(service.canUseSession(session, new Date("2026-06-30T00:59:00.000Z"))).toBe(true);
    expect(service.canUseSession(session, new Date("2026-06-30T01:00:00.000Z"))).toBe(false);
    expect(auditStore.events).toHaveLength(1);
    expect(auditStore.events[0]).toMatchObject({
      companyId: tenant.companyId,
      actorType: "platform_user",
      actorId: "platform-1",
      action: "support_access.started",
      supportAccessSessionId: session.id,
      riskLevel: "critical",
      reason: "Investigating tenant queue failure",
    });
  });

  it("rejects broad or stale support access windows", async () => {
    const tenant = createTenantContext("cm0tenant001");
    const service = new SupportAccessService(
      new MemorySupportAccessStore(),
      new AuditWriter(new RecordingAuditStore()),
      () => new Date("2026-06-30T00:00:00.000Z"),
    );

    await expect(
      service.startSession({
        companyId: tenant.companyId,
        platformUserId: "platform-1" as PlatformUserId,
        approvedByPlatformUserId: "platform-2" as PlatformUserId,
        reasonCode: "customer_support",
        reasonText: "too vague",
        expiresAt: new Date("2026-06-30T01:00:00.000Z"),
        request,
      }),
    ).rejects.toBeInstanceOf(SupportAccessError);

    await expect(
      service.startSession({
        companyId: tenant.companyId,
        platformUserId: "platform-1" as PlatformUserId,
        approvedByPlatformUserId: "platform-2" as PlatformUserId,
        reasonCode: "customer_support",
        reasonText: "Investigating tenant queue failure",
        expiresAt: new Date("2026-06-30T06:00:00.000Z"),
        request,
      }),
    ).rejects.toBeInstanceOf(SupportAccessError);
  });

  it("ends support access and exposes tenant-scoped company history", async () => {
    const tenant = createTenantContext("cm0tenant001");
    const otherTenant = createTenantContext("cm0tenant002");
    const auditStore = new RecordingAuditStore();
    const store = new MemorySupportAccessStore();
    const service = new SupportAccessService(
      store,
      new AuditWriter(auditStore),
      () => new Date("2026-06-30T00:00:00.000Z"),
    );

    const session = await service.startSession({
      companyId: tenant.companyId,
      platformUserId: "platform-1" as PlatformUserId,
      approvedByPlatformUserId: "platform-2" as PlatformUserId,
      reasonCode: "incident_response",
      reasonText: "Investigating tenant incident impact",
      expiresAt: new Date("2026-06-30T01:00:00.000Z"),
      request,
    });

    await service.startSession({
      companyId: otherTenant.companyId,
      platformUserId: "platform-1" as PlatformUserId,
      approvedByPlatformUserId: "platform-2" as PlatformUserId,
      reasonCode: "customer_support",
      reasonText: "Investigating tenant queue failure",
      expiresAt: new Date("2026-06-30T01:00:00.000Z"),
      request,
    });

    const ended = await service.endSession({
      sessionId: session.id,
      platformUserId: "platform-1" as PlatformUserId,
      reason: "Investigation complete",
      endedAt: new Date("2026-06-30T00:30:00.000Z"),
      request,
    });

    const history = await service.listCompanyHistory(tenant);

    expect(ended.status).toBe("revoked");
    expect(history).toHaveLength(1);
    expect(history[0]?.companyId).toBe("cm0tenant001" as TenantId);
    expect(auditStore.events.map((event) => event.action)).toEqual([
      "support_access.started",
      "support_access.started",
      "support_access.ended",
    ]);
  });
});
