import { AuditWriter } from "@/modules/audit";

import type { TenantContext } from "@/modules/tenant";
import type {
  EndSupportAccessSessionInput,
  StartSupportAccessSessionInput,
  SupportAccessSession,
  SupportAccessSessionStore,
} from "./types";

const DEFAULT_MAX_DURATION_MS = 4 * 60 * 60 * 1000;

export class SupportAccessError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "SupportAccessError";
  }
}

export class SupportAccessService {
  public constructor(
    private readonly store: SupportAccessSessionStore,
    private readonly audit: AuditWriter,
    private readonly now: () => Date = () => new Date(),
    private readonly maxDurationMs: number = DEFAULT_MAX_DURATION_MS,
  ) {}

  public async startSession(input: StartSupportAccessSessionInput): Promise<SupportAccessSession> {
    const startedAt = this.now();
    this.assertValidStartInput(input, startedAt);

    const session = await this.store.createActive({
      companyId: input.companyId,
      platformUserId: input.platformUserId,
      approvedByPlatformUserId: input.approvedByPlatformUserId,
      reasonCode: input.reasonCode,
      reasonText: input.reasonText.trim(),
      startedAt,
      expiresAt: input.expiresAt,
    });

    await this.audit.record({
      companyId: input.companyId,
      actor: {
        type: "platform_user",
        id: input.platformUserId,
      },
      request: input.request,
      supportAccessSessionId: session.id,
      action: "support_access.started",
      resourceType: "support_access_session",
      resourceId: session.id,
      reason: input.reasonText.trim(),
      riskLevel: "critical",
      metadata: {
        reasonCode: input.reasonCode,
        approvedByPlatformUserId: input.approvedByPlatformUserId,
        expiresAt: input.expiresAt.toISOString(),
      },
    });

    return session;
  }

  public async endSession(input: EndSupportAccessSessionInput): Promise<SupportAccessSession> {
    const endedAt = input.endedAt ?? this.now();
    const reason = input.reason.trim();

    if (reason.length === 0) {
      throw new SupportAccessError("Support access end reason is required.");
    }

    const existing = await this.store.findById(input.sessionId);
    if (existing === null) {
      throw new SupportAccessError("Support access session was not found.");
    }

    const status = endedAt >= existing.expiresAt ? "expired" : "revoked";
    const session = await this.store.end({
      id: input.sessionId,
      status,
      endedAt,
    });

    await this.audit.record({
      companyId: session.companyId,
      actor: {
        type: "platform_user",
        id: input.platformUserId,
      },
      request: input.request,
      supportAccessSessionId: session.id,
      action: "support_access.ended",
      resourceType: "support_access_session",
      resourceId: session.id,
      reason,
      riskLevel: "critical",
      metadata: {
        status,
        endedAt: endedAt.toISOString(),
      },
    });

    return session;
  }

  public canUseSession(session: SupportAccessSession, at: Date = this.now()): boolean {
    return session.status === "active" && session.endedAt === null && at < session.expiresAt;
  }

  public async listCompanyHistory(tenant: TenantContext): Promise<readonly SupportAccessSession[]> {
    return this.store.listForCompany(tenant);
  }

  private assertValidStartInput(input: StartSupportAccessSessionInput, startedAt: Date): void {
    const reasonText = input.reasonText.trim();
    if (reasonText.length < 12) {
      throw new SupportAccessError("Support access reason must be specific.");
    }

    if (input.platformUserId === input.approvedByPlatformUserId) {
      throw new SupportAccessError("Support access must be approved by a separate platform user.");
    }

    if (input.expiresAt <= startedAt) {
      throw new SupportAccessError("Support access expiration must be in the future.");
    }

    if (input.expiresAt.getTime() - startedAt.getTime() > this.maxDurationMs) {
      throw new SupportAccessError("Support access duration exceeds the maximum allowed window.");
    }
  }
}
