import { prisma } from "@/infra/database";

import type {
  ConfidenceLevel,
  MediaManifest,
  TranscriptRecord,
  TranscriptRepository,
  TranscriptSegmentRecord,
  TranscriptSpeaker,
  TranscriptStatus,
  TranscriptVersionRecord,
} from "./types";
import type { InterviewSessionId } from "@/modules/invitations";
import type { MediaObjectId } from "@/modules/media";
import type { TenantContext, TenantId } from "@/modules/tenant";
import type { Prisma, Transcript, TranscriptSegment, TranscriptVersion } from "@prisma/client";

export class PrismaTranscriptRepository implements TranscriptRepository {
  public async buildMediaManifest(input: {
    readonly tenant: TenantContext;
    readonly interviewSessionId: InterviewSessionId;
  }): Promise<MediaManifest> {
    const records = await prisma.interviewTurnMedia.findMany({
      where: {
        companyId: input.tenant.companyId,
        interviewSessionId: input.interviewSessionId,
        status: "VERIFIED",
      },
      include: {
        interviewTurn: true,
        mediaObject: true,
      },
      orderBy: [{ interviewTurn: { sequence: "asc" } }, { chunkSequence: "asc" }],
    });

    const items = records.map((record) => {
      const media = record.mediaObject;
      if (
        media.uploadStatus !== "COMPLETED" ||
        media.processingStatus !== "READY" ||
        media.deletedAt !== null ||
        media.purpose !== "INTERVIEW_RECORDING" ||
        media.subjectType !== "INTERVIEW_SESSION" ||
        media.subjectId !== input.interviewSessionId
      ) {
        throw new Error("Interview media manifest contains unavailable or mismatched media.");
      }
      if (media.sizeBytes === null) {
        throw new Error("Interview media manifest requires verified media size.");
      }
      return {
        turnId: record.interviewTurnId,
        sequence: record.interviewTurn.sequence,
        mediaObjectId: record.mediaObjectId as MediaObjectId,
        mimeType: media.mimeType,
        sizeBytes: media.sizeBytes,
        checksumSha256: media.checksumSha256,
        storageProvider: media.storageProvider,
        bucket: media.bucket,
        storageKey: media.storageKey,
        durationMs: record.durationMs,
      };
    });

    return {
      companyId: input.tenant.companyId,
      interviewSessionId: input.interviewSessionId,
      items,
    };
  }

  public async listCompletedTurns(input: {
    readonly tenant: TenantContext;
    readonly interviewSessionId: InterviewSessionId;
  }) {
    return prisma.interviewTurn.findMany({
      where: {
        companyId: input.tenant.companyId,
        interviewSessionId: input.interviewSessionId,
        speaker: "CANDIDATE",
        status: "COMPLETED",
      },
      orderBy: [{ sequence: "asc" }, { attemptNumber: "asc" }],
      select: {
        id: true,
        sequence: true,
        content: true,
        startedAt: true,
        endedAt: true,
      },
    });
  }

  public async findActiveTranscript(
    input: Parameters<TranscriptRepository["findActiveTranscript"]>[0],
  ) {
    const transcript = await prisma.transcript.findUnique({
      where: {
        companyId_interviewSessionId: {
          companyId: input.tenant.companyId,
          interviewSessionId: input.interviewSessionId,
        },
      },
    });
    if (!transcript?.activeVersionId) {
      return null;
    }
    const version = await prisma.transcriptVersion.findUnique({
      where: {
        companyId_id: { companyId: input.tenant.companyId, id: transcript.activeVersionId },
      },
    });
    return version === null
      ? null
      : { transcript: mapTranscript(transcript), version: mapVersion(version) };
  }

