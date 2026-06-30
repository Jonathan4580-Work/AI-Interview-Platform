import { describe, expect, it } from "vitest";

import { AuditWriter, type AuditEventStore, type PersistedAuditEventInput } from "@/modules/audit";
import { MonitoringDomainError, MonitoringService } from "@/modules/monitoring";

import type { CandidateSessionContext, CandidateSessionId } from "@/modules/candidate-portal";
import type { InterviewSessionId } from "@/modules/invitations";
import type {
  MonitoringBatchResult,
  MonitoringEventBatchId,
  MonitoringEventRecord,
  MonitoringEventSubmission,
  MonitoringRepository,
} from "@/modules/monitoring";
import type { TenantContext, TenantId } from "@/modules/tenant";

describe("monitoring warning service", () => {
  it("does not enable monitoring without explicit monitoring consent", async () => {
    const repo = new InMemoryMonitoringRepository();
    repo.hasConsent = false;
    const service = createService(repo);

    const config = await service.getCandidateConfiguration(candidateContext);

    expect(config.enabled).toBe(false);
    expect(config.disabledReason).toBe("monitoring_consent_required");
    await expect(
      service.ingestCandidateBatch(candidateContext, {
        idempotencyKey: "batch-1",
        detectorConfigVersion: "monitoring-v1",
        thresholdVersion: "monitoring-thresholds-v1",
        events: [focusEvent()],
      }),
    ).rejects.toBeInstanceOf(MonitoringDomainError);
  });

  it("aggregates thresholded warnings and rejects arbitrary metadata or clipboard content", async () => {
    const repo = new InMemoryMonitoringRepository();
    const service = createService(repo);

    const result = await service.ingestCandidateBatch(candidateContext, {
      idempotencyKey: "batch-1",
      detectorConfigVersion: "monitoring-v1",
      thresholdVersion: "monitoring-thresholds-v1",
      events: [
        focusEvent({ idempotencyKey: "event-1", aggregationKey: "focus-window-1" }),
        focusEvent({ idempotencyKey: "event-2", aggregationKey: "focus-window-1" }),
        {
          ...focusEvent({ idempotencyKey: "event-3", aggregationKey: "copy-1" }),
          type: "copy_occurred",
          detectorCategory: "activity",
          sourceDetector: "clipboard",
          metadata: {
            browser: "Chrome",
            clipboardText: "must-not-store",
            typedText: "must-not-store",
            sampleCount: 1,
          },
        },
      ],
    });

    expect(result).toMatchObject({ acceptedCount: 1, deduplicatedCount: 1, rejectedCount: 1 });
    expect(repo.events).toHaveLength(1);
    expect(repo.events[0]?.occurrenceCount).toBe(6);
    expect(JSON.stringify(repo.events)).not.toContain("must-not-store");
  });

  it("rejects weak single-sample face warnings and arbitrary event names", async () => {
    const repo = new InMemoryMonitoringRepository();
    const service = createService(repo);

    const result = await service.ingestCandidateBatch(candidateContext, {
      idempotencyKey: "batch-weak",
      detectorConfigVersion: "monitoring-v1",
      thresholdVersion: "monitoring-thresholds-v1",
      events: [
        {
          ...focusEvent(),
          type: "multiple_faces",
          detectorCategory: "multiple_face",
          sourceDetector: "local-face-presence",
          durationMs: 500,
          occurrenceCount: 1,
          confidence: 0.2,
        },
      ],
    });

    expect(result.rejectedCount).toBe(1);
    expect(repo.events).toHaveLength(0);
  });

  it("returns duplicate batch results idempotently", async () => {
    const repo = new InMemoryMonitoringRepository();
    const service = createService(repo);
    const input = {
      idempotencyKey: "batch-duplicate",
      detectorConfigVersion: "monitoring-v1",
      thresholdVersion: "monitoring-thresholds-v1",
      events: [focusEvent()],
    };

    await service.ingestCandidateBatch(candidateContext, input);
    const second = await service.ingestCandidateBatch(candidateContext, input);

    expect(second.status).toBe("duplicate");
    expect(repo.batches).toHaveLength(1);
  });

  it("keeps monitoring summaries neutral and review actions audited", async () => {
    const repo = new InMemoryMonitoringRepository();
    const auditStore = new InMemoryAuditStore();
    const service = new MonitoringService(repo, new AuditWriter(auditStore));
    await service.ingestCandidateBatch(candidateContext, {
      idempotencyKey: "batch-summary",
      detectorConfigVersion: "monitoring-v1",
      thresholdVersion: "monitoring-thresholds-v1",
      events: [focusEvent()],
    });

    const summary = await service.getSummary(internalContext, "interview_1" as InterviewSessionId);
    const event = repo.events[0];
    expect(event).toBeDefined();
    const reviewed = await service.reviewEvent({
      context: internalContext,
      interviewSessionId: "interview_1" as InterviewSessionId,
      eventId: event.id,
      reviewState: "acknowledged",
      reason: "Reviewed with the recording context.",
    });

    expect(summary.countsByType.window_focus_lost).toBe(3);
    expect(summary).not.toHaveProperty("cheatingScore");
    expect(summary).not.toHaveProperty("trustScore");
    expect(reviewed.reviewState).toBe("acknowledged");
    expect(auditStore.events.map((event) => event.action)).toContain(
      "monitoring.event_acknowledged",
    );
  });
});

