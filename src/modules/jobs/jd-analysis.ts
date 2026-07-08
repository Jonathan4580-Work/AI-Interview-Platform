import { createHash } from "node:crypto";

import OpenAI from "openai";
import { z } from "zod";

import { env } from "@/config";
import { logger } from "@/infra/logging";

const textArraySchema = z.array(z.string().min(1).max(800)).max(30);

const jdQuestionSchema = z
  .object({
    competencyName: z.string().min(1).max(160),
    competencyDescription: z.string().max(1_000).nullable(),
    questionText: z.string().min(10).max(2_000),
    questionType: z.enum([
      "introduction",
      "behavioral",
      "technical",
      "situational",
      "role-specific",
      "culture/team fit",
    ]),
    difficulty: z.enum(["introductory", "standard", "advanced"]),
    expectedAnswerSignals: textArraySchema,
    scoringRubric: textArraySchema,
    redFlags: textArraySchema,
    followUps: textArraySchema,
  })
  .strict();

export const jdAnalysisSchema = z
  .object({
    title: z.string().min(2).max(160),
    department: z.string().max(160).nullable(),
    employmentType: z.string().max(120).nullable(),
    workplaceType: z.string().max(120).nullable(),
    location: z.string().max(160).nullable(),
    experience: z.string().max(400).nullable(),
    responsibilities: textArraySchema,
    requiredSkills: textArraySchema,
    niceToHaveSkills: textArraySchema,
    educationAndCertifications: textArraySchema,
    toolsAndTechnologies: textArraySchema,
    seniorityExpectations: textArraySchema,
    screeningCriteria: textArraySchema,
    roleCompetencies: z
      .array(
        z
          .object({
            name: z.string().min(1).max(160),
            description: z.string().min(1).max(1_000),
          })
          .strict(),
      )
      .min(3)
      .max(8),
    interviewStructure: textArraySchema,
    scoringRubric: textArraySchema,
    redFlags: textArraySchema,
    questions: z.array(jdQuestionSchema).min(3).max(8),
  })
  .strict();

export type JobDescriptionAnalysis = z.infer<typeof jdAnalysisSchema>;

export class JobDescriptionAnalysisError extends Error {
  public constructor(
    message: string,
    public readonly code: string,
    public readonly details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = "JobDescriptionAnalysisError";
  }
}

const JD_ANALYSIS_SCHEMA_NAME = "aptly_job_description_analysis";

const JD_ANALYSIS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "title",
    "department",
    "employmentType",
    "workplaceType",
    "location",
    "experience",
    "responsibilities",
    "requiredSkills",
    "niceToHaveSkills",
    "educationAndCertifications",
    "toolsAndTechnologies",
    "seniorityExpectations",
    "screeningCriteria",
    "roleCompetencies",
    "interviewStructure",
    "scoringRubric",
    "redFlags",
    "questions",
  ],
  properties: {
    title: { type: "string" },
    department: nullableStringSchema(),
    employmentType: nullableStringSchema(),
    workplaceType: nullableStringSchema(),
    location: nullableStringSchema(),
    experience: nullableStringSchema(),
    responsibilities: stringArraySchema(),
    requiredSkills: stringArraySchema(),
    niceToHaveSkills: stringArraySchema(),
    educationAndCertifications: stringArraySchema(),
    toolsAndTechnologies: stringArraySchema(),
    seniorityExpectations: stringArraySchema(),
    screeningCriteria: stringArraySchema(),
    roleCompetencies: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "description"],
        properties: {
          name: { type: "string" },
          description: { type: "string" },
        },
      },
    },
    interviewStructure: stringArraySchema(),
    scoringRubric: stringArraySchema(),
    redFlags: stringArraySchema(),
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "competencyName",
          "competencyDescription",
          "questionText",
          "questionType",
          "difficulty",
          "expectedAnswerSignals",
          "scoringRubric",
          "redFlags",
          "followUps",
        ],
        properties: {
          competencyName: { type: "string" },
          competencyDescription: nullableStringSchema(),
          questionText: { type: "string" },
          questionType: {
            type: "string",
            enum: [
              "introduction",
              "behavioral",
              "technical",
              "situational",
              "role-specific",
              "culture/team fit",
            ],
          },
          difficulty: { type: "string", enum: ["introductory", "standard", "advanced"] },
          expectedAnswerSignals: stringArraySchema(),
          scoringRubric: stringArraySchema(),
          redFlags: stringArraySchema(),
          followUps: stringArraySchema(),
        },
      },
    },
  },
} as const;

