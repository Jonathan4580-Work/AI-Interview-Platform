import { AuditWriter } from "@/modules/audit";

import type {
  NotificationIntentId,
  NotificationIntentRecord,
  NotificationMutationContext,
  NotificationsRepository,
} from "./types";

export class NotificationsDomainError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "NotificationsDomainError";
  }
}

export class NotificationsService {
  public constructor(
    private readonly repository: NotificationsRepository,
    private readonly auditWriter: AuditWriter,
  ) {}

  public async createIntent(input: {
    readonly context: NotificationMutationContext;
    readonly type: NotificationIntentRecord["type"];
    readonly recipientEmail: string;
    readonly recipientName?: string | null;
    readonly targetResourceType: string;
    readonly targetResourceId: string;
    readonly payload: Record<string, unknown>;
    readonly scheduledFor?: Date | null;
  }): Promise<NotificationIntentRecord> {
    const intent = await this.repository.createIntent({
      companyId: input.context.tenant.companyId,
      type: input.type,
      channel: "email",
      recipientEmail: normalizeEmail(input.recipientEmail),
      recipientName: normalizeOptionalText(input.recipientName ?? null, 120, "Recipient name"),
      targetResourceType: normalizeIdentifier(input.targetResourceType, "Target resource type"),
      targetResourceId: normalizeIdentifier(input.targetResourceId, "Target resource id"),
      payload: input.payload,
      scheduledFor: input.scheduledFor ?? null,
    });
    await this.writeAudit(
      input.context,
      "notifications.intent_created",
      "notification_intent",
      intent.id,
      {
        after: intent,
      },
    );
    return intent;
  }

  public async cancelIntent(input: {
    readonly context: NotificationMutationContext;
    readonly intentId: NotificationIntentId;
  }): Promise<NotificationIntentRecord> {
    const existing = await this.repository.findIntent(input.context.tenant, input.intentId);
    if (existing === null) {
      throw new NotificationsDomainError("Notification intent was not found for this company.");
    }
    if (existing.status !== "pending") {
      throw new NotificationsDomainError("Only pending notification intents can be cancelled.");
    }

    const intent = await this.repository.cancelIntent({
      companyId: input.context.tenant.companyId,
      intentId: input.intentId,
      cancelledAt: new Date(),
    });
    await this.writeAudit(
      input.context,
      "notifications.intent_cancelled",
      "notification_intent",
      intent.id,
      {
        before: existing,
        after: intent,
      },
    );
    return intent;
  }

  private async writeAudit(
    context: NotificationMutationContext,
    action: string,
    resourceType: string,
    resourceId: string,
    snapshots: { readonly before?: unknown; readonly after?: unknown },
  ): Promise<void> {
    await this.auditWriter.record({
      companyId: context.tenant.companyId,
      actor:
        context.actor.type === "system"
          ? { type: "system", id: null }
          : { type: context.actor.type, id: context.actor.id },
      request: context.request,
      supportAccessSessionId: context.supportAccessSessionId,
      action,
      resourceType,
      resourceId,
      riskLevel: "medium",
      before: snapshots.before,
      after: snapshots.after,
    });
  }
}

function normalizeEmail(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new NotificationsDomainError("Notification recipient email must be valid.");
  }
  return normalized;
}

function normalizeIdentifier(value: string, label: string): string {
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > 120) {
    throw new NotificationsDomainError(`${label} must be between 1 and 120 characters.`);
  }
  return normalized;
}

function normalizeOptionalText(
  value: string | null,
  maxLength: number,
  label: string,
): string | null {
  if (value === null || value.trim().length === 0) {
    return null;
  }
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length > maxLength) {
    throw new NotificationsDomainError(`${label} cannot exceed ${String(maxLength)} characters.`);
  }
  return normalized;
}
