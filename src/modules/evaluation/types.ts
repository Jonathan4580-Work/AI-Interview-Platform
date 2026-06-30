import type { AiGovernanceArtifacts, RedactedEvaluationInput } from "@/modules/ai-governance";
import type { AuditActor, AuditRequestContext } from "@/modules/audit";
import type { InterviewSessionId } from "@/modules/invitations";
import type {
  TranscriptId,
  TranscriptSegmentRecord,
  TranscriptVersionId,
} from "@/modules/transcription";
import type { TenantContext, TenantId } from "@/modules/tenant";
import type { Brand } from "@/shared";

export type EvaluationRunId = Brand<string, "EvaluationRunId">;
export type EvaluationVersionId = Brand<string, "EvaluationVersionId">;
export type EvaluationCompetencyScoreId = Brand<string, "EvaluationCompetencyScoreId">;

export type EvaluationProviderKey = "development" | "deepseek";
export type EvaluationStatus = "pending" | "processing" | "ready" | "failed" | "superseded";
export type ConfidenceLevel = "high" | "moderate" | "limited" | "insufficient_evidence";

export interface EvaluationMutationContext {
  readonly tenant: TenantContext;
  readonly actor: AuditActor;
  readonly request: AuditRequestContext;
  readonly supportAccessSessionId?: string | null;
}

export interface EvaluationTranscriptBundle {
  readonly transcriptId: TranscriptId;
  readonly transcriptVersionId: TranscriptVersionId;
  readonly interviewSessionId: InterviewSessionId;
  readonly transcriptConfidence: ConfidenceLevel;
  readonly segments: readonly TranscriptSegmentRecord[];
}

export interface ProviderEvidenceCitation {
  readonly transcriptSegmentId: string | null;
  readonly interviewTurnId: string | null;
  readonly claim: string;
  readonly excerpt: string;
}

export interface ProviderCompetencyResult {
  readonly competencyKey: string;
  readonly label: string;
  readonly score: number | null;
  readonly confidence: ConfidenceLevel;
  readonly rationale: string;
  readonly incomplete: boolean;
  readonly evidence: readonly ProviderEvidenceCitation[];
}

export interface EvaluationProviderResult {
  readonly provider: EvaluationProviderKey;
  readonly providerModel: string;
  readonly providerModelVersion: string | null;
  readonly requestStartedAt: Date;
  readonly responseReceivedAt: Date;
  readonly latencyMs: number;
  readonly usage: Record<string, unknown>;
  readonly estimatedCostCents: number | null;
  readonly overallScore: number | null;
  readonly overallConfidence: ConfidenceLevel;
  readonly transcriptConfidence: ConfidenceLevel;
  readonly summary: string;
  readonly recommendation: string | null;
  readonly competencies: readonly ProviderCompetencyResult[];
  readonly strengths: readonly string[];
  readonly developmentAreas: readonly string[];
  readonly limitations: readonly {
    readonly code: string;
    readonly message: string;
    readonly confidenceImpact: ConfidenceLevel;
  }[];
  readonly providerRequestHash: string;
  readonly providerResponseHash: string | null;
  readonly metadata: Record<string, unknown>;
}

export interface EvaluationProvider {
  readonly providerKey: EvaluationProviderKey;
  evaluate(input: {
    readonly redactedInput: RedactedEvaluationInput;
    readonly governance: AiGovernanceArtifacts;
  }): Promise<EvaluationProviderResult>;
}

export interface EvaluationVersionRecord {
  readonly id: EvaluationVersionId;
  readonly companyId: TenantId;
  readonly evaluationRunId: EvaluationRunId;
  readonly interviewSessionId: InterviewSessionId;
  readonly transcriptId: TranscriptId;
  readonly transcriptVersionId: TranscriptVersionId;
  readonly versionNumber: number;
  readonly status: EvaluationStatus;
  readonly overallScore: number | null;
  readonly overallConfidence: ConfidenceLevel;
  readonly transcriptConfidence: ConfidenceLevel;
  readonly summary: string;
  readonly recommendation: string | null;
  readonly completedAt: Date | null;
  readonly reviewedAt?: Date | null;
}

export type EvaluationOverrideTarget = "overall" | "competency";
export type HumanDecisionValue = "advance" | "hold" | "reject" | "undecided";

export interface EvaluationOverrideRecord {
  readonly id: string;
  readonly companyId: TenantId;
  readonly interviewSessionId: InterviewSessionId;
  readonly evaluationVersionId: EvaluationVersionId;
  readonly target: EvaluationOverrideTarget;
  readonly competencyScoreId: EvaluationCompetencyScoreId | null;
  readonly previousScore: number | null;
  readonly newScore: number;
  readonly reason: string;
  readonly createdByUserId: string;
  readonly createdAt: Date;
}

export interface HumanDecisionRecord {
  readonly id: string;
  readonly companyId: TenantId;
  readonly interviewSessionId: InterviewSessionId;
  readonly fromDecision: HumanDecisionValue | null;
  readonly toDecision: HumanDecisionValue;
  readonly reason: string;
  readonly createdByUserId: string;
  readonly createdAt: Date;
}

export interface EvaluationRepository {
  findReadyEvaluation(input: {
    readonly tenant: TenantContext;
    readonly interviewSessionId: InterviewSessionId;
  }): Promise<EvaluationVersionRecord | null>;

  loadTranscriptBundle(input: {
    readonly tenant: TenantContext;
    readonly interviewSessionId: InterviewSessionId;
  }): Promise<EvaluationTranscriptBundle | null>;

  createEvaluationVersion(input: {
    readonly tenant: TenantContext;
    readonly governance: AiGovernanceArtifacts;
    readonly bundle: EvaluationTranscriptBundle;
    readonly result: EvaluationProviderResult;
    readonly outputNormalizationVersion: string;
    readonly retentionDeleteAt: Date;
  }): Promise<EvaluationVersionRecord>;

  markEvaluationReviewed(input: {
    readonly tenant: TenantContext;
    readonly evaluationVersionId: EvaluationVersionId;
    readonly reviewedByUserId: string;
    readonly reason: string;
    readonly reviewedAt: Date;
  }): Promise<EvaluationVersionRecord | null>;

  createOverride(input: {
    readonly tenant: TenantContext;
    readonly evaluationVersionId: EvaluationVersionId;
    readonly target: EvaluationOverrideTarget;
    readonly competencyScoreId?: EvaluationCompetencyScoreId | null;
    readonly newScore: number;
    readonly reason: string;
    readonly createdByUserId: string;
  }): Promise<EvaluationOverrideRecord>;

  createHumanDecision(input: {
    readonly tenant: TenantContext;
    readonly interviewSessionId: InterviewSessionId;
    readonly decision: HumanDecisionValue;
    readonly reason: string;
    readonly createdByUserId: string;
  }): Promise<HumanDecisionRecord>;
}
