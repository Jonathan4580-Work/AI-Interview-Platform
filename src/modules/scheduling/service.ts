import { AuditWriter } from "@/modules/audit";
import { normalizeDisplayName } from "@/modules/organization";

import type {
  ScheduleEventId,
  ScheduleEventRecord,
  ScheduleParticipantRecord,
  SchedulingMutationContext,
  SchedulingRepository,
} from "./types";
import type { CandidateId } from "@/modules/candidates";

export class SchedulingDomainError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "SchedulingDomainError";
  }
}

export class SchedulingService {
  public constructor(
    private readonly repository: SchedulingRepository,
    private readonly auditWriter: AuditWriter,
  ) {}

  public async createEvent(input: {
    readonly context: SchedulingMutationContext;
    readonly type: ScheduleEventRecord["type"];
    readonly title: string;
    readonly description?: string | null;
    readonly startsAt: Date;
    readonly endsAt: Date;
    readonly timeZone: string;
    readonly provider?: ScheduleEventRecord["provider"];
    readonly targetResourceType?: string | null;
    readonly targetResourceId?: string | null;
    readonly metadata?: Record<string, unknown>;
  }): Promise<ScheduleEventRecord> {
    validateTimeRange(input.startsAt, input.endsAt);
    const event = await this.repository.createEvent({
      companyId: input.context.tenant.companyId,
      type: input.type,
      title: normalizeDisplayName(input.title, "Schedule event title"),
      description: normalizeOptionalText(input.description, 500, "Schedule event description"),
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      timeZone: normalizeTimeZone(input.timeZone),
      provider: input.provider ?? "internal",
      targetResourceType: normalizeOptionalIdentifier(input.targetResourceType ?? null),
      targetResourceId: normalizeOptionalIdentifier(input.targetResourceId ?? null),
      metadata: input.metadata ?? {},
    });
    await this.writeAudit(input.context, "scheduling.event_created", "schedule_event", event.id, {
      after: event,
    });
    return event;
  }

  public async cancelEvent(input: {
    readonly context: SchedulingMutationContext;
    readonly eventId: ScheduleEventId;
  }): Promise<ScheduleEventRecord> {
    const existing = await this.requireEvent(input.context, input.eventId);
    if (existing.status !== "scheduled") {
      throw new SchedulingDomainError("Only scheduled events can be cancelled.");
    }
    const event = await this.repository.cancelEvent({
      companyId: input.context.tenant.companyId,
      eventId: input.eventId,
      cancelledAt: new Date(),
    });
    await this.writeAudit(input.context, "scheduling.event_cancelled", "schedule_event", event.id, {
      before: existing,
      after: event,
    });
    return event;
  }

  public async addParticipant(input: {
    readonly context: SchedulingMutationContext;
    readonly scheduleEventId: ScheduleEventId;
    readonly type: ScheduleParticipantRecord["type"];
    readonly displayName: string;
    readonly email?: string | null;
    readonly userId?: ScheduleParticipantRecord["userId"];
    readonly candidateId?: CandidateId | null;
  }): Promise<ScheduleParticipantRecord> {
    const event = await this.requireEvent(input.context, input.scheduleEventId);
    if (event.status !== "scheduled") {
      throw new SchedulingDomainError("Participants can only be added to scheduled events.");
    }
    validateParticipantIdentity(input.type, input.userId ?? null, input.candidateId ?? null);
    const participant = await this.repository.addParticipant({
      companyId: input.context.tenant.companyId,
      scheduleEventId: input.scheduleEventId,
      type: input.type,
      displayName: normalizeDisplayName(input.displayName, "Participant name"),
      email: normalizeEmail(input.email ?? null),
      userId: input.userId ?? null,
      candidateId: input.candidateId ?? null,
    });
    await this.writeAudit(
      input.context,
      "scheduling.participant_added",
      "schedule_participant",
      participant.id,
      {
        after: participant,
      },
    );
    return participant;
  }

  private async requireEvent(
    context: SchedulingMutationContext,
    eventId: ScheduleEventId,
  ): Promise<ScheduleEventRecord> {
    const event = await this.repository.findEvent(context.tenant, eventId);
    if (event === null) {
      throw new SchedulingDomainError("Schedule event was not found for this company.");
    }
    return event;
  }

  private async writeAudit(
    context: SchedulingMutationContext,
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

function validateTimeRange(startsAt: Date, endsAt: Date): void {
  if (endsAt <= startsAt) {
    throw new SchedulingDomainError("Schedule event end time must be after start time.");
  }
}

function normalizeTimeZone(value: string): string {
  const normalized = value.trim();
  try {
    Intl.DateTimeFormat(undefined, { timeZone: normalized });
  } catch {
    throw new SchedulingDomainError("Schedule event time zone must be valid.");
  }
  return normalized;
}

function normalizeOptionalText(
  value: string | null | undefined,
  maxLength: number,
  label: string,
): string | null {
  if (value === null || value === undefined || value.trim().length === 0) {
    return null;
  }
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length > maxLength) {
    throw new SchedulingDomainError(`${label} cannot exceed ${String(maxLength)} characters.`);
  }
  return normalized;
}

function normalizeOptionalIdentifier(value: string | null): string | null {
  if (value === null || value.trim().length === 0) {
    return null;
  }
  return value.trim();
}

function normalizeEmail(value: string | null): string | null {
  if (value === null || value.trim().length === 0) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new SchedulingDomainError("Participant email must be valid.");
  }
  return normalized;
}

function validateParticipantIdentity(
  type: ScheduleParticipantRecord["type"],
  userId: ScheduleParticipantRecord["userId"],
  candidateId: CandidateId | null,
): void {
  if (type === "user" && userId === null) {
    throw new SchedulingDomainError("User participants require a user id.");
  }
  if (type === "candidate" && candidateId === null) {
    throw new SchedulingDomainError("Candidate participants require a candidate id.");
  }
}
