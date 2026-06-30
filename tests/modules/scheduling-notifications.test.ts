import { describe, expect, it } from "vitest";

import { AuditWriter } from "@/modules/audit";
import { NotificationsDomainError, NotificationsService } from "@/modules/notifications";
import { SchedulingDomainError, SchedulingService } from "@/modules/scheduling";
import { createTenantContext } from "@/modules/tenant";

import type { AuditEventStore, PersistedAuditEventInput } from "@/modules/audit";
import type { CandidateId } from "@/modules/candidates";
import type {
  NotificationIntentId,
  NotificationIntentRecord,
  NotificationsRepository,
} from "@/modules/notifications";
import type {
  ScheduleEventId,
  ScheduleEventRecord,
  ScheduleParticipantId,
  ScheduleParticipantRecord,
  SchedulingRepository,
} from "@/modules/scheduling";
import type { CompanyUserId, TenantContext, TenantId } from "@/modules/tenant";

const tenant = createTenantContext("cm0tenant001");
const actor = { type: "user" as const, id: "user-1" as CompanyUserId };
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

class MemorySchedulingRepository implements SchedulingRepository {
  public readonly events = new Map<string, ScheduleEventRecord>();

  public createEvent(input: Parameters<SchedulingRepository["createEvent"]>[0]) {
    const event: ScheduleEventRecord = {
      id: `sched-${String(this.events.size + 1)}` as ScheduleEventId,
      companyId: input.companyId,
      type: input.type,
      status: "scheduled",
      title: input.title,
      description: input.description,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      timeZone: input.timeZone,
      provider: input.provider,
      providerEventRef: null,
      targetResourceType: input.targetResourceType,
      targetResourceId: input.targetResourceId,
      metadata: input.metadata,
      createdAt: now(),
      updatedAt: now(),
      cancelledAt: null,
    };
    this.events.set(key(input.companyId, event.id), event);
    return Promise.resolve(event);
  }

  public findEvent(tenantContext: TenantContext, eventId: ScheduleEventId) {
    return Promise.resolve(this.events.get(key(tenantContext.companyId, eventId)) ?? null);
  }

  public cancelEvent(input: Parameters<SchedulingRepository["cancelEvent"]>[0]) {
    const event = this.events.get(key(input.companyId, input.eventId));
    if (event === undefined) {
      throw new Error("Event missing");
    }
    const cancelled: ScheduleEventRecord = {
      ...event,
      status: "cancelled",
      cancelledAt: input.cancelledAt,
      updatedAt: now(),
    };
    this.events.set(key(input.companyId, input.eventId), cancelled);
    return Promise.resolve(cancelled);
  }

  public addParticipant(input: Parameters<SchedulingRepository["addParticipant"]>[0]) {
    return Promise.resolve({
      id: "participant-1" as ScheduleParticipantId,
      companyId: input.companyId,
      scheduleEventId: input.scheduleEventId,
      type: input.type,
      displayName: input.displayName,
      email: input.email,
      userId: input.userId,
      candidateId: input.candidateId,
      responseStatus: "needs_action",
      createdAt: now(),
      updatedAt: now(),
    } satisfies ScheduleParticipantRecord);
  }
}

class MemoryNotificationsRepository implements NotificationsRepository {
  public readonly intents = new Map<string, NotificationIntentRecord>();

  public createIntent(input: Parameters<NotificationsRepository["createIntent"]>[0]) {
    const intent: NotificationIntentRecord = {
      id: `intent-${String(this.intents.size + 1)}` as NotificationIntentId,
      companyId: input.companyId,
      type: input.type,
      channel: input.channel,
      status: "pending",
      recipientEmail: input.recipientEmail,
      recipientName: input.recipientName,
      targetResourceType: input.targetResourceType,
      targetResourceId: input.targetResourceId,
      payload: input.payload,
      scheduledFor: input.scheduledFor,
      dispatchedAt: null,
      cancelledAt: null,
      failureReason: null,
      createdAt: now(),
      updatedAt: now(),
    };
    this.intents.set(key(input.companyId, intent.id), intent);
    return Promise.resolve(intent);
  }

  public findIntent(tenantContext: TenantContext, intentId: NotificationIntentId) {
    return Promise.resolve(this.intents.get(key(tenantContext.companyId, intentId)) ?? null);
  }

  public cancelIntent(input: Parameters<NotificationsRepository["cancelIntent"]>[0]) {
    const intent = this.intents.get(key(input.companyId, input.intentId));
    if (intent === undefined) {
      throw new Error("Intent missing");
    }
    const cancelled: NotificationIntentRecord = {
      ...intent,
      status: "cancelled",
      cancelledAt: input.cancelledAt,
      updatedAt: now(),
    };
    this.intents.set(key(input.companyId, input.intentId), cancelled);
    return Promise.resolve(cancelled);
  }
}

describe("scheduling and notification domains", () => {
  it("creates schedule events and validates participants", async () => {
    const auditStore = new RecordingAuditStore();
    const service = new SchedulingService(
      new MemorySchedulingRepository(),
      new AuditWriter(auditStore),
    );

    const event = await service.createEvent({
      context: { tenant, actor, request },
      type: "interview",
      title: " Candidate Screen ",
      startsAt: new Date("2026-07-01T10:00:00.000Z"),
      endsAt: new Date("2026-07-01T10:30:00.000Z"),
      timeZone: "Asia/Colombo",
      targetResourceType: "interview_session",
      targetResourceId: "session-1",
    });
    const participant = await service.addParticipant({
      context: { tenant, actor, request },
      scheduleEventId: event.id,
      type: "candidate",
      displayName: "Ada Candidate",
      candidateId: "candidate-1" as CandidateId,
      email: "ADA@EXAMPLE.COM",
    });

    expect(event.title).toBe("Candidate Screen");
    expect(participant.email).toBe("ada@example.com");
    await expect(
      service.createEvent({
        context: { tenant, actor, request },
        type: "interview",
        title: "Bad Range",
        startsAt: new Date("2026-07-01T10:00:00.000Z"),
        endsAt: new Date("2026-07-01T09:00:00.000Z"),
        timeZone: "Asia/Colombo",
      }),
    ).rejects.toBeInstanceOf(SchedulingDomainError);
    expect(auditStore.events.map((eventRecord) => eventRecord.action)).toContain(
      "scheduling.participant_added",
    );
  });

  it("creates and cancels notification intents without delivery", async () => {
    const service = new NotificationsService(
      new MemoryNotificationsRepository(),
      new AuditWriter(new RecordingAuditStore()),
    );

    const intent = await service.createIntent({
      context: { tenant, actor, request },
      type: "invitation_created",
      recipientEmail: "CANDIDATE@EXAMPLE.COM",
      recipientName: " Candidate ",
      targetResourceType: "candidate_invitation",
      targetResourceId: "invite-1",
      payload: { invitationId: "invite-1" },
    });
    const cancelled = await service.cancelIntent({
      context: { tenant, actor, request },
      intentId: intent.id,
    });

    expect(intent.recipientEmail).toBe("candidate@example.com");
    expect(cancelled.status).toBe("cancelled");
    await expect(
      service.cancelIntent({ context: { tenant, actor, request }, intentId: intent.id }),
    ).rejects.toBeInstanceOf(NotificationsDomainError);
  });
});

function now(): Date {
  return new Date("2026-06-30T00:00:00.000Z");
}

function key(companyId: TenantId, id: string): string {
  return `${companyId}:${id}`;
}
