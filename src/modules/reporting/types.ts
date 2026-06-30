import type { EvaluationVersionId } from "@/modules/evaluation";
import type { InterviewSessionId } from "@/modules/invitations";
import type { TranscriptId } from "@/modules/transcription";
import type { TenantContext, TenantId } from "@/modules/tenant";
import type { Brand } from "@/shared";

export type HrReportId = Brand<string, "HrReportId">;
export type HrReportVersionId = Brand<string, "HrReportVersionId">;
export type HrReportStatus = "pending" | "ready" | "failed" | "superseded";

export interface HrReportRecord {
  readonly id: HrReportId;
  readonly companyId: TenantId;
  readonly interviewSessionId: InterviewSessionId;
  readonly transcriptId: TranscriptId;
  readonly evaluationVersionId: EvaluationVersionId;
  readonly activeVersionId: HrReportVersionId | null;
  readonly status: HrReportStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface HrReportVersionRecord {
  readonly id: HrReportVersionId;
  readonly companyId: TenantId;
  readonly hrReportId: HrReportId;
  readonly interviewSessionId: InterviewSessionId;
  readonly evaluationVersionId: EvaluationVersionId;
  readonly versionNumber: number;
  readonly status: HrReportStatus;
  readonly report: HrReportDocument;
  readonly executiveSummary: string;
  readonly disclaimer: string;
  readonly completedAt: Date | null;
}

export interface HrReportDocument {
  readonly schemaVersion: "hr-report-v1";
  readonly candidateContext: {
    readonly candidateId: string;
    readonly candidateName: string;
    readonly jobId: string | null;
    readonly jobTitle: string | null;
  };
  readonly interview: {
    readonly interviewSessionId: string;
    readonly completedAt: string | null;
  };
  readonly executiveSummary: string;
  readonly competencyScores: readonly {
    readonly competencyKey: string;
    readonly label: string;
    readonly score: number | null;
    readonly maxScore: number;
    readonly confidence: string;
    readonly rationale: string;
    readonly evidence: readonly {
      readonly transcriptSegmentId: string | null;
      readonly interviewTurnId: string | null;
      readonly claim: string;
      readonly excerpt: string;
    }[];
  }[];
  readonly strengths: readonly string[];
  readonly developmentAreas: readonly string[];
  readonly confidenceAndLimitations: readonly string[];
  readonly transcriptQualityNotes: readonly string[];
  readonly monitoringContext: {
    readonly included: false;
    readonly note: string;
  };
  readonly disclaimer: string;
}

export interface ReportInput {
  readonly interviewSessionId: InterviewSessionId;
  readonly transcriptId: TranscriptId;
  readonly evaluationVersionId: EvaluationVersionId;
  readonly candidateId: string;
  readonly candidateName: string;
  readonly jobId: string | null;
  readonly jobTitle: string | null;
  readonly completedAt: Date | null;
  readonly summary: string;
  readonly transcriptConfidence: string;
  readonly scores: readonly {
    readonly id: string;
    readonly competencyKey: string;
    readonly label: string;
    readonly score: number | null;
    readonly maxScore: number;
    readonly confidence: string;
    readonly rationale: string;
    readonly evidence: readonly {
      readonly transcriptSegmentId: string | null;
      readonly interviewTurnId: string | null;
      readonly claim: string;
      readonly excerpt: string;
    }[];
  }[];
  readonly strengths: readonly string[];
  readonly developmentAreas: readonly string[];
  readonly limitations: readonly string[];
}

export interface ReportingRepository {
  findReadyReport(input: {
    readonly tenant: TenantContext;
    readonly interviewSessionId: InterviewSessionId;
  }): Promise<HrReportVersionRecord | null>;

  loadReportInput(input: {
    readonly tenant: TenantContext;
    readonly interviewSessionId: InterviewSessionId;
  }): Promise<ReportInput | null>;

  createReportVersion(input: {
    readonly tenant: TenantContext;
    readonly reportInput: ReportInput;
    readonly document: HrReportDocument;
    readonly retentionDeleteAt: Date;
  }): Promise<HrReportVersionRecord>;
}
