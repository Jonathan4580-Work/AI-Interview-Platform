import { prisma } from "@/infra/database";

import type {
  MonitoringBatchResult,
  MonitoringBatchStatus,
  MonitoringDetectorCategory,
  MonitoringEventRecord,
  MonitoringEventType,
  MonitoringRepository,
  MonitoringReviewState,
  MonitoringSeverity,
  MonitoringSummary,
} from "./types";
import type { CandidateSessionContext } from "@/modules/candidate-portal";
import type { InterviewSessionId } from "@/modules/invitations";
import type { TenantContext, TenantId } from "@/modules/tenant";
import type { MonitoringEvent, Prisma } from "@prisma/client";

export class PrismaMonitoringRepository implements MonitoringRepository {
  public async getCandidateInterview(input: { readonly session: CandidateSessionContext }) {
    const record = await prisma.interviewSession.findFirst({
      where: {
        companyId: input.session.companyId,
        id: input.session.interviewSessionId ?? undefined,
        invitationId: input.session.invitationId,
        candidateId: input.session.candidateId,
        status: { in: ["IN_PROGRESS", "INTERRUPTED", "UPLOAD_RECOVERY"] },
      },
      select: { id: true, companyId: true, candidateId: true, status: true },
    });
    return record === null
      ? null
      : {
          id: record.id as InterviewSessionId,
          companyId: record.companyId as TenantId,
          candidateId: record.candidateId,
          status: record.status.toLowerCase(),
        };
  }

  public async hasAcceptedMonitoringConsent(session: CandidateSessionContext): Promise<boolean> {
    const count = await prisma.candidateConsentRecord.count({
      where: {
        companyId: session.companyId,
        candidateId: session.candidateId,
        invitationId: session.invitationId,
        candidateSessionId: session.sessionId,
        type: "FUTURE_BROWSER_MONITORING",
        accepted: true,
      },
    });
    return count > 0;
  }

  public async hasAccommodationExemption(session: CandidateSessionContext): Promise<boolean> {
    const requests = await prisma.accommodationRequest.findMany({
      where: {
        companyId: session.companyId,
        candidateId: session.candidateId,
        invitationId: session.invitationId,
        status: { in: ["OPEN", "ACKNOWLEDGED"] },
      },
      select: { metadataJson: true, type: true },
    });
    return requests.some((request) => {
      const metadata = asRecord(request.metadataJson);
      return metadata.monitoringExemption === true || request.type === "ACCESSIBILITY_SUPPORT";
    });
  }

  public async getFeatureControls(
    companyId: TenantId,
  ): ReturnType<MonitoringRepository["getFeatureControls"]> {
    const settings = await prisma.companySettings.findUnique({
      where: { companyId },
      select: { companyId: true, featureFlagsJson: true },
    });
    if (settings === null) {
      return { companyEnabled: true, disabledReason: null };
    }
    const root = asRecord(settings.featureFlagsJson);
    const flags = asRecord(root.flags);
    if (flags.monitoring_emergency_disabled === true || flags.monitoring_disabled === true) {
      return { companyEnabled: false, disabledReason: "company_monitoring_disabled" };
    }
    if (flags.monitoring_enabled === false) {
      return { companyEnabled: false, disabledReason: "company_monitoring_disabled" };
    }
    return { companyEnabled: true, disabledReason: null };
  }

