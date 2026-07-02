import { createHash } from "node:crypto";

import OpenAI from "openai";
import { z } from "zod";

import { env } from "@/config";

import type {
  EvaluationProvider,
  EvaluationProviderResult,
  ProviderCompetencyResult,
} from "./types";
import type { Response } from "openai/resources/responses/responses";

const providerConfidenceSchema = z.enum(["high", "moderate", "limited", "insufficient_evidence"]);

const providerEvidenceSchema = z
  .object({
    transcriptSegmentId: z.string().nullable(),
    interviewTurnId: z.string().nullable(),
    claim: z.string().min(1).max(1_000),
    excerpt: z.string().min(1).max(1_000),
  })
  .strict();

const providerCompetencySchema = z
  .object({
    competencyKey: z.string().min(1).max(80),
    label: z.string().min(1).max(160),
    score: z.number().min(1).max(5).nullable(),
    confidence: providerConfidenceSchema,
    rationale: z.string().min(1).max(2_000),
    incomplete: z.boolean(),
    evidence: z.array(providerEvidenceSchema),
  })
  .strict();

const providerLimitationSchema = z
  .object({
    code: z.string().min(1).max(80),
    message: z.string().min(1).max(1_000),
    confidenceImpact: providerConfidenceSchema,
  })
  .strict();

const providerResponseSchema = z
  .object({
    overallScore: z.number().min(1).max(5).nullable(),
    overallConfidence: providerConfidenceSchema,
    summary: z.string().min(1).max(4_000),
    recommendation: z.string().max(1_000).nullable(),
    competencies: z.array(providerCompetencySchema).min(1),
    strengths: z.array(z.string().min(1).max(1_000)).max(10),
    developmentAreas: z.array(z.string().min(1).max(1_000)).max(10),
    limitations: z.array(providerLimitationSchema).max(10),
  })
  .strict();

const OPENAI_EVALUATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "overallScore",
    "overallConfidence",
    "summary",
    "recommendation",
    "competencies",
    "strengths",
    "developmentAreas",
    "limitations",
  ],
  properties: {
    overallScore: { type: ["number", "null"], minimum: 1, maximum: 5 },
    overallConfidence: confidenceJsonSchema(),
    summary: { type: "string", minLength: 1, maxLength: 4000 },
    recommendation: { type: ["string", "null"], maxLength: 1000 },
    competencies: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "competencyKey",
          "label",
          "score",
          "confidence",
          "rationale",
          "incomplete",
          "evidence",
        ],
        properties: {
          competencyKey: { type: "string", minLength: 1, maxLength: 80 },
          label: { type: "string", minLength: 1, maxLength: 160 },
          score: { type: ["number", "null"], minimum: 1, maximum: 5 },
          confidence: confidenceJsonSchema(),
          rationale: { type: "string", minLength: 1, maxLength: 2000 },
          incomplete: { type: "boolean" },
          evidence: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["transcriptSegmentId", "interviewTurnId", "claim", "excerpt"],
              properties: {
                transcriptSegmentId: { type: ["string", "null"] },
                interviewTurnId: { type: ["string", "null"] },
                claim: { type: "string", minLength: 1, maxLength: 1000 },
                excerpt: { type: "string", minLength: 1, maxLength: 1000 },
              },
            },
          },
        },
      },
    },
    strengths: {
      type: "array",
      maxItems: 10,
      items: { type: "string", minLength: 1, maxLength: 1000 },
    },
    developmentAreas: {
      type: "array",
      maxItems: 10,
      items: { type: "string", minLength: 1, maxLength: 1000 },
    },
    limitations: {
      type: "array",
      maxItems: 10,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["code", "message", "confidenceImpact"],
        properties: {
          code: { type: "string", minLength: 1, maxLength: 80 },
          message: { type: "string", minLength: 1, maxLength: 1000 },
          confidenceImpact: confidenceJsonSchema(),
        },
      },
    },
  },
} as const;

interface OpenAIResponsesClient {
  responses: {
    create(
      body: Parameters<OpenAI["responses"]["create"]>[0],
      options?: Parameters<OpenAI["responses"]["create"]>[1],
    ): Promise<Response>;
  };
}

export class DeterministicEvaluationProvider implements EvaluationProvider {
  public readonly providerKey = "deterministic" as const;

