import { createHash } from "node:crypto";

import { AuditWriter } from "@/modules/audit";

import type {
  CandidateMonitoringContext,
  MonitoringBatchResult,
  MonitoringBatchSubmission,
  MonitoringConfigurationView,
  MonitoringEventRecord,
  MonitoringEventSubmission,
  MonitoringEventType,
  MonitoringMutationContext,
  MonitoringRepository,
  MonitoringReviewState,
  MonitoringSummary,
  MonitoringThreshold,
} from "./types";
import type { InterviewSessionId } from "@/modules/invitations";

const CONFIG_VERSION = "monitoring-v1";
const POLICY_VERSION = "candidate-monitoring-policy-v1";
const THRESHOLD_VERSION = "monitoring-thresholds-v1";
const MAX_BATCH_EVENTS = 25;
const MAX_PAYLOAD_BYTES = 24_000;
const RETENTION_DAYS = 180;

const allowedMetadataKeys = new Set([
  "browser",
  "connectionState",
  "effectiveType",
  "sampleCount",
  "visibilityState",
  "recordingState",
  "reason",
  "weakEvidence",
]);

export const monitoringThresholds: Record<MonitoringEventType, MonitoringThreshold> = {
  looking_away: {
    minDurationMs: 8_000,
    minOccurrences: 2,
    cooldownMs: 30_000,
    minConfidence: 0.65,
    severity: "low",
  },
  multiple_faces: {
    minDurationMs: 3_000,
    minOccurrences: 2,
    cooldownMs: 45_000,
    minConfidence: 0.7,
    severity: "medium",
  },
  face_not_detected: {
    minDurationMs: 5_000,
    minOccurrences: 2,
    cooldownMs: 30_000,
    minConfidence: 0.65,
    severity: "medium",
  },
  left_frame: {
    minDurationMs: 5_000,
    minOccurrences: 2,
    cooldownMs: 30_000,
    minConfidence: 0.65,
    severity: "medium",
  },
  camera_obstructed: {
    minDurationMs: 5_000,
    minOccurrences: 2,
    cooldownMs: 45_000,
    minConfidence: 0.7,
    severity: "medium",
  },
  camera_permission_removed: {
    minDurationMs: 1_000,
    minOccurrences: 1,
    cooldownMs: 30_000,
    severity: "high",
  },
  microphone_unavailable: {
    minDurationMs: 1_000,
    minOccurrences: 1,
    cooldownMs: 30_000,
    severity: "high",
  },
  window_focus_lost: { minDurationMs: 0, minOccurrences: 3, cooldownMs: 60_000, severity: "low" },
  tab_hidden: { minDurationMs: 3_000, minOccurrences: 2, cooldownMs: 60_000, severity: "low" },
  fullscreen_exited: {
    minDurationMs: 0,
    minOccurrences: 1,
    cooldownMs: 60_000,
    severity: "informational",
  },
  copy_occurred: {
    minDurationMs: 0,
    minOccurrences: 1,
    cooldownMs: 60_000,
    severity: "informational",
  },
  paste_occurred: {
    minDurationMs: 0,
    minOccurrences: 1,
    cooldownMs: 60_000,
    severity: "informational",
  },
  network_degraded: {
    minDurationMs: 10_000,
    minOccurrences: 2,
    cooldownMs: 45_000,
    severity: "medium",
  },
  connection_lost: {
    minDurationMs: 10_000,
    minOccurrences: 1,
    cooldownMs: 45_000,
    severity: "high",
  },
  recording_interrupted: {
    minDurationMs: 0,
    minOccurrences: 1,
    cooldownMs: 30_000,
    severity: "high",
  },
  repeated_resume: { minDurationMs: 0, minOccurrences: 2, cooldownMs: 120_000, severity: "low" },
  extended_inactivity: {
    minDurationMs: 60_000,
    minOccurrences: 1,
    cooldownMs: 120_000,
    severity: "medium",
  },
  monitoring_unavailable: {
    minDurationMs: 10_000,
    minOccurrences: 1,
    cooldownMs: 60_000,
    severity: "medium",
  },
};

export class MonitoringDomainError extends Error {
  public constructor(
    message: string,
    public readonly code: "forbidden" | "invalid_state" | "validation_failed" | "not_found",
  ) {
    super(message);
    this.name = "MonitoringDomainError";
  }
}

