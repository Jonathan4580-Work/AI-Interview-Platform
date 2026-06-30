import { AuditWriter } from "@/modules/audit";
import {
  AI_OUTPUT_NORMALIZATION_VERSION,
  redactEvaluationInput,
  type AiGovernanceRepository,
} from "@/modules/ai-governance";

import type {
  EvaluationMutationContext,
  EvaluationProvider,
  EvaluationProviderResult,
  EvaluationRepository,
  EvaluationVersionRecord,
  ProviderCompetencyResult,
} from "./types";
import type { InterviewSessionId } from "@/modules/invitations";
import type { TranscriptSegmentRecord } from "@/modules/transcription";

const EVALUATION_RETENTION_DAYS = 365;
const FORBIDDEN_INFERENCE_PATTERN =
  /\b(age|race|ethnicity|religion|pregnan|disab|health|accent|appearance|attractive|emotion|cheat|dishonest|suspicious)\b/iu;

export class EvaluationDomainError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "EvaluationDomainError";
  }
}

export class EvaluationService {
  public constructor(
    private readonly repository: EvaluationRepository,
    private readonly governanceRepository: AiGovernanceRepository,
    private readonly provider: EvaluationProvider,
    private readonly auditWriter: AuditWriter,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async evaluateInterview(input: {
    readonly context: EvaluationMutationContext;
    readonly interviewSessionId: InterviewSessionId;
  }): Promise<EvaluationVersionRecord> {
    const existing = await this.repository.findReadyEvaluation({
      tenant: input.context.tenant,
      interviewSessionId: input.interviewSessionId,
    });
    if (existing !== null) {
      return existing;
    }
    const bundle = await this.repository.loadTranscriptBundle({
      tenant: input.context.tenant,
      interviewSessionId: input.interviewSessionId,
    });
    if (bundle === null) {
      throw new EvaluationDomainError("A ready transcript is required before evaluation.");
    }
    const governance = await this.governanceRepository.ensurePublishedEvaluationArtifacts({
      tenant: input.context.tenant,
    });
    const redactedInput = redactEvaluationInput({
      interviewSessionId: input.interviewSessionId,
      transcriptVersionId: bundle.transcriptVersionId,
      rubric: governance.rubric,
      segments: bundle.segments,
    });
    const providerResult = await this.provider.evaluate({ redactedInput, governance });
    validateProviderResult(
      providerResult,
      bundle.segments,
      governance.rubric.scoreMin,
      governance.rubric.scoreMax,
    );
    const created = await this.repository.createEvaluationVersion({
      tenant: input.context.tenant,
      governance,
      bundle,
      result: providerResult,
      outputNormalizationVersion: AI_OUTPUT_NORMALIZATION_VERSION,
      retentionDeleteAt: addDays(this.now(), EVALUATION_RETENTION_DAYS),
    });
    await this.auditWriter.record({
      companyId: input.context.tenant.companyId,
      actor: input.context.actor,
      request: input.context.request,
      supportAccessSessionId: input.context.supportAccessSessionId ?? null,
      action: "evaluation.created",
      resourceType: "evaluation_version",
      resourceId: created.id,
      riskLevel: "high",
      after: {
        evaluationVersionId: created.id,
        interviewSessionId: input.interviewSessionId,
        transcriptVersionId: bundle.transcriptVersionId,
        provider: providerResult.provider,
        competencyCount: providerResult.competencies.length,
      },
    });
    return created;
  }
}

export function validateProviderResult(
  result: EvaluationProviderResult,
  segments: readonly TranscriptSegmentRecord[],
  scoreMin: number,
  scoreMax: number,
): void {
  if (
    result.overallScore !== null &&
    (result.overallScore < scoreMin || result.overallScore > scoreMax)
  ) {
    throw new EvaluationDomainError("Overall evaluation score is outside the rubric range.");
  }
  const segmentById = new Map(segments.map((segment) => [segment.id, segment]));
  for (const competency of result.competencies) {
    validateCompetency(competency, segmentById, scoreMin, scoreMax);
  }
}

function validateCompetency(
  competency: ProviderCompetencyResult,
  segmentById: ReadonlyMap<string, TranscriptSegmentRecord>,
  scoreMin: number,
  scoreMax: number,
): void {
  if (competency.score !== null && (competency.score < scoreMin || competency.score > scoreMax)) {
    throw new EvaluationDomainError("Competency score is outside the rubric range.");
  }
  if (!competency.incomplete && competency.score !== null && competency.evidence.length === 0) {
    throw new EvaluationDomainError("Material competency assessments require transcript evidence.");
  }
  rejectForbiddenInference(competency.rationale);
  const seen = new Set<string>();
  for (const citation of competency.evidence) {
    rejectForbiddenInference(citation.claim);
    if (citation.transcriptSegmentId === null) {
      throw new EvaluationDomainError("Evidence citations must reference transcript segments.");
    }
    const segment = segmentById.get(citation.transcriptSegmentId);
    if (segment === undefined) {
      throw new EvaluationDomainError(
        "Evidence citation references an unknown transcript segment.",
      );
    }
    if (citation.interviewTurnId !== null && citation.interviewTurnId !== segment.interviewTurnId) {
      throw new EvaluationDomainError("Evidence citation turn does not match transcript segment.");
    }
    if (!normalizeEvidenceText(segment.text).includes(normalizeEvidenceText(citation.excerpt))) {
      throw new EvaluationDomainError(
        "Evidence citation excerpt is not derived from transcript text.",
      );
    }
    const key = `${citation.transcriptSegmentId}:${normalizeEvidenceText(citation.excerpt)}`;
    if (seen.has(key)) {
      throw new EvaluationDomainError("Duplicate evidence citations are not allowed.");
    }
    seen.add(key);
  }
}

function rejectForbiddenInference(value: string): void {
  if (FORBIDDEN_INFERENCE_PATTERN.test(value)) {
    throw new EvaluationDomainError("Evaluation output contains a disallowed inference.");
  }
}

function normalizeEvidenceText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
