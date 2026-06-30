import type { AuditActor, AuditRequestContext } from "@/modules/audit";
import type { CandidateSessionContext } from "@/modules/candidate-portal";
import type { InterviewSessionId } from "@/modules/invitations";
import type { TenantContext, TenantId } from "@/modules/tenant";
import type { Brand } from "@/shared";

export type MonitoringEventId = Brand<string, "MonitoringEventId">;
export type MonitoringEventBatchId = Brand<string, "MonitoringEventBatchId">;

export const monitoringEventTypes = [
  "looking_away",
  "multiple_faces",
  "face_not_detected",
  "left_frame",
  "camera_obstructed",
  "camera_permission_removed",
  "microphone_unavailable",
  "window_focus_lost",
  "tab_hidden",
  "fullscreen_exited",
  "copy_occurred",
  "paste_occurred",
  "network_degraded",
  "connection_lost",
  "recording_interrupted",
  "repeated_resume",
  "extended_inactivity",
  "monitoring_unavailable",
] as const;

export type MonitoringEventType = (typeof monitoringEventTypes)[number];
export type MonitoringSeverity = "informational" | "low" | "medium" | "high";
export type MonitoringReviewState = "unreviewed" | "acknowledged" | "dismissed" | "noted";
export type MonitoringDetectorCategory =
  | "camera_presence"
  | "multiple_face"
  | "face_position"
  | "camera_obstruction"
  | "page_visibility"
  | "window_focus"
  | "network_quality"
  | "recording_health"
  | "activity";

export type MonitoringBatchStatus = "accepted" | "partially_accepted" | "rejected" | "duplicate";

export interface MonitoringMutationContext {
  readonly tenant: TenantContext;
  readonly actor: AuditActor;
  readonly request: AuditRequestContext;
  readonly supportAccessSessionId?: string | null;
}

export interface CandidateMonitoringContext {
  readonly session: CandidateSessionContext;
  readonly request: AuditRequestContext;
}

export interface MonitoringThreshold {
  readonly minDurationMs: number;
  readonly minOccurrences: number;
  readonly cooldownMs: number;
  readonly minConfidence?: number;
  readonly severity: MonitoringSeverity;
}

export interface MonitoringConfigurationView {
  readonly enabled: boolean;
  readonly consentRequired: boolean;
  readonly policyVersion: string;
  readonly detectorConfigVersion: string;
  readonly thresholdVersion: string;
  readonly batch: {
    readonly flushIntervalMs: number;
    readonly maxEvents: number;
    readonly maxPayloadBytes: number;
  };
  readonly detectors: Record<MonitoringDetectorCategory, boolean>;
  readonly thresholds: Record<MonitoringEventType, MonitoringThreshold>;
  readonly disabledReason: string | null;
}

export interface MonitoringEventSubmission {
  readonly type: MonitoringEventType;
  readonly occurredAt: Date;
  readonly endedAt?: Date | null;
  readonly durationMs?: number | null;
  readonly occurrenceCount?: number;
  readonly confidence?: number | null;
  readonly sourceDetector: string;
  readonly detectorCategory: MonitoringDetectorCategory;
  readonly detectorVersion: string;
  readonly aggregationKey: string;
  readonly idempotencyKey: string;
  readonly metadata?: Record<string, unknown>;
}

export interface MonitoringBatchSubmission {
  readonly idempotencyKey: string;
  readonly detectorConfigVersion: string;
  readonly thresholdVersion: string;
  readonly events: readonly MonitoringEventSubmission[];
}

