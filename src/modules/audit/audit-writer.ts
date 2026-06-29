import { redactAuditValue } from "./redaction";

import type { AuditEventInput, AuditEventStore } from "./types";

export class AuditWriter {
  public constructor(private readonly store: AuditEventStore) {}

  public async record(input: AuditEventInput): Promise<void> {
    await this.store.append({
      companyId: input.companyId ?? null,
      actorType: input.actor.type,
      actorId: input.actor.id,
      requestId: input.request.requestId,
      correlationId: input.request.correlationId,
      sessionId: input.request.sessionId,
      supportAccessSessionId: input.supportAccessSessionId ?? null,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? null,
      reason: input.reason ?? null,
      riskLevel: input.riskLevel ?? "low",
      before: redactAuditValue(input.before ?? null),
      after: redactAuditValue(input.after ?? null),
      ipAddress: input.request.ipAddress,
      userAgent: input.request.userAgent,
      metadata: redactAuditValue(input.metadata ?? null),
    });
  }
}
