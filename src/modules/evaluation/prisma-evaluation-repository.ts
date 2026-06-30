import { prisma } from "@/infra/database";

import type {
  EvaluationRepository,
  EvaluationTranscriptBundle,
  EvaluationVersionRecord,
} from "./types";
import type { ConfidenceLevel, EvaluationProviderKey } from "./types";
import type { Prisma } from "@prisma/client";

export class PrismaEvaluationRepository implements EvaluationRepository {
  public async findReadyEvaluation(
    input: Parameters<EvaluationRepository["findReadyEvaluation"]>[0],
  ): Promise<EvaluationVersionRecord | null> {
    const version = await prisma.evaluationVersion.findFirst({
      where: {
        companyId: input.tenant.companyId,
        interviewSessionId: input.interviewSessionId,
        status: "READY",
      },
      orderBy: { versionNumber: "desc" },
    });
    return version === null ? null : mapEvaluationVersion(version);
  }

  public async loadTranscriptBundle(
    input: Parameters<EvaluationRepository["loadTranscriptBundle"]>[0],
  ): Promise<EvaluationTranscriptBundle | null> {
    const transcript = await prisma.transcript.findUnique({
      where: {
        companyId_interviewSessionId: {
          companyId: input.tenant.companyId,
          interviewSessionId: input.interviewSessionId,
        },
      },
    });
    if (!transcript?.activeVersionId || transcript.status !== "READY") {
      return null;
    }
    const segments = await prisma.transcriptSegment.findMany({
      where: {
        companyId: input.tenant.companyId,
        transcriptVersionId: transcript.activeVersionId,
      },
      orderBy: { sequence: "asc" },
    });
    return {
      transcriptId: transcript.id as never,
      transcriptVersionId: transcript.activeVersionId as never,
      interviewSessionId: transcript.interviewSessionId as never,
      transcriptConfidence: transcript.transcriptQuality.toLowerCase() as ConfidenceLevel,
      segments: segments.map((segment) => ({
        id: segment.id as never,
        companyId: segment.companyId as never,
        transcriptId: segment.transcriptId as never,
        transcriptVersionId: segment.transcriptVersionId as never,
        interviewSessionId: segment.interviewSessionId as never,
        interviewTurnId: segment.interviewTurnId,
        sequence: segment.sequence,
        speaker: segment.speaker.toLowerCase() as never,
        startMs: segment.startMs,
        endMs: segment.endMs,
        text: segment.text,
        confidence: segment.confidence,
        language: segment.language,
        createdAt: segment.createdAt,
      })),
    };
  }