export class MonitoringService {
  public constructor(
    private readonly repository: MonitoringRepository,
    private readonly auditWriter: AuditWriter,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async getCandidateConfiguration(
    context: CandidateMonitoringContext,
  ): Promise<MonitoringConfigurationView> {
    const interview = await this.repository.getCandidateInterview({ session: context.session });
    if (interview === null) {
      return this.disabledConfig("interview_not_started");
    }
    const hasConsent = await this.repository.hasAcceptedMonitoringConsent(context.session);
    if (!hasConsent) {
      return this.disabledConfig("monitoring_consent_required");
    }
    const exempt = await this.repository.hasAccommodationExemption(context.session);
    if (exempt) {
      return this.disabledConfig("accommodation_exemption");
    }
    return enabledConfig();
  }

  public async ingestCandidateBatch(
    context: CandidateMonitoringContext,
    batch: MonitoringBatchSubmission,
  ): Promise<MonitoringBatchResult> {
    const config = await this.getCandidateConfiguration(context);
    if (!config.enabled) {
      throw new MonitoringDomainError("Monitoring is not enabled for this session.", "forbidden");
    }
    if (
      batch.detectorConfigVersion !== CONFIG_VERSION ||
      batch.thresholdVersion !== THRESHOLD_VERSION
    ) {
      throw new MonitoringDomainError(
        "Monitoring configuration version is invalid.",
        "validation_failed",
      );
    }
    if (batch.events.length === 0 || batch.events.length > MAX_BATCH_EVENTS) {
      throw new MonitoringDomainError("Monitoring batch size is invalid.", "validation_failed");
    }
    const payloadBytes = Buffer.byteLength(JSON.stringify(batch), "utf8");
    if (payloadBytes > MAX_PAYLOAD_BYTES) {
      throw new MonitoringDomainError(
        "Monitoring batch payload is too large.",
        "validation_failed",
      );
    }
    const idempotencyKey = scopedKey(context.session.sessionId, batch.idempotencyKey);
    const duplicate = await this.repository.findBatchByIdempotency({
      companyId: context.session.companyId,
      idempotencyKey,
    });
    if (duplicate !== null) return { ...duplicate, status: "duplicate" };

    const interview = await this.repository.getCandidateInterview({ session: context.session });
    if (interview === null) {
      throw new MonitoringDomainError("Interview was not found.", "not_found");
    }

    let acceptedCount = 0;
    let rejectedCount = 0;
    let deduplicatedCount = 0;
    const accepted: {
      readonly event: MonitoringEventSubmission;
      readonly safeMetadata: Record<string, unknown>;
      readonly severity: MonitoringThreshold["severity"];
    }[] = [];
    for (const event of batch.events) {
      const normalized = normalizeEvent(event);
      const threshold = monitoringThresholds[normalized.type];
      if (!passesThreshold(normalized, threshold)) {
        rejectedCount += 1;
        continue;
      }
      const safeMetadata = trySanitizeMetadata(normalized.metadata ?? {});
      if (safeMetadata === null) {
        rejectedCount += 1;
        continue;
      }
      accepted.push({ event: normalized, safeMetadata, severity: threshold.severity });
    }

    const batchId = await this.repository.createBatch({
      companyId: context.session.companyId,
      interviewSessionId: interview.id,
      candidateId: interview.candidateId,
      candidateSessionId: context.session.sessionId,
      idempotencyKey,
      status: accepted.length === batch.events.length ? "accepted" : "partially_accepted",
      acceptedCount: accepted.length,
      rejectedCount,
      deduplicatedCount: 0,
      payloadHash: hashPayload(batch),
      metadata: {
        schemaVersion: 1,
        detectorConfigVersion: batch.detectorConfigVersion,
        thresholdVersion: batch.thresholdVersion,
      },
      receivedAt: this.now(),
    });

    for (const item of accepted) {
      const result = await this.repository.upsertAggregatedEvent({
        companyId: context.session.companyId,
        interviewSessionId: interview.id,
        candidateId: interview.candidateId,
        batchId,
        event: item.event,
        severity: item.severity,
        thresholdVersion: THRESHOLD_VERSION,
        safeMetadata: item.safeMetadata,
        retentionDeleteAt: addDays(this.now(), RETENTION_DAYS),
      });
      if (result.created) {
        acceptedCount += 1;
      } else {
        deduplicatedCount += 1;
      }
    }

    return {
      status: acceptedCount === batch.events.length ? "accepted" : "partially_accepted",
      acceptedCount,
      rejectedCount,
      deduplicatedCount,
    };
  }

  public async getTimeline(
    context: MonitoringMutationContext,
    interviewSessionId: InterviewSessionId,
    limit = 100,
  ): Promise<readonly MonitoringEventRecord[]> {
    await this.auditWriter.record({
      companyId: context.tenant.companyId,
      actor: context.actor,
      request: context.request,
      supportAccessSessionId: context.supportAccessSessionId,
      action: "monitoring.timeline_accessed",
      resourceType: "interview_session",
      resourceId: interviewSessionId,
      riskLevel: "medium",
      metadata: { limit },
    });
    return this.repository.listTimeline({
      tenant: context.tenant,
      interviewSessionId,
      limit: Math.min(Math.max(limit, 1), 200),
    });
  }

  public getSummary(
    context: MonitoringMutationContext,
    interviewSessionId: InterviewSessionId,
  ): Promise<MonitoringSummary> {
    return this.repository.summarize({ tenant: context.tenant, interviewSessionId });
  }

  public async reviewEvent(input: {
    readonly context: MonitoringMutationContext;
    readonly eventId: MonitoringEventRecord["id"];
    readonly reviewState: Exclude<MonitoringReviewState, "unreviewed">;
    readonly reason: string;
  }): Promise<MonitoringEventRecord> {
    const reason = sanitizeReason(input.reason);
    const reviewed = await this.repository.reviewEvent({
      tenant: input.context.tenant,
      eventId: input.eventId,
      reviewState: input.reviewState,
      reviewedByUserId: input.context.actor.type === "user" ? input.context.actor.id : null,
      reviewedAt: this.now(),
      reason,
    });
    if (reviewed === null) {
      throw new MonitoringDomainError("Monitoring event was not found.", "not_found");
    }
    await this.auditWriter.record({
      companyId: input.context.tenant.companyId,
      actor: input.context.actor,
      request: input.context.request,
      supportAccessSessionId: input.context.supportAccessSessionId,
      action: `monitoring.event_${input.reviewState}`,
      resourceType: "monitoring_event",
      resourceId: reviewed.id,
      reason,
      riskLevel: "medium",
      after: { reviewState: reviewed.reviewState },
    });
    return reviewed;
  }

  private disabledConfig(disabledReason: string): MonitoringConfigurationView {
    return { ...enabledConfig(), enabled: false, disabledReason };
  }
}

function enabledConfig(): MonitoringConfigurationView {
  return {
    enabled: true,
    consentRequired: true,
    policyVersion: POLICY_VERSION,
    detectorConfigVersion: CONFIG_VERSION,
    thresholdVersion: THRESHOLD_VERSION,
    batch: {
      flushIntervalMs: 15_000,
      maxEvents: MAX_BATCH_EVENTS,
      maxPayloadBytes: MAX_PAYLOAD_BYTES,
    },
    detectors: {
      camera_presence: true,
      multiple_face: true,
      face_position: true,
      camera_obstruction: true,
      page_visibility: true,
      window_focus: true,
      network_quality: true,
      recording_health: true,
      activity: true,
    },
    thresholds: monitoringThresholds,
    disabledReason: null,
  };
}

function normalizeEvent(event: MonitoringEventSubmission): MonitoringEventSubmission {
  const confidence =
    event.confidence === null || event.confidence === undefined
      ? null
      : Math.max(0, Math.min(1, event.confidence));
  return {
    ...event,
    sourceDetector: safeToken(event.sourceDetector, "sourceDetector"),
    detectorVersion: safeToken(event.detectorVersion, "detectorVersion"),
    aggregationKey: safeToken(event.aggregationKey, "aggregationKey"),
    idempotencyKey: safeToken(event.idempotencyKey, "idempotencyKey"),
    occurrenceCount: event.occurrenceCount ?? 1,
    confidence,
  };
}

function passesThreshold(
  event: MonitoringEventSubmission,
  threshold: MonitoringThreshold,
): boolean {
  if ((event.durationMs ?? 0) < threshold.minDurationMs) return false;
  if ((event.occurrenceCount ?? 1) < threshold.minOccurrences) return false;
  if (threshold.minConfidence !== undefined && (event.confidence ?? 1) < threshold.minConfidence) {
    return false;
  }
  return true;
}

function trySanitizeMetadata(value: Record<string, unknown>): Record<string, unknown> | null {
  const safe: Record<string, unknown> = { schemaVersion: 1 };
  for (const [key, entry] of Object.entries(value)) {
    if (!allowedMetadataKeys.has(key)) return null;
    if (typeof entry === "string") safe[key] = entry.slice(0, 160);
    if (typeof entry === "number" && Number.isFinite(entry)) safe[key] = entry;
    if (typeof entry === "boolean") safe[key] = entry;
  }
  return safe;
}

function scopedKey(sessionId: string, key: string): string {
  return `${sessionId}:${safeToken(key, "idempotencyKey")}`;
}

function safeToken(value: string, label: string): string {
  const normalized = value.trim();
  if (!/^[a-zA-Z0-9_.:-]{1,160}$/u.test(normalized)) {
    throw new MonitoringDomainError(`${label} is invalid.`, "validation_failed");
  }
  return normalized;
}

function sanitizeReason(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length < 3 || normalized.length > 500) {
    throw new MonitoringDomainError("Review reason is invalid.", "validation_failed");
  }
  return normalized;
}

function hashPayload(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
