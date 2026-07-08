import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AI_OUTPUT_NORMALIZATION_VERSION,
  AI_REDACTION_POLICY_VERSION,
  redactEvaluationInput,
  type AiGovernanceArtifacts,
  type AiGovernanceRepository,
} from "@/modules/ai-governance";
import { AuditWriter, type AuditEventStore, type PersistedAuditEventInput } from "@/modules/audit";
import { env } from "@/config";
import {
  OpenAIEvaluationProvider,
  DeterministicEvaluationProvider,
  EvaluationDomainError,
  EvaluationProviderError,
  EvaluationService,
  createEvaluationProvider,
  parseOpenAIProviderOutput,
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
  afterEach(() => {
    vi.unstubAllGlobals();
    env.EVALUATION_PROVIDER = originalEvaluationProvider;
    env.OPENAI_API_KEY = originalOpenAIApiKey;
    env.OPENAI_MODEL = originalOpenAIModel;
    env.EVALUATION_PROVIDER_TIMEOUT_MS = originalProviderTimeoutMs;
  });

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

  it("keeps substantive answer content in provider input after redaction", () => {
    const redacted = redactEvaluationInput({
      interviewSessionId,
      transcriptVersionId,
      rubric: governance.rubric,
      segments: [
        createSegment({
          text: "I led the payments reliability project and reduced queue failures with retry monitoring.",
        }),
      ],
    });

    expect(redacted.segments[0]?.text).toContain("payments reliability project");
    expect(redacted.segments[0]?.text).toContain("retry monitoring");
    expect(redacted.segments[0]?.text).not.toContain("Recorded answer for interview question");
  });

  it("deterministic provider returns deterministic evidence-linked results", async () => {
    const provider = new DeterministicEvaluationProvider();
    const redactedInput = redactEvaluationInput({
      interviewSessionId,
      transcriptVersionId,
      rubric: governance.rubric,
      segments: [createSegment()],
    });

    const first = await provider.evaluate({ redactedInput, governance });
    const second = await provider.evaluate({ redactedInput, governance });

    expect(first.provider).toBe("deterministic");
    expect(first.providerResponseHash).toBe(second.providerResponseHash);
    expect(first.competencies[0]?.evidence[0]?.transcriptSegmentId).toBe("segment_1");
  });

  it("deterministic provider marks missing transcript evidence as insufficient", async () => {
    const provider = new DeterministicEvaluationProvider();
    const redactedInput = redactEvaluationInput({
      interviewSessionId,
      transcriptVersionId,
      rubric: governance.rubric,
      segments: [],
    });

    const result = await provider.evaluate({ redactedInput, governance });

    expect(result.overallScore).toBeNull();
    expect(result.overallConfidence).toBe("insufficient_evidence");
    expect(result.competencies[0]?.score).toBeNull();
  });

  it("selects deterministic and OpenAI providers from configuration", () => {
    env.EVALUATION_PROVIDER = "deterministic";
    expect(createEvaluationProvider()).toBeInstanceOf(DeterministicEvaluationProvider);

    env.EVALUATION_PROVIDER = "openai";
    expect(createEvaluationProvider()).toBeInstanceOf(OpenAIEvaluationProvider);
  });

  it("OpenAI adapter remains unavailable without an API key", async () => {
    env.OPENAI_API_KEY = undefined;

    await expect(
      new OpenAIEvaluationProvider().evaluate({
        redactedInput: redactEvaluationInput({
          interviewSessionId,
          transcriptVersionId,
          rubric: governance.rubric,
          segments: [createSegment()],
        }),
        governance,
      }),
    ).rejects.toMatchObject({ code: "provider_unavailable" });
  });

  it("OpenAI adapter returns validated structured responses", async () => {
    env.OPENAI_API_KEY = "test-key";
    env.OPENAI_MODEL = "gpt-5-mini";

    const provider = new OpenAIEvaluationProvider(
      createOpenAIClientFixture({
        outputText: JSON.stringify(createOpenAIProviderOutput()),
      }),
    );

    const result = await provider.evaluate({
      redactedInput: redactEvaluationInput({
        interviewSessionId,
        transcriptVersionId,
        rubric: governance.rubric,
        segments: [createSegment()],
      }),
      governance,
    });

    expect(result.provider).toBe("openai");
    expect(result.providerModel).toBe("gpt-5-mini");
    expect(result.usage).toMatchObject({ inputTokens: 10, outputTokens: 20, totalTokens: 30 });
    expect(result.competencies[0]?.evidence[0]?.excerpt).toBe("reliable payment workflow");
  });

  it("normalizes malformed OpenAI output", async () => {
    env.OPENAI_API_KEY = "test-key";

    await expect(
      new OpenAIEvaluationProvider(createOpenAIClientFixture({ outputText: "{not-json" })).evaluate(
        {
          redactedInput: redactEvaluationInput({
            interviewSessionId,
            transcriptVersionId,
            rubric: governance.rubric,
            segments: [createSegment()],
          }),
          governance,
        },
      ),
    ).rejects.toMatchObject({ code: "malformed_output" });
  });

  it("normalizes OpenAI provider timeouts", async () => {
    env.OPENAI_API_KEY = "test-key";
    await expect(
      new OpenAIEvaluationProvider(
        createOpenAIClientFixture({
          rejectWith: Object.assign(new Error("Request timeout"), { name: "TimeoutError" }),
        }),
      ).evaluate({
        redactedInput: redactEvaluationInput({
          interviewSessionId,
          transcriptVersionId,
          rubric: governance.rubric,
          segments: [createSegment()],
        }),
        governance,
      }),
    ).rejects.toMatchObject({ code: "provider_timeout" });
  });

  it("normalizes OpenAI rate limits and authentication failures", async () => {
    env.OPENAI_API_KEY = "test-key";
    await expect(
      new OpenAIEvaluationProvider(
        createOpenAIClientFixture({
          rejectWith: Object.assign(new Error("rate limited"), { status: 429 }),
        }),
      ).evaluate({
        redactedInput: redactEvaluationInput({
          interviewSessionId,
          transcriptVersionId,
          rubric: governance.rubric,
          segments: [createSegment()],
        }),
        governance,
      }),
    ).rejects.toMatchObject({ code: "provider_retryable" });

    await expect(
      new OpenAIEvaluationProvider(
        createOpenAIClientFixture({
          rejectWith: Object.assign(new Error("unauthorized"), { status: 401 }),
        }),
      ).evaluate({
        redactedInput: redactEvaluationInput({
          interviewSessionId,
          transcriptVersionId,
          rubric: governance.rubric,
          segments: [createSegment()],
        }),
        governance,
      }),
    ).rejects.toMatchObject({ code: "provider_unavailable" });
  });

  it("preserves safe OpenAI diagnostics without leaking secrets", async () => {
    env.OPENAI_API_KEY = "test-key";
    const provider = new OpenAIEvaluationProvider(
      createOpenAIClientFixture({
        rejectWith: Object.assign(new Error("schema rejected sk-test-secret"), {
          status: 400,
          code: "invalid_json_schema",
          type: "invalid_request_error",
          request_id: "req_openai_123",
        }),
      }),
    );

    await expect(
      provider.evaluate({
        redactedInput: redactEvaluationInput({
          interviewSessionId,
          transcriptVersionId,
          rubric: governance.rubric,
          segments: [createSegment()],
        }),
        governance,
      }),
    ).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(EvaluationProviderError);
      const providerError = error as EvaluationProviderError;
      expect(providerError.message).toContain("status=400");
      expect(providerError.message).toContain("code=invalid_json_schema");
      expect(providerError.message).toContain("type=invalid_request_error");
      expect(providerError.message).toContain("requestId=req_openai_123");
      expect(providerError.message).not.toContain("sk-test-secret");
      expect(providerError.details).toMatchObject({
        status: 400,
        code: "invalid_json_schema",
        type: "invalid_request_error",
        requestId: "req_openai_123",
      });
      return true;
    });
  });

  it("returns a valid insufficient-evidence result for empty OpenAI transcript input", async () => {
    env.OPENAI_API_KEY = "test-key";
    const result = await new OpenAIEvaluationProvider(
      createOpenAIClientFixture({ outputText: JSON.stringify(createOpenAIProviderOutput()) }),
    ).evaluate({
      redactedInput: redactEvaluationInput({
        interviewSessionId,
        transcriptVersionId,
        rubric: governance.rubric,
        segments: [createSegment({ text: "" })],
      }),
      governance,
    });

    expect(result.provider).toBe("openai");
    expect(result.overallScore).toBeNull();
    expect(result.overallConfidence).toBe("insufficient_evidence");
    expect(result.competencies[0]?.incomplete).toBe(true);
    expect(result.competencies[0]?.evidence).toEqual([]);
  });

  it("rejects incomplete OpenAI schema output before persistence", () => {
    expect(() =>
      parseOpenAIProviderOutput(
        JSON.stringify({
          overallScore: 3,
          overallConfidence: "moderate",
          summary: "Missing required fields.",
        }),
      ),
    ).toThrow();
  });

  it("keeps OpenAI secrets out of provider output metadata", async () => {
    env.OPENAI_API_KEY = "sk-test-secret";
    const result = await new OpenAIEvaluationProvider(
      createOpenAIClientFixture({
        outputText: JSON.stringify(createOpenAIProviderOutput()),
      }),
    ).evaluate({
      redactedInput: redactEvaluationInput({
        interviewSessionId,
        transcriptVersionId,
        rubric: governance.rubric,
        segments: [createSegment()],
      }),
      governance,
    });

    expect(JSON.stringify(result)).not.toContain("sk-test-secret");
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

  it("reprocessing creates a new evaluation version instead of mutating the reviewed result", async () => {
    const repo = new InMemoryEvaluationRepository();
    const audit = new InMemoryAuditStore();
    const service = createService(repo, audit);
    const first = await service.evaluateInterview({ context, interviewSessionId });
    const userContext = {
      ...context,
      actor: { type: "user" as const, id: "user_1" },
    };

    const second = await service.reprocessInterview({
      context: userContext,
      interviewSessionId,
      reason: "Transcript correction was approved.",
    });

    expect(second.id).not.toBe(first.id);
    expect(repo.createdVersions).toHaveLength(2);
    expect(audit.events.at(-1)?.action).toBe("evaluation.reprocessed");
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
const originalEvaluationProvider = env.EVALUATION_PROVIDER;
const originalOpenAIApiKey = env.OPENAI_API_KEY;
const originalOpenAIModel = env.OPENAI_MODEL;
const originalProviderTimeoutMs = env.EVALUATION_PROVIDER_TIMEOUT_MS;
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
    new DeterministicEvaluationProvider(),
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
      id: `evaluation_version_${String(this.createdVersions.length + 1)}` as never,
      companyId: tenant.companyId,
      evaluationRunId: "evaluation_run_1" as never,
      interviewSessionId,
      transcriptId,
      transcriptVersionId,
      versionNumber: this.createdVersions.length + 1,
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
    provider: "deterministic",
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

function createOpenAIProviderOutput(): unknown {
  return {
    overallScore: 3,
    overallConfidence: "moderate",
    summary: "Decision-support summary based on cited transcript evidence.",
    recommendation: "Review the cited evidence before making a hiring decision.",
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
            claim: "Evidence supports the competency assessment.",
            excerpt: "reliable payment workflow",
          },
        ],
      },
    ],
    strengths: ["Provided relevant evidence."],
    developmentAreas: ["Human review required."],
    limitations: [],
  };
}

function createOpenAIClientFixture(input: {
  readonly outputText?: string;
  readonly rejectWith?: Error;
}) {
  return {
    responses: {
      create: vi.fn(() => {
        if (input.rejectWith !== undefined) {
          return Promise.reject(input.rejectWith);
        }
        return Promise.resolve({
          id: "resp_test",
          created_at: 1_783_000_000,
          output_text: input.outputText ?? JSON.stringify(createOpenAIProviderOutput()),
          error: null,
          incomplete_details: null,
          usage: {
            input_tokens: 10,
            output_tokens: 20,
            total_tokens: 30,
            input_tokens_details: { cached_tokens: 0 },
            output_tokens_details: { reasoning_tokens: 0 },
          },
        });
      }),
    },
  } as never;
}