  public evaluate(
    input: Parameters<EvaluationProvider["evaluate"]>[0],
  ): Promise<EvaluationProviderResult> {
    const started = new Date();
    if (input.redactedInput.segments.length === 0) {
      return Promise.resolve(createEmptyDeterministicResult(input, started));
    }

    const firstSegment = input.redactedInput.segments[0];
    const competencies: ProviderCompetencyResult[] = input.redactedInput.rubric.competencies.map(
      (competency, index) => ({
        competencyKey: competency.key,
        label: competency.label,
        score: Math.min(5, Math.max(1, 3 + (index % 2))),
        confidence: "moderate",
        rationale: `Assessment is based on transcript evidence for ${competency.label.toLowerCase()}.`,
        incomplete: false,
        evidence: [
          {
            transcriptSegmentId: firstSegment.transcriptSegmentId,
            interviewTurnId: firstSegment.interviewTurnId,
            claim: `Evidence supports ${competency.label.toLowerCase()} assessment.`,
            excerpt: firstSegment.text.slice(0, 240),
          },
        ],
      }),
    );
    const response = {
      overallScore: 3.5,
      overallConfidence: "moderate",
      summary:
        "The candidate provided assessable interview responses. The result is decision-support only and requires human review.",
      recommendation:
        "Use this evaluation as structured decision support after reviewing cited evidence.",
      competencies,
      strengths: ["Provided responses with assessable evidence."],
      developmentAreas: ["Human review required."],
      limitations: [],
    } satisfies Pick<
      EvaluationProviderResult,
      | "overallScore"
      | "overallConfidence"
      | "summary"
      | "recommendation"
      | "competencies"
      | "strengths"
      | "developmentAreas"
      | "limitations"
    >;
    return Promise.resolve(createDeterministicResult(input, started, response));
  }
}

export class OpenAIEvaluationProvider implements EvaluationProvider {
  public readonly providerKey = "openai" as const;

  public constructor(private readonly client: OpenAIResponsesClient = createOpenAIClient()) {}

  public async evaluate(
    input: Parameters<EvaluationProvider["evaluate"]>[0],
  ): Promise<EvaluationProviderResult> {
    if (!env.OPENAI_API_KEY) {
      throw new EvaluationProviderError(
        "OpenAI API key is not configured.",
        "provider_unavailable",
      );
    }
    const started = new Date();
    try {
      const response = await this.client.responses.create(
        {
          model: env.OPENAI_MODEL,
          instructions: [
            input.governance.prompt.systemPrompt,
            "Return only the requested structured JSON. Do not include hidden reasoning, chain-of-thought, protected-characteristic inferences, appearance-based scoring, misconduct verdicts, candidate ranking, or automatic hiring decisions.",
          ].join("\n\n"),
          input: `${input.governance.prompt.userPromptTemplate}\n\nEvaluation input:\n${JSON.stringify(
            input.redactedInput,
          )}`,
          text: {
            format: {
              type: "json_schema",
              name: "aptly_evaluation_result",
              strict: true,
              schema: OPENAI_EVALUATION_SCHEMA,
            },
          },
          store: false,
        },
        { timeout: env.EVALUATION_PROVIDER_TIMEOUT_MS },
      );
      if (response.error !== null) {
        throw new EvaluationProviderError("OpenAI response failed.", "provider_retryable");
      }
      if (response.incomplete_details !== null) {
        throw new EvaluationProviderError("OpenAI response was incomplete.", "provider_retryable");
      }
      const output = response.output_text;
      if (output.trim().length === 0) {
        throw new EvaluationProviderError(
          "OpenAI response did not include JSON content.",
          "malformed_output",
        );
      }
      const parsed = providerResponseSchema.parse(JSON.parse(output));
      const received = new Date();
      return {
        provider: this.providerKey,
        providerModel: env.OPENAI_MODEL,
        providerModelVersion: null,
        requestStartedAt: started,
        responseReceivedAt: received,
        latencyMs: received.getTime() - started.getTime(),
        usage: sanitizeOpenAIUsage(response.usage),
        estimatedCostCents: estimateCostCents(response.usage),
        transcriptConfidence: parsed.overallConfidence,
        providerRequestHash: hashStable(input.redactedInput),
        providerResponseHash: hashStable(parsed),
        metadata: {
          schemaVersion: 1,
          responseId: response.id,
          responseCreatedAt: response.created_at,
        },
        ...parsed,
      };
    } catch (error) {
      if (error instanceof EvaluationProviderError) {
        throw error;
      }
      if (error instanceof z.ZodError || error instanceof SyntaxError) {
        throw new EvaluationProviderError(
          "Provider output failed schema validation.",
          "malformed_output",
        );
      }
      throw normalizeOpenAIError(error);
    }
  }
}

export class EvaluationProviderError extends Error {
  public constructor(
    message: string,
    public readonly code:
      "provider_unavailable" | "provider_timeout" | "provider_retryable" | "malformed_output",
  ) {
    super(message);
    this.name = "EvaluationProviderError";
  }
}

export function createEvaluationProvider(): EvaluationProvider {
  return env.EVALUATION_PROVIDER === "openai"
    ? new OpenAIEvaluationProvider()
    : new DeterministicEvaluationProvider();
}