  public async findBatchByIdempotency(input: {
    readonly companyId: TenantId;
    readonly idempotencyKey: string;
  }): Promise<MonitoringBatchResult | null> {
    const record = await prisma.monitoringEventBatch.findUnique({
      where: {
        companyId_idempotencyKey: {
          companyId: input.companyId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    return record === null
      ? null
      : {
          status: fromPrismaBatchStatus(record.status),
          acceptedCount: record.acceptedCount,
          rejectedCount: record.rejectedCount,
          deduplicatedCount: record.deduplicatedCount,
        };
  }

  public async createBatch(
    input: Parameters<MonitoringRepository["createBatch"]>[0],
  ): ReturnType<MonitoringRepository["createBatch"]> {
    const created = await prisma.monitoringEventBatch.create({
      data: {
        companyId: input.companyId,
        interviewSessionId: input.interviewSessionId,
        candidateId: input.candidateId,
        candidateSessionId: input.candidateSessionId,
        idempotencyKey: input.idempotencyKey,
        status: toPrismaBatchStatus(input.status),
        acceptedCount: input.acceptedCount,
        rejectedCount: input.rejectedCount,
        deduplicatedCount: input.deduplicatedCount,
        payloadHash: input.payloadHash,
        metadataJson: toInputJson(input.metadata),
        receivedAt: input.receivedAt,
      },
    });
    return created.id as never;
  }

  public async upsertAggregatedEvent(
    input: Parameters<MonitoringRepository["upsertAggregatedEvent"]>[0],
  ): ReturnType<MonitoringRepository["upsertAggregatedEvent"]> {
    const idempotent = await prisma.monitoringEvent.findUnique({
      where: {
        companyId_idempotencyKey: {
          companyId: input.companyId,
          idempotencyKey: input.event.idempotencyKey,
        },
      },
    });
    if (idempotent !== null) {
      return { created: false, record: mapEvent(idempotent) };
    }
    const existing = await prisma.monitoringEvent.findUnique({
      where: {
        companyId_interviewSessionId_aggregationKey: {
          companyId: input.companyId,
          interviewSessionId: input.interviewSessionId,
          aggregationKey: input.event.aggregationKey,
        },
      },
    });
    if (existing !== null) {
      const updated = await prisma.monitoringEvent.update({
        where: { companyId_id: { companyId: input.companyId, id: existing.id } },
        data: {
          endedAt: input.event.endedAt ?? existing.endedAt,
          durationMs: (existing.durationMs ?? 0) + (input.event.durationMs ?? 0),
          occurrenceCount: existing.occurrenceCount + (input.event.occurrenceCount ?? 1),
          confidence: maxConfidence(existing.confidence, input.event.confidence ?? null),
          safeMetadataJson: toInputJson({
            ...asRecord(existing.safeMetadataJson),
            ...input.safeMetadata,
          }),
        },
      });
      return { created: false, record: mapEvent(updated) };
    }
    const created = await prisma.monitoringEvent.create({
      data: {
        companyId: input.companyId,
        interviewSessionId: input.interviewSessionId,
        candidateId: input.candidateId,
        batchId: input.batchId,
        type: toPrismaEventType(input.event.type),
        severity: toPrismaSeverity(input.severity),
        sourceDetector: input.event.sourceDetector,
        detectorCategory: toPrismaDetectorCategory(input.event.detectorCategory),
        detectorVersion: input.event.detectorVersion,
        thresholdVersion: input.thresholdVersion,
        occurredAt: input.event.occurredAt,
        endedAt: input.event.endedAt ?? null,
        durationMs: input.event.durationMs ?? null,
        occurrenceCount: input.event.occurrenceCount ?? 1,
        confidence: input.event.confidence ?? null,
        safeMetadataJson: toInputJson(input.safeMetadata),
        aggregationKey: input.event.aggregationKey,
        idempotencyKey: input.event.idempotencyKey,
        retentionDeleteAt: input.retentionDeleteAt,
      },
    });
    return { created: true, record: mapEvent(created) };
  }

  public async listTimeline(input: {
    readonly tenant: TenantContext;
    readonly interviewSessionId: InterviewSessionId;
    readonly limit: number;
  }): Promise<readonly MonitoringEventRecord[]> {
    const records = await prisma.monitoringEvent.findMany({
      where: {
        companyId: input.tenant.companyId,
        interviewSessionId: input.interviewSessionId,
      },
      orderBy: { occurredAt: "asc" },
      take: input.limit,
    });
    return records.map(mapEvent);
  }

  public async summarize(input: {
    readonly tenant: TenantContext;
    readonly interviewSessionId: InterviewSessionId;
  }) {
    const records = await prisma.monitoringEvent.findMany({
      where: { companyId: input.tenant.companyId, interviewSessionId: input.interviewSessionId },
    });
    const countsByType: MonitoringSummary["countsByType"] = {};
    const durationMsByType: MonitoringSummary["durationMsByType"] = {};
    for (const record of records) {
      const type = fromPrismaEventType(record.type);
      countsByType[type] = (countsByType[type] ?? 0) + record.occurrenceCount;
      durationMsByType[type] = (durationMsByType[type] ?? 0) + (record.durationMs ?? 0);
    }
    return {
      interviewSessionId: input.interviewSessionId,
      totalWarnings: records.length,
      countsByType,
      durationMsByType,
      focusLossPeriods: countsByType.window_focus_lost ?? 0,
      faceMissingPeriods: countsByType.face_not_detected ?? 0,
      multipleFaceWarningsOccurred: (countsByType.multiple_faces ?? 0) > 0,
      connectionInstabilityWarnings:
        (countsByType.network_degraded ?? 0) + (countsByType.connection_lost ?? 0),
      detectorAvailability: {
        unavailableWarnings: countsByType.monitoring_unavailable ?? 0,
        unavailableDurationMs: durationMsByType.monitoring_unavailable ?? 0,
      },
    };
  }

  public async reviewEvent(
    input: Parameters<MonitoringRepository["reviewEvent"]>[0],
  ): ReturnType<MonitoringRepository["reviewEvent"]> {
    const existing = await prisma.monitoringEvent.findFirst({
      where: {
        companyId: input.tenant.companyId,
        interviewSessionId: input.interviewSessionId,
        id: input.eventId,
      },
    });
    if (existing === null) return null;
    const updated = await prisma.monitoringEvent.update({
      where: { companyId_id: { companyId: input.tenant.companyId, id: input.eventId } },
      data: {
        reviewState: toPrismaReviewState(input.reviewState),
        reviewedByUserId: input.reviewedByUserId,
        reviewedAt: input.reviewedAt,
        reviewReason: input.reason,
      },
    });
    return mapEvent(updated);
  }
}

function mapEvent(record: MonitoringEvent): MonitoringEventRecord {
  return {
    id: record.id as never,
    companyId: record.companyId as TenantId,
    interviewSessionId: record.interviewSessionId as InterviewSessionId,
    candidateId: record.candidateId,
    type: fromPrismaEventType(record.type),
    severity: fromPrismaSeverity(record.severity),
    reviewState: fromPrismaReviewState(record.reviewState),
    sourceDetector: record.sourceDetector,
    detectorCategory: fromPrismaDetectorCategory(record.detectorCategory),
    detectorVersion: record.detectorVersion,
    thresholdVersion: record.thresholdVersion,
    occurredAt: record.occurredAt,
    endedAt: record.endedAt,
    durationMs: record.durationMs,
    occurrenceCount: record.occurrenceCount,
    confidence: record.confidence,
    safeMetadata: asRecord(record.safeMetadataJson),
    aggregationKey: record.aggregationKey,
    retentionDeleteAt: record.retentionDeleteAt,
    legalHoldActive: record.legalHoldActive,
    reviewedAt: record.reviewedAt,
    reviewReason: record.reviewReason,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function toPrismaEventType(value: MonitoringEventType): MonitoringEvent["type"] {
  return value.toUpperCase() as MonitoringEvent["type"];
}

function fromPrismaEventType(value: MonitoringEvent["type"]): MonitoringEventType {
  return value.toLowerCase() as MonitoringEventType;
}

function toPrismaSeverity(value: MonitoringSeverity): MonitoringEvent["severity"] {
  return value.toUpperCase() as MonitoringEvent["severity"];
}

function fromPrismaSeverity(value: MonitoringEvent["severity"]): MonitoringSeverity {
  return value.toLowerCase() as MonitoringSeverity;
}

function toPrismaReviewState(value: MonitoringReviewState): MonitoringEvent["reviewState"] {
  return value.toUpperCase() as MonitoringEvent["reviewState"];
}

function fromPrismaReviewState(value: MonitoringEvent["reviewState"]): MonitoringReviewState {
  return value.toLowerCase() as MonitoringReviewState;
}

function toPrismaDetectorCategory(
  value: MonitoringDetectorCategory,
): MonitoringEvent["detectorCategory"] {
  return value.toUpperCase() as MonitoringEvent["detectorCategory"];
}

function fromPrismaDetectorCategory(
  value: MonitoringEvent["detectorCategory"],
): MonitoringDetectorCategory {
  return value.toLowerCase() as MonitoringDetectorCategory;
}

function toPrismaBatchStatus(value: MonitoringBatchStatus) {
  return value.toUpperCase() as "ACCEPTED" | "PARTIALLY_ACCEPTED" | "REJECTED" | "DUPLICATE";
}

function fromPrismaBatchStatus(value: string): MonitoringBatchStatus {
  return value.toLowerCase() as MonitoringBatchStatus;
}

function maxConfidence(current: number | null, next: number | null): number | null {
  if (current === null) return next;
  if (next === null) return current;
  return Math.max(current, next);
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toInputJson(value: Record<string, unknown>): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
}