export function hashJobDescriptionText(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export async function analyzeJobDescription(input: {
  readonly jobId: string;
  readonly companyId: string;
  readonly text: string;
}): Promise<JobDescriptionAnalysis> {
  const trimmed = input.text.trim();
  if (trimmed.length < 80) {
    return createInsufficientTextAnalysis(trimmed);
  }
  if (!env.OPENAI_API_KEY) {
    throw new JobDescriptionAnalysisError(
      "OpenAI API key is not configured.",
      "OPENAI_NOT_CONFIGURED",
    );
  }

  const startedAt = Date.now();
  const client = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    baseURL: env.OPENAI_API_URL,
    timeout: env.EVALUATION_PROVIDER_TIMEOUT_MS,
  });
  const prompt = buildJobDescriptionPrompt(trimmed);
  logger.info(
    {
      jobId: input.jobId,
      companyId: input.companyId,
      model: env.OPENAI_MODEL,
      inputLength: trimmed.length,
      schemaName: JD_ANALYSIS_SCHEMA_NAME,
      timeoutMs: env.EVALUATION_PROVIDER_TIMEOUT_MS,
    },
    "OpenAI job description analysis request prepared.",
  );

  try {
    const response = await client.responses.create(
      {
        model: env.OPENAI_MODEL,
        instructions:
          "You analyze job descriptions for HR teams. Return concise, job-related structured JSON only. Do not infer protected characteristics, health status, age, family status, ethnicity, religion, disability, gender, or appearance. Treat the output as a draft requiring HR review.",
        input: prompt,
        text: {
          format: {
            type: "json_schema",
            name: JD_ANALYSIS_SCHEMA_NAME,
            strict: true,
            schema: JD_ANALYSIS_JSON_SCHEMA,
          },
        },
      },
      { timeout: env.EVALUATION_PROVIDER_TIMEOUT_MS },
    );
    const outputText = readOutputText(response);
    const parsed = parseJobDescriptionAnalysis(outputText);
    logger.info(
      {
        jobId: input.jobId,
        companyId: input.companyId,
        durationMs: Date.now() - startedAt,
        questionCount: parsed.questions.length,
        competencyCount: parsed.roleCompetencies.length,
      },
      "OpenAI job description analysis completed.",
    );
    return parsed;
  } catch (error) {
    throw normalizeOpenAIJobError(error);
  }
}

export function parseJobDescriptionAnalysis(value: string): JobDescriptionAnalysis {
  try {
    return jdAnalysisSchema.parse(JSON.parse(value));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown validation error.";
    throw new JobDescriptionAnalysisError(
      `Job description analysis output failed validation: ${sanitizeProviderMessage(message)}`,
      "MALFORMED_AI_OUTPUT",
    );
  }
}

export function createInsufficientTextAnalysis(text: string): JobDescriptionAnalysis {
  const title = firstNonEmptyLine(text) ?? "Draft role";
  return {
    title: title.slice(0, 160),
    department: null,
    employmentType: null,
    workplaceType: null,
    location: null,
    experience: null,
    responsibilities: ["Review and complete the job description before publishing."],
    requiredSkills: ["HR review required"],
    niceToHaveSkills: [],
    educationAndCertifications: [],
    toolsAndTechnologies: [],
    seniorityExpectations: ["Not enough source text to infer seniority."],
    screeningCriteria: ["Do not publish until HR completes the role requirements."],
    roleCompetencies: [
      { name: "Communication", description: "Candidate communicates clearly and professionally." },
      { name: "Role relevance", description: "Candidate experience aligns with the role." },
      { name: "Problem solving", description: "Candidate explains practical problem solving." },
    ],
    interviewStructure: ["Opening", "Role-relevant discussion", "Closing"],
    scoringRubric: ["1 = insufficient evidence", "3 = meets expectations", "5 = strong evidence"],
    redFlags: ["Insufficient job description detail."],
    questions: [
      {
        competencyName: "Communication",
        competencyDescription: "Candidate communicates clearly and professionally.",
        questionText: "Please introduce yourself and briefly describe your relevant experience.",
        questionType: "introduction",
        difficulty: "introductory",
        expectedAnswerSignals: ["Clear overview of relevant background."],
        scoringRubric: ["Look for concise, relevant communication."],
        redFlags: ["Unable to summarize relevant experience."],
        followUps: ["What experience is most relevant to this role?"],
      },
      {
        competencyName: "Role relevance",
        competencyDescription: "Candidate experience aligns with the role.",
        questionText: "What part of your experience best prepares you for this role?",
        questionType: "behavioral",
        difficulty: "standard",
        expectedAnswerSignals: ["Specific, job-related example."],
        scoringRubric: ["Look for evidence tied to the role requirements."],
        redFlags: ["No job-related example."],
        followUps: ["What outcome did you produce?"],
      },
      {
        competencyName: "Problem solving",
        competencyDescription: "Candidate explains practical problem solving.",
        questionText:
          "Tell us about a difficult work problem you solved and how you approached it.",
        questionType: "situational",
        difficulty: "standard",
        expectedAnswerSignals: ["Structured problem, action, and outcome."],
        scoringRubric: ["Look for clear reasoning and ownership."],
        redFlags: ["No concrete action or outcome."],
        followUps: ["What would you do differently next time?"],
      },
    ],
  };
}

