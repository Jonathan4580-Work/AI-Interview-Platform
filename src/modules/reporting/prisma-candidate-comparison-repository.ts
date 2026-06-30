import { prisma } from "@/infra/database";

import type { CandidateComparisonRepository, CandidateComparisonRow } from "./comparison-types";

export class PrismaCandidateComparisonRepository implements CandidateComparisonRepository {
  public async listComparableCandidates(
    input: Parameters<CandidateComparisonRepository["listComparableCandidates"]>[0],
  ): Promise<readonly CandidateComparisonRow[]> {
    const records = await prisma.evaluationVersion.findMany({
      where: {
        companyId: input.tenant.companyId,
        status: "READY",
        supersededByVersionId: null,
        interviewSession: {
          application: {
            jobId: input.jobId,
            ...(input.candidateIds === null
              ? {}
              : { candidateId: { in: [...input.candidateIds] } }),
          },
        },
      },
      select: {
        id: true,
        interviewSessionId: true,
        overallScore: true,
        scoreMin: true,
        scoreMax: true,
        overallConfidence: true,
        completedAt: true,
        scores: {
          select: {
            competencyKey: true,
            label: true,
            score: true,
            maxScore: true,
            confidence: true,
            incomplete: true,
          },
          orderBy: [{ competencyKey: "asc" }],
        },
        interviewSession: {
          select: {
            candidateId: true,
            applicationId: true,
            candidate: { select: { fullName: true } },
            monitoringEvents: {
              select: { id: true },
              where: { reviewState: { not: "DISMISSED" } },
              take: 10_001,
            },
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: input.limit,
    });

    return records.map((record) => ({
      candidateId: record.interviewSession.candidateId,
      candidateName: record.interviewSession.candidate.fullName,
      applicationId: record.interviewSession.applicationId ?? "",
      interviewSessionId: record.interviewSessionId,
      evaluationVersionId: record.id,
      overallScore: record.overallScore,
      scoreMin: record.scoreMin,
      scoreMax: record.scoreMax,
      overallConfidence: record.overallConfidence.toLocaleLowerCase(),
      completedAt: record.completedAt,
      competencies: record.scores.map((score) => ({
        competencyKey: score.competencyKey,
        label: score.label,
        score: score.score,
        maxScore: score.maxScore,
        confidence: score.confidence.toLocaleLowerCase(),
        incomplete: score.incomplete,
      })),
      monitoringContext: {
        included: record.interviewSession.monitoringEvents.length > 0,
        warningCount: record.interviewSession.monitoringEvents.length,
        note: "Monitoring warnings are contextual only and are not included in comparison scores.",
      },
    }));
  }
}
