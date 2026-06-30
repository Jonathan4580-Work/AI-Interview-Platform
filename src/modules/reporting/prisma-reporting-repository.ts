import { prisma } from "@/infra/database";

import type {
  HrReportDocument,
  HrReportVersionRecord,
  ReportInput,
  ReportingRepository,
} from "./types";
import type { Prisma } from "@prisma/client";

export class PrismaReportingRepository implements ReportingRepository {
  public async findReadyReport(
    input: Parameters<ReportingRepository["findReadyReport"]>[0],
  ): Promise<HrReportVersionRecord | null> {
    const report = await prisma.hrReport.findUnique({
      where: {
        companyId_interviewSessionId: {
          companyId: input.tenant.companyId,
          interviewSessionId: input.interviewSessionId,
        },
      },
      include: { activeVersion: true },
    });
    return report?.activeVersion === null || report?.activeVersion === undefined
      ? null
      : mapReportVersion(report.activeVersion);
  }

  public async loadReportInput(
    input: Parameters<ReportingRepository["loadReportInput"]>[0],
  ): Promise<ReportInput | null> {
    const evaluation = await prisma.evaluationVersion.findFirst({
      where: {
        companyId: input.tenant.companyId,
        interviewSessionId: input.interviewSessionId,
        status: "READY",
      },
      orderBy: { versionNumber: "desc" },
      include: {
        scores: { include: { evidenceCitations: true }, orderBy: { competencyKey: "asc" } },
        observations: true,
        limitations: true,
        interviewSession: {
          include: {
            candidate: true,
            invitation: { include: { job: true } },
          },
        },
      },
    });
    if (evaluation === null) {
      return null;
    }
    return {
      interviewSessionId: evaluation.interviewSessionId as never,
      transcriptId: evaluation.transcriptId as never,
      evaluationVersionId: evaluation.id as never,
      candidateId: evaluation.interviewSession.candidateId,
      candidateName: evaluation.interviewSession.candidate.fullName,
      jobId: evaluation.interviewSession.invitation.jobId,
      jobTitle: evaluation.interviewSession.invitation.job.title,
      completedAt: evaluation.interviewSession.completedAt,
      summary: evaluation.summary,
      transcriptConfidence: evaluation.transcriptConfidence.toLowerCase(),
      scores: evaluation.scores.map((score) => ({
        id: score.id,
        competencyKey: score.competencyKey,
        label: score.label,
        score: score.score,
        maxScore: score.maxScore,
        confidence: score.confidence.toLowerCase(),
        rationale: score.rationale,
        evidence: score.evidenceCitations.map((citation) => ({
          transcriptSegmentId: citation.transcriptSegmentId,
          interviewTurnId: citation.interviewTurnId,
          claim: citation.claim,
          excerpt: citation.excerpt,
        })),
      })),
      strengths: evaluation.observations
        .filter((observation) => observation.kind === "strength")
        .map((observation) => observation.text),
      developmentAreas: evaluation.observations
        .filter((observation) => observation.kind === "development_area")
        .map((observation) => observation.text),
      limitations: evaluation.limitations.map((limitation) => limitation.message),
    };
  }

  public async createReportVersion(
    input: Parameters<ReportingRepository["createReportVersion"]>[0],
  ): Promise<HrReportVersionRecord> {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.hrReport.findUnique({
        where: {
          companyId_interviewSessionId: {
            companyId: input.tenant.companyId,
            interviewSessionId: input.reportInput.interviewSessionId,
          },
        },
        include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
      });
      const report =
        existing ??
        (await tx.hrReport.create({
          data: {
            companyId: input.tenant.companyId,
            interviewSessionId: input.reportInput.interviewSessionId,
            transcriptId: input.reportInput.transcriptId,
            evaluationVersionId: input.reportInput.evaluationVersionId,
            status: "PENDING",
            retentionDeleteAt: input.retentionDeleteAt,
          },
          include: { versions: true },
        }));
      const previousVersion = existing?.versions[0] ?? null;
      const version = await tx.hrReportVersion.create({
        data: {
          companyId: input.tenant.companyId,
          hrReportId: report.id,
          interviewSessionId: input.reportInput.interviewSessionId,
          evaluationVersionId: input.reportInput.evaluationVersionId,
          versionNumber: (previousVersion?.versionNumber ?? 0) + 1,
          status: "READY",
          reportJson: input.document as unknown as Prisma.InputJsonObject,
          executiveSummary: input.document.executiveSummary,
          disclaimer: input.document.disclaimer,
          completedAt: new Date(),
        },
      });
      await tx.hrReport.update({
        where: { companyId_id: { companyId: input.tenant.companyId, id: report.id } },
        data: {
          activeVersionId: version.id,
          status: "READY",
          evaluationVersionId: input.reportInput.evaluationVersionId,
        },
      });
      if (previousVersion !== null) {
        await tx.hrReportVersion.update({
          where: { companyId_id: { companyId: input.tenant.companyId, id: previousVersion.id } },
          data: {
            status: "SUPERSEDED",
            supersededByVersionId: version.id,
          },
        });
      }
      return mapReportVersion(version);
    });
  }
}

function mapReportVersion(input: {
  readonly id: string;
  readonly companyId: string;
  readonly hrReportId: string;
  readonly interviewSessionId: string;
  readonly evaluationVersionId: string;
  readonly versionNumber: number;
  readonly status: "PENDING" | "READY" | "FAILED" | "SUPERSEDED";
  readonly reportJson: Prisma.JsonValue;
  readonly executiveSummary: string;
  readonly disclaimer: string;
  readonly completedAt: Date | null;
}): HrReportVersionRecord {
  return {
    id: input.id as never,
    companyId: input.companyId as never,
    hrReportId: input.hrReportId as never,
    interviewSessionId: input.interviewSessionId as never,
    evaluationVersionId: input.evaluationVersionId as never,
    versionNumber: input.versionNumber,
    status: input.status.toLowerCase() as never,
    report: input.reportJson as unknown as HrReportDocument,
    executiveSummary: input.executiveSummary,
    disclaimer: input.disclaimer,
    completedAt: input.completedAt,
  };
}
