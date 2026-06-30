import type { TenantContext, TenantId } from "@/modules/tenant";

export interface CandidateComparisonRequest {
  readonly tenant: TenantContext;
  readonly jobId: string;
  readonly candidateIds?: readonly string[];
  readonly limit?: number;
}

export interface CandidateComparisonCompetency {
  readonly competencyKey: string;
  readonly label: string;
  readonly score: number | null;
  readonly maxScore: number;
  readonly confidence: string;
  readonly incomplete: boolean;
}

export interface CandidateComparisonRow {
  readonly candidateId: string;
  readonly candidateName: string;
  readonly applicationId: string;
  readonly interviewSessionId: string;
  readonly evaluationVersionId: string;
  readonly overallScore: number | null;
  readonly scoreMin: number;
  readonly scoreMax: number;
  readonly overallConfidence: string;
  readonly completedAt: Date | null;
  readonly competencies: readonly CandidateComparisonCompetency[];
  readonly monitoringContext: {
    readonly included: boolean;
    readonly warningCount: number;
    readonly note: string;
  };
}

export interface CandidateComparisonResult {
  readonly schemaVersion: "candidate-comparison-v1";
  readonly companyId: TenantId;
  readonly jobId: string;
  readonly rows: readonly CandidateComparisonRow[];
  readonly sort: "candidate_name_asc";
  readonly limitations: readonly string[];
}

export interface CandidateComparisonRepository {
  listComparableCandidates(input: {
    readonly tenant: TenantContext;
    readonly jobId: string;
    readonly candidateIds: readonly string[] | null;
    readonly limit: number;
  }): Promise<readonly CandidateComparisonRow[]>;
}
