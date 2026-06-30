import { describe, expect, it } from "vitest";

import {
  AI_OUTPUT_NORMALIZATION_VERSION,
  AI_REDACTION_POLICY_VERSION,
  redactEvaluationInput,
  type AiGovernanceArtifacts,
  type AiGovernanceRepository,
} from "@/modules/ai-governance";
import { AuditWriter, type AuditEventStore, type PersistedAuditEventInput } from "@/modules/audit";
import {
  DevelopmentEvaluationProvider,
  EvaluationDomainError,
  EvaluationService,
  validateProviderResult,
  type EvaluationOverrideRecord,
  type EvaluationProviderResult,
  type EvaluationRepository,
  type EvaluationTranscriptBundle,
  type EvaluationVersionRecord,
  type HumanDecisionRecord,
} from "@/modules/evaluation";
import type { InterviewSessionId } from "@/modules/invitations";
import type { TenantContext, TenantId } from "@/modules/tenant";
import type {
  TranscriptId,
  TranscriptSegmentRecord,
  TranscriptVersionId,
} from "@/modules/transcription";

describe("evaluation foundation", () => {
  it("redacts direct identifiers before provider evaluation", () => {
    const redacted = redactEvaluationInput({
      interviewSessionId,
      transcriptVersionId,
      rubric: governance.rubric,
      segments: [
        createSegment({
          text: "You can reach me at candidate@example.com or +1 555 123 4567.",
        }),
      ],
    });

    expect(redacted.segments[0]?.text).toContain("[redacted-email]");
    expect(redacted.segments[0]?.text).toContain("[redacted-phone]");
    expect(JSON.stringify(redacted)).not.toContain("candidate@example.com");
  });

  it("development provider returns deterministic evidence-linked results", async () => {
    const provider = new DevelopmentEvaluationProvider();
    const redactedInput = redactEvaluationInput({
      interviewSessionId,
      transcriptVersionId,
      rubric: governance.rubric,
      segments: [createSegment()],
    });

    const first = await provider.evaluate({ redactedInput, governance });
    const second = await provider.evaluate({ redactedInput, governance });

    expect(first.provider).toBe("development");
    expect(first.providerResponseHash).toBe(second.providerResponseHash);
    expect(first.competencies[0]?.evidence[0]?.transcriptSegmentId).toBe("segment_1");
  });

  it("rejects fabricated evidence excerpts", () => {
    const result = createProviderResult({
      excerpt: "This text does not exist in the transcript.",
    });

    expect(() => {
      validateProviderResult(result, [createSegment()], 1, 5);
    }).toThrow(EvaluationDomainError);
  });

  it("rejects disallowed protected or misconduct inferences", () => {
    const result = createProviderResult({
      claim: "Candidate seemed suspicious.",
    });

    expect(() => {
      validateProviderResult(result, [createSegment()], 1, 5);
    }).toThrow(EvaluationDomainError);
  });

  it("creates normalized evaluation records without transcript text in audit", async () => {
    const repo = new InMemoryEvaluationRepository();
    const audit = new InMemoryAuditStore();
    const service = createService(repo, audit);

    const created = await service.evaluateInterview({ context, interviewSessionId });

    expect(created.overallScore).toBe(3.5);
    expect(repo.createdVersions).toHaveLength(1);
    expect(repo.outputNormalizationVersion).toBe(AI_OUTPUT_NORMALIZATION_VERSION);
    expect(JSON.stringify(audit.events)).not.toContain("designed a reliable payment workflow");
  });

  it("returns an existing ready evaluation idempotently", async () => {
    const repo = new InMemoryEvaluationRepository();
    const service = createService(repo, new InMemoryAuditStore());

    const first = await service.evaluateInterview({ context, interviewSessionId });
    const second = await service.evaluateInterview({ context, interviewSessionId });

    expect(second.id).toBe(first.id);
    expect(repo.createdVersions).toHaveLength(1);
  });

  it("records human overrides and decisions separately from AI results", async () => {
    const repo = new InMemoryEvaluationRepository();
    const audit = new InMemoryAuditStore();
    const service = createService(repo, audit);
    const userContext = {
      ...context,
      actor: { type: "user" as const, id: "user_1" },
    };

    const override = await service.createOverride({
      context: userContext,
      evaluationVersionId: "evaluation_version_1" as never,
      target: "overall",
      newScore: 4,
      reason: "Human reviewer found stronger evidence.",
    });
    const decision = await service.recordHumanDecision({
      context: userContext,
      interviewSessionId,
      decision: "hold",
      reason: "Needs hiring team review.",
    });

    expect(override.target).toBe("overall");
    expect(decision.toDecision).toBe("hold");
    expect(audit.events.map((event) => event.action)).toContain("evaluation.override_created");
    expect(audit.events.map((event) => event.action)).toContain("candidate_decision.recorded");
  });
});

const tenant: TenantContext = { companyId: "company_test" as TenantId };
const interviewSessionId = "interview_1" as InterviewSessionId;
const transcriptId = "transcript_1" as TranscriptId;
const transcriptVersionId = "transcript_version_1" as TranscriptVersionId;
const context = {
  tenant,
  actor: { type: "system" as const, id: "worker" },
  request: {
    requestId: "req_1",
    correlationId: "corr_1",
    sessionId: null,
    ipAddress: "127.0.0.1",
    userAgent: "vitest",
  },
};

