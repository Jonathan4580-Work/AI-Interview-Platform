import type { TenantContext, TenantId } from "@/modules/tenant";
import type { Brand } from "@/shared";

export type AiPromptVersionId = Brand<string, "AiPromptVersionId">;
export type AiRubricVersionId = Brand<string, "AiRubricVersionId">;

export const AI_EVALUATION_SCHEMA_VERSION = "evaluation-schema-v1";
export const AI_REDACTION_POLICY_VERSION = "redaction-policy-v1";
export const AI_OUTPUT_NORMALIZATION_VERSION = "evaluation-normalization-v1";

export interface AiGovernanceContext {
  readonly tenant: TenantContext;
}

export interface CompetencyDefinition {
  readonly key: string;
  readonly label: string;
  readonly description: string;
}

export interface PublishedPromptVersionRecord {
  readonly id: AiPromptVersionId;
  readonly companyId: TenantId;
  readonly versionNumber: number;
  readonly promptHash: string;
  readonly systemPrompt: string;
  readonly userPromptTemplate: string;
  readonly evaluationSchemaVersion: string;
  readonly redactionPolicyVersion: string;
}

export interface PublishedRubricVersionRecord {
  readonly id: AiRubricVersionId;
  readonly companyId: TenantId;
  readonly versionNumber: number;
  readonly rubricHash: string;
  readonly scoreMin: number;
  readonly scoreMax: number;
  readonly competencies: readonly CompetencyDefinition[];
}

export interface AiGovernanceArtifacts {
  readonly prompt: PublishedPromptVersionRecord;
  readonly rubric: PublishedRubricVersionRecord;
}

export interface AiGovernanceRepository {
  ensurePublishedEvaluationArtifacts(context: AiGovernanceContext): Promise<AiGovernanceArtifacts>;
}

export interface RedactedTranscriptSegment {
  readonly transcriptSegmentId: string;
  readonly interviewTurnId: string | null;
  readonly sequence: number;
  readonly speaker: "interviewer" | "candidate" | "system" | "unknown";
  readonly startMs: number | null;
  readonly endMs: number | null;
  readonly text: string;
  readonly confidence: number | null;
  readonly language: string;
}

export interface RedactedEvaluationInput {
  readonly schemaVersion: typeof AI_EVALUATION_SCHEMA_VERSION;
  readonly redactionPolicyVersion: typeof AI_REDACTION_POLICY_VERSION;
  readonly interviewSessionId: string;
  readonly transcriptVersionId: string;
  readonly rubric: {
    readonly scoreMin: number;
    readonly scoreMax: number;
    readonly competencies: readonly CompetencyDefinition[];
  };
  readonly segments: readonly RedactedTranscriptSegment[];
}
