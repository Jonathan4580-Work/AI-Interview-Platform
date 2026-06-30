import { createHash } from "node:crypto";

import { z } from "zod";

import { env } from "@/config";

import type {
  EvaluationProvider,
  EvaluationProviderResult,
  ProviderCompetencyResult,
} from "./types";

const providerConfidenceSchema = z.enum(["high", "moderate", "limited", "insufficient_evidence"]);

const providerResponseSchema = z.object({
  overallScore: z.number().min(1).max(5).nullable(),
  overallConfidence: providerConfidenceSchema,
  summary: z.string().min(1).max(4_000),
  recommendation: z.string().max(1_000).nullable(),
  competencies: z
    .array(
      z.object({
        competencyKey: z.string().min(1).max(80),
        label: z.string().min(1).max(160),
        score: z.number().min(1).max(5).nullable(),
        confidence: providerConfidenceSchema,
        rationale: z.string().min(1).max(2_000),
        incomplete: z.boolean(),
        evidence: z.array(
          z.object({
            transcriptSegmentId: z.string().nullable(),
            interviewTurnId: z.string().nullable(),
            claim: z.string().min(1).max(1_000),
            excerpt: z.string().min(1).max(1_000),
          }),
        ),
      }),
    )
    .min(1),
  strengths: z.array(z.string().min(1).max(1_000)).max(10),
  developmentAreas: z.array(z.string().min(1).max(1_000)).max(10),
  limitations: z
    .array(
      z.object({
        code: z.string().min(1).max(80),
        message: z.string().min(1).max(1_000),
        confidenceImpact: providerConfidenceSchema,
      }),
    )
    .max(10),
});

export class DevelopmentEvaluationProvider implements EvaluationProvider {
  public readonly providerKey = "development" as const;

  public evaluate(
    input: Parameters<EvaluationProvider["evaluate"]>[0],
  ): Promise<EvaluationProviderResult> {
    const started = new Date();
    if (input.redactedInput.segments.length === 0) {
      return Promise.resolve(createEmptyDevelopmentResult(input, started));
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
    return Promise.resolve(createDevelopmentResult(input, started, response));
  }
}

export class DeepSeekEvaluationProvider implements EvaluationProvider {
  public readonly providerKey = "deepseek" as const;

  public async evaluate(
    input: Parameters<EvaluationProvider["evaluate"]>[0],
  ): Promise<EvaluationProviderResult> {
    if (!env.DEEPSEEK_API_KEY) {
      throw new EvaluationProviderError(
        "DeepSeek API key is not configured.",
        "provider_unavailable",
      );
    }
    const started = new Date();
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, env.EVALUATION_PROVIDER_TIMEOUT_MS);
    try {
      const response = await fetch(env.DEEPSEEK_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: env.DEEPSEEK_MODEL,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: input.governance.prompt.systemPrompt },
            {
              role: "user",
              content: `${input.governance.prompt.userPromptTemplate}\n${JSON.stringify(input.redactedInput)}`,
            },
          ],
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new EvaluationProviderError("DeepSeek request failed.", "provider_retryable");
      }
      const raw = (await response.json()) as {
        choices?: readonly { readonly message?: { readonly content?: string } }[];
        usage?: Record<string, unknown>;
      };
      const content = raw.choices?.[0]?.message?.content;
      if (typeof content !== "string") {
        throw new EvaluationProviderError(
          "DeepSeek response did not include JSON content.",
          "malformed_output",
        );
      }
      const parsed = providerResponseSchema.parse(JSON.parse(content));
      const received = new Date();
      return {
        provider: this.providerKey,
        providerModel: env.DEEPSEEK_MODEL,
        providerModelVersion: null,
        requestStartedAt: started,
        responseReceivedAt: received,
        latencyMs: received.getTime() - started.getTime(),
        usage: raw.usage ?? {},
        estimatedCostCents: null,
        transcriptConfidence: parsed.overallConfidence,
        providerRequestHash: hashStable(input.redactedInput),
        providerResponseHash: hashStable(parsed),
        metadata: { schemaVersion: 1 },
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
      if (error instanceof Error && error.name === "AbortError") {
        throw new EvaluationProviderError("Provider request timed out.", "provider_timeout");
      }
      throw new EvaluationProviderError("Provider request failed.", "provider_retryable");
    } finally {
      clearTimeout(timeout);
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
  return env.EVALUATION_PROVIDER === "deepseek"
    ? new DeepSeekEvaluationProvider()
    : new DevelopmentEvaluationProvider();
}

function createEmptyDevelopmentResult(
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
  return createDevelopmentResult(input, started, {
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

function createDevelopmentResult(
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
    provider: "development",
    providerModel: "deterministic-development-evaluator",
    providerModelVersion: "evaluation-dev-v1",
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

function hashStable(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