function buildJobDescriptionPrompt(text: string): string {
  return [
    "Analyze this job description and create a structured HR-reviewed draft.",
    "Generate 3 to 5 interview questions that are job-related, fair, and evidence-based.",
    "Avoid discriminatory, protected-characteristic, health, family-status, age, appearance, or identity-based criteria.",
    "The HR user will review and edit before publication.",
    "",
    "JOB DESCRIPTION:",
    text.slice(0, 50_000),
  ].join("\n");
}

function readOutputText(response: unknown): string {
  const direct = (response as { output_text?: unknown }).output_text;
  if (typeof direct === "string" && direct.trim().length > 0) {
    return direct;
  }
  const output = (response as { output?: unknown }).output;
  if (!Array.isArray(output)) {
    throw new JobDescriptionAnalysisError(
      "OpenAI response did not include output.",
      "EMPTY_AI_OUTPUT",
    );
  }
  const texts: string[] = [];
  for (const item of output) {
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      const text = (part as { text?: unknown }).text;
      if (typeof text === "string") texts.push(text);
    }
  }
  const joined = texts.join("\n").trim();
  if (joined.length === 0) {
    throw new JobDescriptionAnalysisError(
      "OpenAI response did not include JSON text.",
      "EMPTY_AI_OUTPUT",
    );
  }
  return joined;
}

function normalizeOpenAIJobError(error: unknown): JobDescriptionAnalysisError {
  if (error instanceof JobDescriptionAnalysisError) {
    return error;
  }
  const details = readOpenAIErrorDetails(error);
  const detailText = formatDetails(details);
  if (error instanceof OpenAI.APIError) {
    return new JobDescriptionAnalysisError(
      `OpenAI job analysis request failed.${detailText}`,
      error.status === 401 ? "OPENAI_AUTHENTICATION_FAILED" : "OPENAI_REQUEST_FAILED",
      details,
    );
  }
  if (error instanceof Error) {
    return new JobDescriptionAnalysisError(
      `OpenAI job analysis request failed: ${sanitizeProviderMessage(error.message)}${detailText}`,
      error.name === "TimeoutError" ? "OPENAI_TIMEOUT" : "OPENAI_REQUEST_FAILED",
      details,
    );
  }
  return new JobDescriptionAnalysisError(
    `OpenAI job analysis request failed.${detailText}`,
    "OPENAI_REQUEST_FAILED",
    details,
  );
}

function readOpenAIErrorDetails(error: unknown): Readonly<Record<string, unknown>> {
  const candidate = error as {
    status?: unknown;
    code?: unknown;
    type?: unknown;
    param?: unknown;
    request_id?: unknown;
    requestID?: unknown;
    message?: unknown;
    error?: unknown;
  };
  const details: Record<string, unknown> = {};
  for (const [key, value] of Object.entries({
    status: candidate.status,
    code: candidate.code,
    type: candidate.type,
    param: candidate.param,
    request_id: candidate.request_id ?? candidate.requestID,
    message: candidate.message,
  })) {
    if (typeof value === "string" || typeof value === "number") {
      details[key] = sanitizeProviderMessage(String(value));
    }
  }
  if (typeof candidate.error === "object" && candidate.error !== null) {
    for (const [key, value] of Object.entries(candidate.error as Record<string, unknown>)) {
      if (["code", "type", "param", "message"].includes(key) && typeof value === "string") {
        details[`error_${key}`] = sanitizeProviderMessage(value);
      }
    }
  }
  return details;
}

function formatDetails(details: Readonly<Record<string, unknown>>): string {
  const text = Object.entries(details)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(" ");
  return text.length === 0 ? "" : ` ${text}`;
}

function sanitizeProviderMessage(value: string): string {
  return value
    .replace(/sk-[a-zA-Z0-9_-]+/gu, "[redacted]")
    .replace(/\s+/gu, " ")
    .slice(0, 500);
}

function stringArraySchema(): Readonly<Record<string, unknown>> {
  return { type: "array", items: { type: "string" } };
}

function nullableStringSchema(): Readonly<Record<string, unknown>> {
  return { anyOf: [{ type: "string" }, { type: "null" }] };
}

function firstNonEmptyLine(text: string): string | null {
  return (
    text
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? null
  );
}