export interface MonitoringEventRecord {
  readonly id: MonitoringEventId;
  readonly companyId: TenantId;
  readonly interviewSessionId: InterviewSessionId;
  readonly candidateId: string;
  readonly type: MonitoringEventType;
  readonly severity: MonitoringSeverity;
  readonly reviewState: MonitoringReviewState;
  readonly sourceDetector: string;
  readonly detectorCategory: MonitoringDetectorCategory;
  readonly detectorVersion: string;
  readonly thresholdVersion: string;
  readonly occurredAt: Date;
  readonly endedAt: Date | null;
  readonly durationMs: number | null;
  readonly occurrenceCount: number;
  readonly confidence: number | null;
  readonly safeMetadata: Record<string, unknown>;
  readonly aggregationKey: string;
  readonly retentionDeleteAt: Date;
  readonly legalHoldActive: boolean;
  readonly reviewedAt: Date | null;
  readonly reviewReason: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface MonitoringBatchResult {
  readonly status: MonitoringBatchStatus;
  readonly acceptedCount: number;
  readonly rejectedCount: number;
  readonly deduplicatedCount: number;
}

export interface MonitoringSummary {
  readonly interviewSessionId: InterviewSessionId;
  readonly totalWarnings: number;
  readonly countsByType: Partial<Record<MonitoringEventType, number>>;
  readonly durationMsByType: Partial<Record<MonitoringEventType, number>>;
  readonly focusLossPeriods: number;
  readonly faceMissingPeriods: number;
  readonly multipleFaceWarningsOccurred: boolean;
  readonly connectionInstabilityWarnings: number;
  readonly detectorAvailability: {
    readonly unavailableWarnings: number;
    readonly unavailableDurationMs: number;
  };
}

export interface MonitoringRepository {
  getCandidateInterview(input: { readonly session: CandidateSessionContext }): Promise<{
    readonly id: InterviewSessionId;
    readonly companyId: TenantId;
    readonly candidateId: string;
    readonly status: string;
  } | null>;

  hasAcceptedMonitoringConsent(session: CandidateSessionContext): Promise<boolean>;

  hasAccommodationExemption(session: CandidateSessionContext): Promise<boolean>;

  findBatchByIdempotency(input: {
    readonly companyId: TenantId;
    readonly idempotencyKey: string;
  }): Promise<MonitoringBatchResult | null>;

  createBatch(input: {
    readonly companyId: TenantId;
    readonly interviewSessionId: InterviewSessionId;
    readonly candidateId: string;
    readonly candidateSessionId: string | null;
    readonly idempotencyKey: string;
    readonly status: MonitoringBatchStatus;
    readonly acceptedCount: number;
    readonly rejectedCount: number;
    readonly deduplicatedCount: number;
    readonly payloadHash: string;
    readonly metadata: Record<string, unknown>;
    readonly receivedAt: Date;
  }): Promise<MonitoringEventBatchId>;

  upsertAggregatedEvent(input: {
    readonly companyId: TenantId;
    readonly interviewSessionId: InterviewSessionId;
    readonly candidateId: string;
    readonly batchId: MonitoringEventBatchId;
    readonly event: MonitoringEventSubmission;
    readonly severity: MonitoringSeverity;
    readonly thresholdVersion: string;
    readonly safeMetadata: Record<string, unknown>;
    readonly retentionDeleteAt: Date;
  }): Promise<{ readonly created: boolean; readonly record: MonitoringEventRecord }>;

  listTimeline(input: {
    readonly tenant: TenantContext;
    readonly interviewSessionId: InterviewSessionId;
    readonly limit: number;
  }): Promise<readonly MonitoringEventRecord[]>;

  summarize(input: {
    readonly tenant: TenantContext;
    readonly interviewSessionId: InterviewSessionId;
  }): Promise<MonitoringSummary>;

  reviewEvent(input: {
    readonly tenant: TenantContext;
    readonly interviewSessionId: InterviewSessionId;
    readonly eventId: MonitoringEventId;
    readonly reviewState: Exclude<MonitoringReviewState, "unreviewed">;
    readonly reviewedByUserId: string | null;
    readonly reviewedAt: Date;
    readonly reason: string;
  }): Promise<MonitoringEventRecord | null>;
}
