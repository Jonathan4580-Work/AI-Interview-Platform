import { AuditWriter } from "@/modules/audit";

import type {
  HrReportDocument,
  HrReportVersionRecord,
  ReportInput,
  ReportingRepository,
} from "./types";
import type { EvaluationMutationContext } from "@/modules/evaluation";
import type { InterviewSessionId } from "@/modules/invitations";

const REPORT_RETENTION_DAYS = 365;
const REPORT_DISCLAIMER =
  "AI output supports, but does not replace, human decision-making. Review cited evidence and apply company hiring policies before making any decision.";

export class ReportingDomainError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ReportingDomainError";
  }
}

export class ReportingService {
  public constructor(
    private readonly repository: ReportingRepository,
    private readonly auditWriter: AuditWriter,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async generateReport(input: {
    readonly context: EvaluationMutationContext;
    readonly interviewSessionId: InterviewSessionId;
  }): Promise<HrReportVersionRecord> {
    const existing = await this.repository.findReadyReport({
      tenant: input.context.tenant,
      interviewSessionId: input.interviewSessionId,
    });
    if (existing !== null) {
      return existing;
    }
    const reportInput = await this.repository.loadReportInput({
      tenant: input.context.tenant,
      interviewSessionId: input.interviewSessionId,
    });
    if (reportInput === null) {
      throw new ReportingDomainError("A ready evaluation is required before report generation.");
    }
    const document = buildReportDocument(reportInput);
    const report = await this.repository.createReportVersion({
      tenant: input.context.tenant,
      reportInput,
      document,
      retentionDeleteAt: addDays(this.now(), REPORT_RETENTION_DAYS),
    });
    await this.auditWriter.record({
      companyId: input.context.tenant.companyId,
      actor: input.context.actor,
      request: input.context.request,
      supportAccessSessionId: input.context.supportAccessSessionId ?? null,
      action: "report.generated",
      resourceType: "hr_report_version",
      resourceId: report.id,
      riskLevel: "high",
      after: {
        hrReportVersionId: report.id,
        interviewSessionId: input.interviewSessionId,
        evaluationVersionId: report.evaluationVersionId,
        competencyCount: report.report.competencyScores.length,
      },
    });
    return report;
  }
}

export function buildReportDocument(input: ReportInput): HrReportDocument {
  return {
    schemaVersion: "hr-report-v1",
    candidateContext: {
      candidateId: input.candidateId,
      candidateName: input.candidateName,
      jobId: input.jobId,
      jobTitle: input.jobTitle,
    },
    interview: {
      interviewSessionId: input.interviewSessionId,
      completedAt: input.completedAt?.toISOString() ?? null,
    },
    executiveSummary: input.summary,
    competencyScores: input.scores.map((score) => ({
      competencyKey: score.competencyKey,
      label: score.label,
      score: score.score,
      maxScore: score.maxScore,
      confidence: score.confidence,
      rationale: score.rationale,
      evidence: score.evidence.map((citation) => ({
        transcriptSegmentId: citation.transcriptSegmentId,
        interviewTurnId: citation.interviewTurnId,
        claim: citation.claim,
        excerpt: citation.excerpt,
      })),
    })),
    strengths: input.strengths,
    developmentAreas: input.developmentAreas,
    confidenceAndLimitations: input.limitations,
    transcriptQualityNotes: [`Transcript confidence: ${input.transcriptConfidence}.`],
    monitoringContext: {
      included: false,
      note: "Monitoring warnings are not included in this report version and do not affect scores.",
    },
    disclaimer: REPORT_DISCLAIMER,
  };
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