const tenant: TenantContext = { companyId: "company_test" as TenantId };
const session: CandidateSessionContext = {
  companyId: tenant.companyId,
  sessionId: "candidate_session_1" as CandidateSessionId,
  candidateId: "candidate_1",
  invitationId: "invitation_1",
  interviewSessionId: "interview_1",
  expiresAt: new Date("2026-06-30T03:00:00.000Z"),
  csrfTokenHash: "csrf_hash",
};
const candidateContext = {
  session,
  request: {
    requestId: "req_1",
    correlationId: "corr_1",
    sessionId: session.sessionId,
    ipAddress: "127.0.0.1",
    userAgent: "vitest",
  },
};
const internalContext = {
  tenant,
  actor: { type: "user" as const, id: "user_1" },
  request: {
    requestId: "req_2",
    correlationId: "corr_2",
    sessionId: "auth_session_1",
    ipAddress: "127.0.0.1",
    userAgent: "vitest",
  },
};

function createService(repo: InMemoryMonitoringRepository) {
  return new MonitoringService(repo, new AuditWriter(new InMemoryAuditStore()));
}

function focusEvent(overrides: Partial<MonitoringEventSubmission> = {}): MonitoringEventSubmission {
  return {
    type: "window_focus_lost",
    occurredAt: new Date("2026-06-30T00:05:00.000Z"),
    endedAt: new Date("2026-06-30T00:05:04.000Z"),
    durationMs: 4_000,
    occurrenceCount: 3,
    confidence: 0.9,
    sourceDetector: "window-focus",
    detectorCategory: "window_focus",
    detectorVersion: "browser-v1",
    aggregationKey: "focus-window",
    idempotencyKey: "event-focus",
    metadata: { browser: "Chrome", sampleCount: 3 },
    ...overrides,
  };
}

class InMemoryAuditStore implements AuditEventStore {
  public readonly events: PersistedAuditEventInput[] = [];

  public append(event: PersistedAuditEventInput): Promise<void> {
    this.events.push(event);
    return Promise.resolve();
  }
}

class InMemoryMonitoringRepository implements MonitoringRepository {
  public hasConsent = true;
  public exempt = false;
  public readonly batches: MonitoringBatchResult[] = [];
  public readonly batchKeys = new Map<string, MonitoringBatchResult>();
  public readonly events: MonitoringEventRecord[] = [];

  public getCandidateInterview() {
    return Promise.resolve({
      id: "interview_1" as InterviewSessionId,
      companyId: tenant.companyId,
      candidateId: "candidate_1",
      status: "in_progress",
    });
  }

  public hasAcceptedMonitoringConsent(): Promise<boolean> {
    return Promise.resolve(this.hasConsent);
  }