  public async createTranscriptVersion(
    input: Parameters<TranscriptRepository["createTranscriptVersion"]>[0],
  ) {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.transcript.findUnique({
        where: {
          companyId_interviewSessionId: {
            companyId: input.tenant.companyId,
            interviewSessionId: input.interviewSessionId,
          },
        },
        include: { versions: true },
      });
      const transcript =
        existing ??
        (await tx.transcript.create({
          data: {
            companyId: input.tenant.companyId,
            interviewSessionId: input.interviewSessionId,
            status: "PROCESSING",
            language: input.providerResult.language,
            provider: input.providerResult.provider,
            providerModel: input.providerResult.providerModel,
            providerVersion: input.providerResult.providerVersion,
            transcriptQuality: toPrismaConfidence(input.providerResult.transcriptQuality),
            retentionDeleteAt: input.retentionDeleteAt,
            metadataJson: { schemaVersion: 1 },
          },
          include: { versions: true },
        }));
      if (input.correctionOfVersionId !== undefined && input.correctionOfVersionId !== null) {
        const correctionSource = await tx.transcriptVersion.findUnique({
          where: {
            companyId_id: {
              companyId: input.tenant.companyId,
              id: input.correctionOfVersionId,
            },
          },
          select: {
            transcriptId: true,
            interviewSessionId: true,
          },
        });
        if (
          correctionSource?.transcriptId !== transcript.id ||
          correctionSource.interviewSessionId !== input.interviewSessionId
        ) {
          throw new Error("Transcript correction source must belong to the same interview.");
        }
      }
      const versionNumber = transcript.versions.length + 1;
      const version = await tx.transcriptVersion.create({
        data: {
          companyId: input.tenant.companyId,
          transcriptId: transcript.id,
          interviewSessionId: input.interviewSessionId,
          versionNumber,
          status: "READY",
          source: input.source,
          language: input.providerResult.language,
          provider: input.providerResult.provider,
          providerModel: input.providerResult.providerModel,
          providerVersion: input.providerResult.providerVersion,
          providerReference: input.providerResult.providerReference ?? null,
          confidence: input.providerResult.confidence,
          transcriptQuality: toPrismaConfidence(input.providerResult.transcriptQuality),
          correctionOfVersionId: input.correctionOfVersionId ?? null,
          correctionReason: input.correctionReason ?? null,
          correctedByUserId: input.correctedByUserId ?? null,
          startedAt: new Date(),
          completedAt: new Date(),
          metadataJson: toInputJson(input.providerResult.metadata ?? { schemaVersion: 1 }),
        },
      });
      await tx.transcriptSegment.createMany({
        data: input.providerResult.segments.map((segment) => ({
          companyId: input.tenant.companyId,
          transcriptId: transcript.id,
          transcriptVersionId: version.id,
          interviewSessionId: input.interviewSessionId,
          interviewTurnId: segment.interviewTurnId,
          sequence: segment.sequence,
          speaker: toPrismaSpeaker(segment.speaker),
          startMs: segment.startMs,
          endMs: segment.endMs,
          text: segment.text,
          confidence: segment.confidence,
          language: segment.language,
          providerMetadataJson: {},
        })),
      });
      const updated = await tx.transcript.update({
        where: { companyId_id: { companyId: input.tenant.companyId, id: transcript.id } },
        data: {
          status: "READY",
          activeVersionId: version.id,
          language: input.providerResult.language,
          provider: input.providerResult.provider,
          providerModel: input.providerResult.providerModel,
          providerVersion: input.providerResult.providerVersion,
          transcriptQuality: toPrismaConfidence(input.providerResult.transcriptQuality),
        },
      });
      return { transcript: updated, version };
    });
    return { transcript: mapTranscript(result.transcript), version: mapVersion(result.version) };
  }

  public async listSegments(input: Parameters<TranscriptRepository["listSegments"]>[0]) {
    const records = await prisma.transcriptSegment.findMany({
      where: {
        companyId: input.tenant.companyId,
        transcriptVersionId: input.transcriptVersionId,
      },
      orderBy: { sequence: "asc" },
      take: input.limit,
      ...(input.cursor === undefined || input.cursor === null
        ? {}
        : {
            cursor: { companyId_id: { companyId: input.tenant.companyId, id: input.cursor } },
            skip: 1,
          }),
    });
    return records.map(mapSegment);
  }

  public async markReviewed(input: Parameters<TranscriptRepository["markReviewed"]>[0]) {
    const updated = await prisma.transcript.updateMany({
      where: {
        companyId: input.tenant.companyId,
        id: input.transcriptId,
      },
      data: {
        reviewedAt: input.reviewedAt,
        reviewedByUserId: input.reviewedByUserId,
        reviewReason: input.reason,
      },
    });
    if (updated.count === 0) return null;
    const record = await prisma.transcript.findUnique({
      where: { companyId_id: { companyId: input.tenant.companyId, id: input.transcriptId } },
    });
    return record === null ? null : mapTranscript(record);
  }
}

function mapTranscript(record: Transcript): TranscriptRecord {
  return {
    id: record.id as never,
    companyId: record.companyId as TenantId,
    interviewSessionId: record.interviewSessionId as InterviewSessionId,
    status: fromPrismaStatus(record.status),
    activeVersionId: record.activeVersionId as never,
    language: record.language,
    provider: record.provider,
    providerModel: record.providerModel,
    providerVersion: record.providerVersion,
    transcriptQuality: fromPrismaConfidence(record.transcriptQuality),
    reviewedAt: record.reviewedAt,
    reviewReason: record.reviewReason,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function mapVersion(record: TranscriptVersion): TranscriptVersionRecord {
  return {
    id: record.id as never,
    companyId: record.companyId as TenantId,
    transcriptId: record.transcriptId as never,
    interviewSessionId: record.interviewSessionId as InterviewSessionId,
    versionNumber: record.versionNumber,
    status: fromPrismaStatus(record.status),
    source: record.source,
    language: record.language,
    provider: record.provider,
    providerModel: record.providerModel,
    providerVersion: record.providerVersion,
    confidence: record.confidence,
    transcriptQuality: fromPrismaConfidence(record.transcriptQuality),
    correctionOfVersionId: record.correctionOfVersionId as never,
    correctionReason: record.correctionReason,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function mapSegment(record: TranscriptSegment): TranscriptSegmentRecord {
  return {
    id: record.id as never,
    companyId: record.companyId as TenantId,
    transcriptId: record.transcriptId as never,
    transcriptVersionId: record.transcriptVersionId as never,
    interviewSessionId: record.interviewSessionId as InterviewSessionId,
    interviewTurnId: record.interviewTurnId,
    sequence: record.sequence,
    speaker: fromPrismaSpeaker(record.speaker),
    startMs: record.startMs,
    endMs: record.endMs,
    text: record.text,
    confidence: record.confidence,
    language: record.language,
    createdAt: record.createdAt,
  };
}

function toPrismaSpeaker(value: TranscriptSpeaker) {
  return value.toUpperCase() as "INTERVIEWER" | "CANDIDATE" | "SYSTEM" | "UNKNOWN";
}

function fromPrismaSpeaker(value: string): TranscriptSpeaker {
  return value.toLowerCase() as TranscriptSpeaker;
}

function fromPrismaStatus(value: string): TranscriptStatus {
  return value.toLowerCase() as TranscriptStatus;
}

function toPrismaConfidence(value: ConfidenceLevel) {
  return value.toUpperCase() as "HIGH" | "MODERATE" | "LIMITED" | "INSUFFICIENT_EVIDENCE";
}

function fromPrismaConfidence(value: string): ConfidenceLevel {
  return value.toLowerCase() as ConfidenceLevel;
}

function toInputJson(value: Record<string, unknown>): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
}