export function getOpenAIEvaluationSchema(): Readonly<Record<string, unknown>> {
  return OPENAI_EVALUATION_SCHEMA;
}

export function parseOpenAIProviderOutput(output: string) {
  return providerResponseSchema.parse(JSON.parse(output));
}

function createEmptyDeterministicResult(
  input: Parameters<EvaluationProvider["evaluate"]>[0],
  started: Date,
): EvaluationProviderResult {
  const competencies: ProviderCompetencyResult[] = input.redactedInput.rubric.competencies.map(
    (competency) => ({
      competencyKey: competency.key,
      label: competency.label,
      score: null,
      confidence: "insufficient_evidence",
      rationale: "No transcript evidence was available for this competency.",
      incomplete: true,
      evidence: [],
    }),
  );
  return createDeterministicResult(input, started, {
    overallScore: null,
    overallConfidence: "insufficient_evidence",
    summary: "The interview could not be evaluated because transcript evidence is unavailable.",
    recommendation: "Human review is required because transcript evidence is unavailable.",
    competencies,
    strengths: [],
    developmentAreas: ["Transcript evidence is unavailable."],
    limitations: [
      {
        code: "missing_transcript_evidence",
        message: "No transcript segments were available.",
        confidenceImpact: "insufficient_evidence",
      },
    ],
  });
}

function createDeterministicResult(
  input: Parameters<EvaluationProvider["evaluate"]>[0],
  started: Date,
  response: Pick<
    EvaluationProviderResult,
    | "overallScore"
    | "overallConfidence"
    | "summary"
    | "recommendation"
    | "competencies"
    | "strengths"
    | "developmentAreas"
    | "limitations"
  >,
): EvaluationProviderResult {
  const received = new Date();
  return {
    provider: "deterministic",
    providerModel: "deterministic-development-evaluator",
    providerModelVersion: "evaluation-deterministic-v1",
    requestStartedAt: started,
    responseReceivedAt: received,
    latencyMs: received.getTime() - started.getTime(),
    usage: {
      promptUnits: input.redactedInput.segments.length,
      completionUnits: response.competencies.length,
    },
    estimatedCostCents: 0,
    transcriptConfidence: response.overallConfidence,
    providerRequestHash: hashStable(input.redactedInput),
    providerResponseHash: hashStable(response),
    metadata: { schemaVersion: 1 },
    ...response,
  };
}

function createOpenAIClient(): OpenAIResponsesClient {
  return new OpenAI({
    apiKey: env.OPENAI_API_KEY ?? "missing-openai-api-key",
    baseURL: env.OPENAI_API_URL,
    timeout: env.EVALUATION_PROVIDER_TIMEOUT_MS,
  });
}

function normalizeOpenAIError(error: unknown): EvaluationProviderError {
  if (error instanceof OpenAI.APIError) {
    if (error.status === 401 || error.status === 403) {
      return new EvaluationProviderError("OpenAI authentication failed.", "provider_unavailable");
    }
    if (error.status === 429 || (error.status !== undefined && error.status >= 500)) {
      return new EvaluationProviderError("OpenAI request failed.", "provider_retryable");
    }
    return new EvaluationProviderError("OpenAI request failed.", "provider_retryable");
  }
  const status = readHttpStatus(error);
  if (status === 401 || status === 403) {
    return new EvaluationProviderError("OpenAI authentication failed.", "provider_unavailable");
  }
  if (status === 429 || (status !== null && status >= 500)) {
    return new EvaluationProviderError("OpenAI request failed.", "provider_retryable");
  }
  if (error instanceof Error && (error.name === "AbortError" || /timeout/iu.test(error.message))) {
    return new EvaluationProviderError("OpenAI request timed out.", "provider_timeout");
  }
  return new EvaluationProviderError("OpenAI request failed.", "provider_retryable");
}

function readHttpStatus(error: unknown): number | null {
  if (error !== null && typeof error === "object" && "status" in error) {
    const status = (error as { readonly status?: unknown }).status;
    return typeof status === "number" ? status : null;
  }
  return null;
}

function sanitizeOpenAIUsage(usage: Response["usage"] | null | undefined): Record<string, unknown> {
  if (usage === null || usage === undefined) {
    return {};
  }
  return {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    totalTokens: usage.total_tokens,
  };
}

function estimateCostCents(usage: Response["usage"] | null | undefined): number | null {
  if (usage === null || usage === undefined) {
    return null;
  }
  return 0;
}

function confidenceJsonSchema() {
  return {
    type: "string",
    enum: ["high", "moderate", "limited", "insufficient_evidence"],
  } as const;
}

function hashStable(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