  public hasAccommodationExemption(): Promise<boolean> {
    return Promise.resolve(this.exempt);
  }

  public findBatchByIdempotency(input: { readonly idempotencyKey: string }) {
    return Promise.resolve(this.batchKeys.get(input.idempotencyKey) ?? null);
  }

  public createBatch(input: Parameters<MonitoringRepository["createBatch"]>[0]) {
    const result: MonitoringBatchResult = {
      status: input.status,
      acceptedCount: input.acceptedCount,
      rejectedCount: input.rejectedCount,
      deduplicatedCount: input.deduplicatedCount,
    };
    this.batches.push(result);
    this.batchKeys.set(input.idempotencyKey, result);
    return Promise.resolve("batch_1" as MonitoringEventBatchId);
  }

  public upsertAggregatedEvent(
    input: Parameters<MonitoringRepository["upsertAggregatedEvent"]>[0],
  ) {
    const existingIndex = this.events.findIndex(
      (event) => event.aggregationKey === input.event.aggregationKey,
    );
    if (existingIndex >= 0) {
      const existing = this.events[existingIndex];
      const updated = {
        ...existing,
        occurrenceCount: existing.occurrenceCount + (input.event.occurrenceCount ?? 1),
        durationMs: (existing.durationMs ?? 0) + (input.event.durationMs ?? 0),
      };
      this.events[existingIndex] = updated;
      return Promise.resolve({ created: false, record: updated });
    }
    const now = new Date("2026-06-30T00:05:00.000Z");
    const record: MonitoringEventRecord = {
      id: `monitoring_event_${String(this.events.length + 1)}` as never,
      companyId: input.companyId,
      interviewSessionId: input.interviewSessionId,
      candidateId: input.candidateId,
      type: input.event.type,
      severity: input.severity,
      reviewState: "unreviewed",
      sourceDetector: input.event.sourceDetector,
      detectorCategory: input.event.detectorCategory,
      detectorVersion: input.event.detectorVersion,
      thresholdVersion: input.thresholdVersion,
      occurredAt: input.event.occurredAt,
      endedAt: input.event.endedAt ?? null,
      durationMs: input.event.durationMs ?? null,
      occurrenceCount: input.event.occurrenceCount ?? 1,
      confidence: input.event.confidence ?? null,
      safeMetadata: input.safeMetadata,
      aggregationKey: input.event.aggregationKey,
      retentionDeleteAt: input.retentionDeleteAt,
      legalHoldActive: false,
      reviewedAt: null,
      reviewReason: null,
      createdAt: now,
      updatedAt: now,
    };
    this.events.push(record);
    return Promise.resolve({ created: true, record });
  }

  public listTimeline(): Promise<readonly MonitoringEventRecord[]> {
    return Promise.resolve(this.events);
  }

  public summarize(): ReturnType<MonitoringRepository["summarize"]> {
    const countsByType: Record<string, number | undefined> = Object.fromEntries(
      this.events.map((event) => [event.type, event.occurrenceCount]),
    );
    return Promise.resolve({
      interviewSessionId: "interview_1" as InterviewSessionId,
      totalWarnings: this.events.length,
      countsByType,
      durationMsByType: {},
      focusLossPeriods: countsByType.window_focus_lost ?? 0,
      faceMissingPeriods: countsByType.face_not_detected ?? 0,
      multipleFaceWarningsOccurred: false,
      connectionInstabilityWarnings: 0,
      detectorAvailability: { unavailableWarnings: 0, unavailableDurationMs: 0 },
    });
  }

  public reviewEvent(input: Parameters<MonitoringRepository["reviewEvent"]>[0]) {
    const index = this.events.findIndex((event) => event.id === input.eventId);
    if (index < 0) return Promise.resolve(null);
    const updated = {
      ...this.events[index],
      reviewState: input.reviewState,
      reviewedAt: input.reviewedAt,
      reviewReason: input.reason,
    };
    this.events[index] = updated;
    return Promise.resolve(updated);
  }
}