  public async createEvaluationVersion(
    input: Parameters<EvaluationRepository["createEvaluationVersion"]>[0],
  ): Promise<EvaluationVersionRecord> {
    return prisma.$transaction(async (tx) => {
      const latest = await tx.evaluationVersion.findFirst({
        where: {
          companyId: input.tenant.companyId,
          interviewSessionId: input.bundle.interviewSessionId,
        },
        orderBy: { versionNumber: "desc" },
      });
      const versionNumber = (latest?.versionNumber ?? 0) + 1;
      const run = await tx.evaluationRun.create({
        data: {
          companyId: input.tenant.companyId,
          interviewSessionId: input.bundle.interviewSessionId,
          transcriptId: input.bundle.transcriptId,
          transcriptVersionId: input.bundle.transcriptVersionId,
          promptVersionId: input.governance.prompt.id,
          rubricVersionId: input.governance.rubric.id,
          provider: toPrismaProvider(input.result.provider),
          providerModel: input.result.providerModel,
          providerModelVersion: input.result.providerModelVersion,
          status: "READY",
          redactionPolicyVersion: input.governance.prompt.redactionPolicyVersion,
          outputNormalizationVersion: input.outputNormalizationVersion,
          requestStartedAt: input.result.requestStartedAt,
          responseReceivedAt: input.result.responseReceivedAt,
          latencyMs: input.result.latencyMs,
          usageJson: toJsonObject(input.result.usage),
          estimatedCostCents: input.result.estimatedCostCents,
          metadataJson: toJsonObject(input.result.metadata),
        },
      });
      const version = await tx.evaluationVersion.create({
        data: {
          companyId: input.tenant.companyId,
          evaluationRunId: run.id,
          interviewSessionId: input.bundle.interviewSessionId,
          transcriptId: input.bundle.transcriptId,
          transcriptVersionId: input.bundle.transcriptVersionId,
          promptVersionId: input.governance.prompt.id,
          rubricVersionId: input.governance.rubric.id,
          versionNumber,
          status: "READY",
          overallScore: input.result.overallScore,
          scoreMin: input.governance.rubric.scoreMin,
          scoreMax: input.governance.rubric.scoreMax,
          overallConfidence: toPrismaConfidence(input.result.overallConfidence),
          transcriptConfidence: toPrismaConfidence(input.result.transcriptConfidence),
          summary: input.result.summary,
          recommendation: input.result.recommendation,
          decisionSupportDisclaimer:
            "AI output supports, but does not replace, human decision-making.",
          completedAt: input.result.responseReceivedAt,
          metadataJson: {
            schemaVersion: 1,
            redactionPolicyVersion: input.governance.prompt.redactionPolicyVersion,
            outputNormalizationVersion: input.outputNormalizationVersion,
          },
        },
      });
      for (const competency of input.result.competencies) {
        const score = await tx.evaluationCompetencyScore.create({
          data: {
            companyId: input.tenant.companyId,
            evaluationVersionId: version.id,
            interviewSessionId: input.bundle.interviewSessionId,
            competencyKey: competency.competencyKey,
            label: competency.label,
            score: competency.score,
            maxScore: input.governance.rubric.scoreMax,
            confidence: toPrismaConfidence(competency.confidence),
            rationale: competency.rationale,
            incomplete: competency.incomplete,
          },
        });
        for (const citation of competency.evidence) {
          await tx.evaluationEvidenceCitation.create({
            data: {
              companyId: input.tenant.companyId,
              evaluationVersionId: version.id,
              competencyScoreId: score.id,
              interviewSessionId: input.bundle.interviewSessionId,
              transcriptSegmentId: citation.transcriptSegmentId,
              interviewTurnId: citation.interviewTurnId,
              competencyKey: competency.competencyKey,
              claim: citation.claim,
              excerpt: citation.excerpt,
              startMs: null,
              endMs: null,
            },
          });
        }
      }
      for (const text of input.result.strengths) {
        await tx.evaluationObservation.create({
          data: {
            companyId: input.tenant.companyId,
            evaluationVersionId: version.id,
            interviewSessionId: input.bundle.interviewSessionId,
            kind: "strength",
            text,
            confidence: toPrismaConfidence(input.result.overallConfidence),
          },
        });
      }
      for (const text of input.result.developmentAreas) {
        await tx.evaluationObservation.create({
          data: {
            companyId: input.tenant.companyId,
            evaluationVersionId: version.id,
            interviewSessionId: input.bundle.interviewSessionId,
            kind: "development_area",
            text,
            confidence: toPrismaConfidence(input.result.overallConfidence),
          },
        });
      }
      for (const limitation of input.result.limitations) {
        await tx.evaluationLimitation.create({
          data: {
            companyId: input.tenant.companyId,
            evaluationVersionId: version.id,
            interviewSessionId: input.bundle.interviewSessionId,
            code: limitation.code,
            message: limitation.message,
            confidenceImpact: toPrismaConfidence(limitation.confidenceImpact),
          },
        });
      }
      await tx.evaluationProviderPayload.create({
        data: {
          companyId: input.tenant.companyId,
          evaluationRunId: run.id,
          provider: toPrismaProvider(input.result.provider),
          requestHash: input.result.providerRequestHash,
          responseHash: input.result.providerResponseHash,
          payloadRef: null,
          metadataJson: {
            schemaVersion: 1,
            storedPayload: false,
          },
        },
      });
      if (latest !== null) {
        await tx.evaluationVersion.update({
          where: { companyId_id: { companyId: input.tenant.companyId, id: latest.id } },
          data: {
            status: "SUPERSEDED",
            supersededByVersionId: version.id,
          },
        });
      }
      return mapEvaluationVersion(version);
    });
  }
}

function mapEvaluationVersion(
  version: NonNullable<Awaited<ReturnType<typeof prisma.evaluationVersion.findFirst>>>,
): EvaluationVersionRecord {
  return {
    id: version.id as never,
    companyId: version.companyId as never,
    evaluationRunId: version.evaluationRunId as never,
    interviewSessionId: version.interviewSessionId as never,
    transcriptId: version.transcriptId as never,
    transcriptVersionId: version.transcriptVersionId as never,
    versionNumber: version.versionNumber,
    status: version.status.toLowerCase() as never,
    overallScore: version.overallScore,
    overallConfidence: version.overallConfidence.toLowerCase() as never,
    transcriptConfidence: version.transcriptConfidence.toLowerCase() as never,
    summary: version.summary,
    recommendation: version.recommendation,
    completedAt: version.completedAt,
  };
}

function toPrismaProvider(value: EvaluationProviderKey) {
  return value.toUpperCase() as "DEVELOPMENT" | "DEEPSEEK";
}

function toPrismaConfidence(value: ConfidenceLevel) {
  return value.toUpperCase() as "HIGH" | "MODERATE" | "LIMITED" | "INSUFFICIENT_EVIDENCE";
}

function toJsonObject(value: Record<string, unknown>): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
}
