import type { AuditRequestContext } from "@/modules/audit";
import type { CompanyActor, TenantContext, TenantId } from "@/modules/tenant";
import type { Brand } from "@/shared";

export type NotificationIntentId = Brand<string, "NotificationIntentId">;
export type NotificationIntentType =
  | "invitation_created"
  | "invitation_reminder"
  | "schedule_created"
  | "schedule_updated"
  | "results_ready"
  | "application_decision";
export type NotificationChannel = "email";
export type NotificationIntentStatus = "pending" | "cancelled" | "dispatched" | "failed";

export interface NotificationMutationContext {
  readonly tenant: TenantContext;
  readonly actor: CompanyActor;
  readonly request: AuditRequestContext;
  readonly supportAccessSessionId?: string | null;
}

export interface NotificationIntentRecord {
  readonly id: NotificationIntentId;
  readonly companyId: TenantId;
  readonly type: NotificationIntentType;
  readonly channel: NotificationChannel;
  readonly status: NotificationIntentStatus;
  readonly recipientEmail: string;
  readonly recipientName: string | null;
  readonly targetResourceType: string;
  readonly targetResourceId: string;
  readonly payload: Record<string, unknown>;
  readonly scheduledFor: Date | null;
  readonly dispatchedAt: Date | null;
  readonly cancelledAt: Date | null;
  readonly failureReason: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NotificationsRepository {
  createIntent(input: {
    readonly companyId: TenantId;
    readonly type: NotificationIntentType;
    readonly channel: NotificationChannel;
    readonly recipientEmail: string;
    readonly recipientName: string | null;
    readonly targetResourceType: string;
    readonly targetResourceId: string;
    readonly payload: Record<string, unknown>;
    readonly scheduledFor: Date | null;
  }): Promise<NotificationIntentRecord>;
  findIntent(
    tenant: TenantContext,
    intentId: NotificationIntentId,
  ): Promise<NotificationIntentRecord | null>;
  cancelIntent(input: {
    readonly companyId: TenantId;
    readonly intentId: NotificationIntentId;
    readonly cancelledAt: Date;
  }): Promise<NotificationIntentRecord>;
}
