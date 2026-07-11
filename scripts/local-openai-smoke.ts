import OpenAI from "openai";

import { env } from "@/config";
import { parseOpenAIProviderOutput } from "@/modules/evaluation";

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["result"],
  properties: {
    result: { type: "string", enum: ["ok"] },
  },
} as const;

async function main(): Promise<void> {
  if (env.APP_ENV !== "development") {
    throw new Error("Local OpenAI smoke requires APP_ENV=development.");
  }

  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for local OpenAI smoke tests.");
  }

  const client = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    baseURL: env.OPENAI_API_URL,
    timeout: env.EVALUATION_PROVIDER_TIMEOUT_MS,
  });

  const response = await client.responses.create(
    {
      model: env.OPENAI_MODEL,
      instructions: "Return only the requested JSON structure.",
      input: 'Return {"result":"ok"} for an Aptly local provider smoke check.',
      text: {
        format: {
          type: "json_schema",
          name: "aptly_local_openai_smoke",
          strict: true,
          schema,
        },
      },
      store: false,
    },
    { timeout: env.EVALUATION_PROVIDER_TIMEOUT_MS },
  );

  const parsed = JSON.parse(response.output_text) as {
    readonly result?: unknown;
  };

  if (parsed.result !== "ok") {
    throw new Error("OpenAI smoke response failed structured output validation.");
  }

  parseOpenAIProviderOutput(
    JSON.stringify({
      overallScore: 3,
      overallConfidence: "moderate",
      summary: "Synthetic local provider smoke output.",
      recommendation: "Human review should confirm the evidence.",
      competencies: [
        {
          competencyKey: "communication",
          label: "Communication",
          score: 3,
          confidence: "moderate",
          rationale: "The synthetic smoke payload demonstrates a valid competency structure.",
          incomplete: false,
          evidence: [
            {
              transcriptSegmentId: null,
              interviewTurnId: null,
              claim: "The candidate communicated clearly in the synthetic test.",
              excerpt: "Synthetic local provider smoke evidence.",
            },
          ],
        },
      ],
      strengths: ["Clear synthetic response structure."],
      developmentAreas: ["Human review is still required."],
      limitations: [
        {
          code: "synthetic_smoke_test",
          message: "This result validates provider connectivity and schema parsing only.",
          confidenceImpact: "limited",
        },
      ],
    }),
  );

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
  const message = error instanceof Error ? error.message : "Unknown local OpenAI smoke failure.";

  console.error(`Local OpenAI smoke FAILED: ${message}`);
  process.exitCode = 1;
});
