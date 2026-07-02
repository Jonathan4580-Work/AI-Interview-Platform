import OpenAI from "openai";

import { env } from "@/config";
import { parseOpenAIProviderOutput } from "@/modules/evaluation";

const smokeOutput = {
  overallScore: 3,
  overallConfidence: "moderate",
  summary: "The response can be evaluated as decision support from the supplied evidence.",
  recommendation: "Human review should confirm the cited evidence before any decision.",
  competencies: [
    {
      competencyKey: "communication",
      label: "Communication",
      score: 3,
      confidence: "moderate",
      rationale: "Assessment is limited to the supplied synthetic evidence.",
      incomplete: false,
      evidence: [
        {
          transcriptSegmentId: "synthetic_segment_1",
          interviewTurnId: "synthetic_turn_1",
          claim: "The candidate described a structured workflow.",
          excerpt: "structured onboarding workflow",
        },
      ],
    },
  ],
  strengths: ["Structured response."],
  developmentAreas: ["Needs human review."],
  limitations: [],
};

const smokeSchema = {
  type: "object",
  additionalProperties: false,
  required: ["result"],
  properties: {
    result: {
      type: "string",
      enum: ["ok"],
    },
  },
} as const;

async function main(): Promise<void> {
  if (env.APP_ENV !== "staging") {
    throw new Error("staging:openai-smoke must only run when APP_ENV=staging.");
  }
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for staging OpenAI smoke tests.");
  }

  const client = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    baseURL: env.OPENAI_API_URL,
    timeout: env.EVALUATION_PROVIDER_TIMEOUT_MS,
  });

  const response = await client.responses.create(
    {
      model: env.OPENAI_MODEL,
      instructions:
        "Return the exact structured result requested. Do not include secrets, candidate data, or explanations.",
      input: 'Return {"result":"ok"} for an Aptly staging provider smoke check.',
      text: {
        format: {
          type: "json_schema",
          name: "aptly_openai_smoke",
          strict: true,
          schema: smokeSchema,
        },
      },
      store: false,
    },
    { timeout: env.EVALUATION_PROVIDER_TIMEOUT_MS },
  );

  const parsed = JSON.parse(response.output_text) as { readonly result?: unknown };
  if (parsed.result !== "ok") {
    throw new Error("OpenAI smoke response failed structured output validation.");
  }
  parseOpenAIProviderOutput(JSON.stringify(smokeOutput));

  console.log(
    JSON.stringify(
      {
        model: env.OPENAI_MODEL,
        success: true,
        tokenUsage: response.usage
          ? {
              inputTokens: response.usage.input_tokens,
              outputTokens: response.usage.output_tokens,
              totalTokens: response.usage.total_tokens,
            }
          : null,
        estimatedCost: "not_calculated_without_configured_pricing_table",
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown OpenAI smoke failure.";
  console.error(`OpenAI staging smoke failed: ${message}`);
  process.exitCode = 1;
});