const governance: AiGovernanceArtifacts = {
  prompt: {
    id: "prompt_version_1" as never,
    companyId: tenant.companyId,
    versionNumber: 1,
    promptHash: "prompt_hash",
    systemPrompt: "Evaluate as decision support only.",
    userPromptTemplate: "Return structured JSON.",
    evaluationSchemaVersion: "evaluation-schema-v1",
    redactionPolicyVersion: AI_REDACTION_POLICY_VERSION,
  },
  rubric: {
    id: "rubric_version_1" as never,
    companyId: tenant.companyId,
    versionNumber: 1,
    rubricHash: "rubric_hash",
    scoreMin: 1,
    scoreMax: 5,
    competencies: [
      {
        key: "communication",
        label: "Communication",
        description: "Clarity and structure.",
      },
    ],
  },
};

function createService(repo: InMemoryEvaluationRepository, audit: InMemoryAuditStore) {
  return new EvaluationService(
    repo,
    new InMemoryGovernanceRepository(),
    new DevelopmentEvaluationProvider(),
    new AuditWriter(audit),
    () => new Date("2026-07-01T00:00:00.000Z"),
  );
}

class InMemoryGovernanceRepository implements AiGovernanceRepository {
  public ensurePublishedEvaluationArtifacts(): Promise<AiGovernanceArtifacts> {
    return Promise.resolve(governance);
  }
}

class InMemoryAuditStore implements AuditEventStore {
  public readonly events: PersistedAuditEventInput[] = [];

  public append(event: PersistedAuditEventInput): Promise<void> {
    this.events.push(event);
    return Promise.resolve();
  }
}

class InMemoryEvaluationRepository implements EvaluationRepository {
  public readonly createdVersions: EvaluationVersionRecord[] = [];
  public outputNormalizationVersion: string | null = null;

  public findReadyEvaluation(): Promise<EvaluationVersionRecord | null> {
    return Promise.resolve(this.createdVersions[0] ?? null);
  }

  public loadTranscriptBundle(): Promise<EvaluationTranscriptBundle> {
    return Promise.resolve({
      transcriptId,
      transcriptVersionId,
      interviewSessionId,
      transcriptConfidence: "moderate",
      segments: [createSegment()],
    });
  }

  public createEvaluationVersion(
    input: Parameters<EvaluationRepository["createEvaluationVersion"]>[0],
  ): Promise<EvaluationVersionRecord> {
    this.outputNormalizationVersion = input.outputNormalizationVersion;
    const version: EvaluationVersionRecord = {
      id: "evaluation_version_1" as never,
      companyId: tenant.companyId,
      evaluationRunId: "evaluation_run_1" as never,
      interviewSessionId,
      transcriptId,
      transcriptVersionId,
      versionNumber: 1,
      status: "ready",
      overallScore: input.result.overallScore,
      overallConfidence: input.result.overallConfidence,
      transcriptConfidence: input.result.transcriptConfidence,
      summary: input.result.summary,
      recommendation: input.result.recommendation,
      completedAt: input.result.responseReceivedAt,
    };
    this.createdVersions.push(version);
    return Promise.resolve(version);
  }

  public markEvaluationReviewed(): Promise<EvaluationVersionRecord | null> {
    return Promise.resolve(this.createdVersions[0] ?? null);
  }

  public createOverride(): Promise<EvaluationOverrideRecord> {
    return Promise.resolve({
      id: "override_1",
      companyId: tenant.companyId,
      interviewSessionId,
      evaluationVersionId: "evaluation_version_1" as never,
      target: "overall",
      competencyScoreId: null,
      previousScore: 3,
      newScore: 4,
      reason: "Human reviewer adjustment.",
      createdByUserId: "user_1",
      createdAt: new Date("2026-07-01T00:00:00.000Z"),
    });
  }

  public createHumanDecision(): Promise<HumanDecisionRecord> {
    return Promise.resolve({
      id: "decision_1",
      companyId: tenant.companyId,
      interviewSessionId,
      fromDecision: null,
      toDecision: "hold",
      reason: "Needs team review.",
      createdByUserId: "user_1",
      createdAt: new Date("2026-07-01T00:00:00.000Z"),
    });
  }
}

function createSegment(overrides: Partial<TranscriptSegmentRecord> = {}): TranscriptSegmentRecord {
  return {
    id: "segment_1" as never,
    companyId: tenant.companyId,
    transcriptId,
    transcriptVersionId,
    interviewSessionId,
    interviewTurnId: "turn_1",
    sequence: 1,
    speaker: "candidate",
    startMs: 0,
    endMs: 45_000,
    text: "I designed a reliable payment workflow with retries and clear audit history.",
    confidence: 0.92,
    language: "en",
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    ...overrides,
  };
}

function createProviderResult(overrides: {
  readonly claim?: string;
  readonly excerpt?: string;
}): EvaluationProviderResult {
  const now = new Date("2026-07-01T00:00:00.000Z");
  return {
    provider: "development",
    providerModel: "fixture",
    providerModelVersion: "fixture-v1",
    requestStartedAt: now,
    responseReceivedAt: now,
    latencyMs: 0,
    usage: {},
    estimatedCostCents: 0,
    overallScore: 3,
    overallConfidence: "moderate",
    transcriptConfidence: "moderate",
    summary: "Decision-support summary.",
    recommendation: "Review evidence before making a decision.",
    competencies: [
      {
        competencyKey: "communication",
        label: "Communication",
        score: 3,
        confidence: "moderate",
        rationale: "Assessment is based on transcript evidence.",
        incomplete: false,
        evidence: [
          {
            transcriptSegmentId: "segment_1",
            interviewTurnId: "turn_1",
            claim: overrides.claim ?? "Evidence supports the competency assessment.",
            excerpt: overrides.excerpt ?? "reliable payment workflow",
          },
        ],
      },
    ],
    strengths: [],
    developmentAreas: [],
    limitations: [],
    providerRequestHash: "request_hash",
    providerResponseHash: "response_hash",
    metadata: {},
  };
}
