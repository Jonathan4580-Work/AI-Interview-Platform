import type { AuditRequestContext } from "@/modules/audit";
import type { CandidateId } from "@/modules/candidates";
import type { CompanyActor, TenantContext, TenantId } from "@/modules/tenant";
import type { Brand } from "@/shared";

export type ScheduleEventId = Brand<string, "ScheduleEventId">;
export type ScheduleParticipantId = Brand<string, "ScheduleParticipantId">;
export type ScheduleUserId = Brand<string, "ScheduleUserId">;

export type ScheduleEventType = "interview" | "deadline" | "reminder";
export type ScheduleEventStatus = "scheduled" | "cancelled" | "completed";
export type CalendarProvider = "internal" | "google" | "microsoft";
export type ScheduleParticipantType = "candidate" | "user" | "external";
export type ScheduleResponseStatus = "needs_action" | "accepted" | "declined" | "tentative";

export interface SchedulingMutationContext {
  readonly tenant: TenantContext;
  readonly actor: CompanyActor;
  readonly request: AuditRequestContext;
  readonly supportAccessSessionId?: string | null;
}

export interface ScheduleEventRecord {
  readonly id: ScheduleEventId;
  readonly companyId: TenantId;
  readonly type: ScheduleEventType;
  readonly status: ScheduleEventStatus;
  readonly title: string;
  readonly description: string | null;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly timeZone: string;
  readonly provider: CalendarProvider;
  readonly providerEventRef: string | null;
  readonly targetResourceType: string | null;
  readonly targetResourceId: string | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly cancelledAt: Date | null;
}

export interface ScheduleParticipantRecord {
  readonly id: ScheduleParticipantId;
  readonly companyId: TenantId;
  readonly scheduleEventId: ScheduleEventId;
  readonly type: ScheduleParticipantType;
  readonly displayName: string;
  readonly email: string | null;
  readonly userId: ScheduleUserId | null;
  readonly candidateId: CandidateId | null;
  readonly responseStatus: ScheduleResponseStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface SchedulingRepository {
  createEvent(input: {
    readonly companyId: TenantId;
    readonly type: ScheduleEventType;
    readonly title: string;
    readonly description: string | null;
    readonly startsAt: Date;
    readonly endsAt: Date;
    readonly timeZone: string;
    readonly provider: CalendarProvider;
    readonly targetResourceType: string | null;
    readonly targetResourceId: string | null;
    readonly metadata: Record<string, unknown>;
  }): Promise<ScheduleEventRecord>;
  findEvent(tenant: TenantContext, eventId: ScheduleEventId): Promise<ScheduleEventRecord | null>;
  cancelEvent(input: {
    readonly companyId: TenantId;
    readonly eventId: ScheduleEventId;
    readonly cancelledAt: Date;
  }): Promise<ScheduleEventRecord>;
  addParticipant(input: {
    readonly companyId: TenantId;
    readonly scheduleEventId: ScheduleEventId;
    readonly type: ScheduleParticipantType;
    readonly displayName: string;
    readonly email: string | null;
    readonly userId: ScheduleUserId | null;
    readonly candidateId: CandidateId | null;
  }): Promise<ScheduleParticipantRecord>;
}
