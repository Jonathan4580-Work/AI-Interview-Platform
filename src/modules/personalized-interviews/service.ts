import { createHash } from "node:crypto";

import OpenAI from "openai";
import { z } from "zod";

import { env } from "@/config";
import { prisma } from "@/infra/database";
import { slugify } from "@/modules/organization";

import type { HrWorkspaceContext } from "@/server/hr-workspace/context";
import type { Prisma } from "@prisma/client";

const questionTypes = [
  "intro",
  "technical",
  "behavioral",
  "situational",
  "gap_validation",
  "project_deep_dive",
] as const;

const generatedQuestionSchema = z
  .object({
    questionText: z.string().min(10).max(1_200),
    questionType: z.enum(questionTypes),
    competency: z.string().min(2).max(160),
    reason: z.string().min(5).max(1_000),
    expectedSignals: z.array(z.string().min(2).max(500)).min(1).max(6),
    redFlags: z.array(z.string().min(2).max(500)).max(6),
    followUps: z.array(z.string().min(2).max(500)).max(4),
  })
  .strict();

const generatedPlanSchema = z
  .object({
    basisSummary: z.string().min(10).max(2_000),
    questions: z.array(generatedQuestionSchema).min(5).max(7),
  })
  .strict();

const OPENAI_SCHEMA_NAME = "aptly_personalized_interview_plan";
const OPENAI_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["basisSummary", "questions"],
  properties: {
    basisSummary: { type: "string" },
    questions: {
      type: "array",
      minItems: 5,
      maxItems: 7,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "questionText",
          "questionType",
          "competency",
          "reason",
          "expectedSignals",
          "redFlags",
          "followUps",
        ],
        properties: {
          questionText: { type: "string" },
          questionType: { type: "string", enum: [...questionTypes] },
          competency: { type: "string" },
          reason: { type: "string" },
          expectedSignals: { type: "array", items: { type: "string" } },
          redFlags: { type: "array", items: { type: "string" } },
          followUps: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

export class PersonalizedInterviewError extends Error {
  public constructor(
    message: string,
    public readonly code: string,
    public readonly retryable = false,
    public readonly details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = "PersonalizedInterviewError";
  }
}

export async function generatePersonalizedInterviewPlan(input: {
  readonly context: HrWorkspaceContext;
  readonly applicationId: string;
  readonly forceRegenerate?: boolean;
}) {
  const loaded = await loadGenerationInput(input.context, input.applicationId);
  const existing = firstOrNull(loaded.application.personalizedInterviewPlans);
  if (existing?.status === "READY" && input.forceRegenerate !== true) {
    return existing;
  }

  await prisma.applicationInterviewPlan.upsert({
    where: {
      companyId_applicationId: {
        companyId: input.context.tenant.companyId,
        applicationId: loaded.application.id,
      },
    },
    update: {
      status: "PENDING",
      failureCode: null,
      failureMessageSafe: null,
      safeDiagnosticsJson: buildSafeDiagnostics(loaded, null),
      createdByUserId: input.context.actor.id,
    },
    create: {
      companyId: input.context.tenant.companyId,
      applicationId: loaded.application.id,
      candidateId: loaded.application.candidateId,
      jobId: loaded.application.jobId,
      sourceInterviewPlanVersionId: loaded.sourceVersion.id,
      status: "PENDING",
      provider: selectedProviderKey(),
      model: selectedModel(),
      safeDiagnosticsJson: buildSafeDiagnostics(loaded, null),
      createdByUserId: input.context.actor.id,
    },
  });

  try {
    const generation = await generateQuestions(loaded);
    const now = new Date();
    const persisted = await prisma.$transaction(async (tx) => {
      const plan = await tx.interviewPlan.create({
        data: {
          companyId: input.context.tenant.companyId,
          jobId: loaded.application.jobId,
          name: `${loaded.application.candidate.fullName} personalized interview`,
          status: "ACTIVE",
        },
      });
      const version = await tx.interviewPlanVersion.create({
        data: {
          companyId: input.context.tenant.companyId,
          interviewPlanId: plan.id,
          versionNumber: 1,
          status: "PUBLISHED",
          competencyJson: buildCompetencyJson(generation.questions),
          questionBlueprintJson: buildQuestionBlueprint(generation.questions),
          durationMinutes: Math.max(25, generation.questions.length * 7),
          publishedAt: now,
        },
      });
      await tx.interviewPlan.update({
        where: { companyId_id: { companyId: input.context.tenant.companyId, id: plan.id } },
        data: { activeVersionId: version.id },
      });
      return tx.applicationInterviewPlan.update({
        where: {
          companyId_applicationId: {
            companyId: input.context.tenant.companyId,
            applicationId: loaded.application.id,
          },
        },
        data: {
          status: "READY",
          sourceInterviewPlanVersionId: loaded.sourceVersion.id,
          personalizedInterviewPlanId: plan.id,
          personalizedInterviewPlanVersionId: version.id,
          provider: selectedProviderKey(),
          model: selectedModel(),
          basisSummary: generation.basisSummary,
          questionCount: generation.questions.length,
          inputLength: loaded.providerInput.length,
          failureCode: null,
          failureMessageSafe: null,
          safeDiagnosticsJson: buildSafeDiagnostics(loaded, null),
          generatedAt: now,
        },
      });
    });
    return persisted;
  } catch (error) {
    const normalized = normalizeGenerationError(error);
    return prisma.applicationInterviewPlan.update({
      where: {
        companyId_applicationId: {
          companyId: input.context.tenant.companyId,
          applicationId: loaded.application.id,
        },
      },
      data: {
        status: "FAILED",
        provider: selectedProviderKey(),
        model: selectedModel(),
        inputLength: loaded.providerInput.length,
        failureCode: normalized.code,
        failureMessageSafe: sanitizeMessage(normalized.message),
        safeDiagnosticsJson: buildSafeDiagnostics(loaded, normalized),
      },
    });
  }
}

export async function getPersonalizedInterviewDiagnostic(applicationId: string) {
  const application = await prisma.candidateApplication.findFirst({
    where: { id: applicationId },
    include: {
      candidate: true,
      job: {
        include: {
          intelligenceProfile: true,
          interviewQuestions: { orderBy: { sequence: "asc" } },
          plans: { include: { versions: true } },
        },
      },
      cvScreenings: { orderBy: { updatedAt: "desc" }, take: 1 },
      decisionHistory: { orderBy: { createdAt: "desc" }, take: 1 },
      availabilityRequests: { orderBy: { updatedAt: "desc" }, take: 1 },
      personalizedInterviewPlans: { orderBy: { updatedAt: "desc" }, take: 1 },
    },
  });
  if (application === null) {
    throw new PersonalizedInterviewError("Application was not found.", "not_found", false);
  }
  const sourceVersion = readSourceVersion(application.job.plans);
  const screening = firstOrNull(application.cvScreenings);
  const plan = firstOrNull(application.personalizedInterviewPlans);
  const providerInput = buildProviderInput({
    application,
    sourceVersion,
    screening,
  });
  return {
    applicationId: application.id,
    jobId: application.jobId,
    candidate: application.candidate.fullName,
    jdIntelligenceExists: application.job.intelligenceProfile !== null,
    cvScreeningExists: screening !== null,
    availabilityStatus: firstOrNull(application.availabilityRequests)?.status ?? "NONE",
    personalizedInterviewPlanStatus: plan === null ? "NOT_GENERATED" : plan.status,
    questionCount: plan === null ? 0 : plan.questionCount,
    model: selectedModel(),
    inputLength: providerInput.length,
    safeOpenAIError: plan === null ? null : plan.failureMessageSafe,
  };
}

async function loadGenerationInput(context: HrWorkspaceContext, applicationId: string) {
  const application = await prisma.candidateApplication.findUnique({
    where: { companyId_id: { companyId: context.tenant.companyId, id: applicationId } },
    include: {
      candidate: true,
      job: {
        include: {
          intelligenceProfile: true,
          interviewQuestions: { orderBy: { sequence: "asc" } },
          plans: { where: { status: "ACTIVE", deletedAt: null }, include: { versions: true } },
        },
      },
      cvScreenings: { orderBy: { updatedAt: "desc" }, take: 1 },
      decisionHistory: { orderBy: { createdAt: "desc" }, take: 1 },
      availabilityRequests: { orderBy: { createdAt: "desc" }, take: 1 },
      personalizedInterviewPlans: { orderBy: { updatedAt: "desc" }, take: 1 },
    },
  });
  if (application === null) {
    throw new PersonalizedInterviewError("Application was not found.", "not_found", false);
  }
  if (application.status !== "AVAILABILITY_CONFIRMED" && application.status !== "SHORTLISTED") {
    throw new PersonalizedInterviewError(
      "Confirm availability or shortlist before generating a personalized interview.",
      "invalid_application_state",
      false,
    );
  }
  const sourceVersion = readSourceVersion(application.job.plans);
  const screening = firstOrNull(application.cvScreenings);
  const providerInput = buildProviderInput({ application, sourceVersion, screening });
  return { application, sourceVersion, screening, providerInput };
}

function readSourceVersion(
  plans: readonly {
    readonly activeVersionId: string | null;
    readonly versions: readonly {
      readonly id: string;
      readonly status: string;
      readonly publishedAt: Date | null;
    }[];
  }[],
) {
  for (const plan of plans) {
    const version = plan.versions.find(
      (candidate) => candidate.id === plan.activeVersionId && candidate.status === "PUBLISHED",
    );
    if (version !== undefined && version.publishedAt !== null) return version;
  }
  throw new PersonalizedInterviewError(
    "A published job interview plan is required first.",
    "missing_published_plan",
    false,
  );
}

async function generateQuestions(
  loaded: Awaited<ReturnType<typeof loadGenerationInput>>,
): Promise<GeneratedPlan> {
  if (selectedProviderKey() !== "openai") {
    return deterministicPlan(loaded);
  }
  if (!env.OPENAI_API_KEY) {
    throw new PersonalizedInterviewError(
      "OpenAI API key is not configured.",
      "provider_unavailable",
    );
  }
  try {
    const response = await new OpenAI({
      apiKey: env.OPENAI_API_KEY,
      baseURL: env.OPENAI_API_URL,
      timeout: env.EVALUATION_PROVIDER_TIMEOUT_MS,
    }).responses.create(
      {
        model: env.OPENAI_MODEL,
        instructions: [
          "You generate job-related structured interview questions for HR review.",
          "Use only role-relevant evidence from the JD, HR-approved plan, CV text, and screening summary.",
          "Do not ask about protected characteristics, health, family status, age, nationality, religion, disability, appearance, or any sensitive trait.",
          "Do not expose AI screening scores, HR concerns labels, missing-skills labels, or internal reasoning to the candidate.",
          "Questions must feel fair, professional, and specific to the role.",
        ].join("\n"),
        input: loaded.providerInput,
        text: {
          format: {
            type: "json_schema",
            name: OPENAI_SCHEMA_NAME,
            strict: true,
            schema: OPENAI_SCHEMA,
          },
        },
        store: false,
      },
      { timeout: env.EVALUATION_PROVIDER_TIMEOUT_MS },
    );
    if (response.error !== null || response.output_text.trim().length === 0) {
      throw new PersonalizedInterviewError(
        "OpenAI personalized interview generation returned no usable output.",
        "provider_retryable",
        true,
        { responseId: response.id },
      );
    }
    return normalizeGeneratedPlan(generatedPlanSchema.parse(JSON.parse(response.output_text)));
  } catch (error) {
    if (error instanceof PersonalizedInterviewError) throw error;
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      throw new PersonalizedInterviewError(
        "OpenAI personalized interview output failed schema validation.",
        "malformed_output",
        false,
      );
    }
    throw normalizeOpenAIError(error);
  }
}

function deterministicPlan(loaded: Awaited<ReturnType<typeof loadGenerationInput>>): GeneratedPlan {
  const screening = loaded.screening;
  const matched = screening === null ? [] : readStringList(screening.matchedSkillsJson);
  const missing = screening === null ? [] : readStringList(screening.missingSkillsJson);
  const focus = screening === null ? [] : readStringList(screening.focusAreasJson);
  const cvExcerpt = (screening?.extractedText ?? "").slice(0, 240);
  const skills =
    matched.length > 0 ? matched.slice(0, 2).join(" and ") : loaded.application.job.title;
  const gap = missing.at(0) ?? focus.at(0) ?? "an unclear role requirement";
  return normalizeGeneratedPlan({
    basisSummary:
      "Generated from the published interview plan, JD intelligence, CV screening summary, matched skills, missing skills, and HR shortlist context.",
    questions: [
      {
        questionText: `To start, please summarize the role-relevant experience that best prepares you for the ${loaded.application.job.title} position.`,
        questionType: "intro",
        competency: "Communication",
        reason: "Warm-up question based on the target role.",
        expectedSignals: ["Clear summary", "Role relevance", "Specific examples"],
        redFlags: ["Vague answer", "No role connection"],
        followUps: ["Which part of that experience is most relevant to this role?"],
      },
      {
        questionText: `Tell us about a specific project where you used ${skills}. What did you build, what tradeoffs did you make, and how did you validate the result?`,
        questionType: "technical",
        competency: "Role-specific knowledge",
        reason: "Validates matched CV skills against JD requirements.",
        expectedSignals: ["Concrete implementation detail", "Testing or validation", "Ownership"],
        redFlags: ["Only high-level claims", "No measurable outcome"],
        followUps: ["What would you improve if you rebuilt it today?"],
      },
      {
        questionText: `Describe a time you had to solve a difficult technical or product problem under constraints. How did you decide what to do first?`,
        questionType: "situational",
        competency: "Problem solving",
        reason: "Assesses structured thinking and prioritization.",
        expectedSignals: ["Problem framing", "Prioritization", "Measured outcome"],
        redFlags: ["No clear decision process"],
        followUps: ["What information changed your plan?"],
      },
      {
        questionText: `The CV or screening summary left ${gap} unclear. Please walk through your experience with this area and where you would need support.`,
        questionType: "gap_validation",
        competency: "Evidence quality",
        reason:
          "Validates a missing or unclear job-related skill without implying a negative decision.",
        expectedSignals: ["Honest scope", "Learning plan", "Relevant adjacent experience"],
        redFlags: ["Overclaiming", "No examples"],
        followUps: ["How would you ramp up on this in the first month?"],
      },
      {
        questionText: `Choose one project from your CV and walk through the goal, your contribution, key decisions, and the outcome.${cvExcerpt.length > 0 ? " You may use your submitted CV as context." : ""}`,
        questionType: "project_deep_dive",
        competency: "Professionalism",
        reason: "Deepens evidence from the candidate CV.",
        expectedSignals: ["Personal contribution", "Outcome", "Reflection"],
        redFlags: ["Cannot explain own work"],
        followUps: ["What was the hardest decision in that project?"],
      },
      {
        questionText:
          "Tell us about a time you received feedback on your work. What changed afterwards?",
        questionType: "behavioral",
        competency: "Collaboration",
        reason: "Assesses learning orientation and teamwork.",
        expectedSignals: ["Openness", "Specific change", "Professional response"],
        redFlags: ["Blames others", "No behavior change"],
        followUps: ["How do you ask for feedback now?"],
      },
    ],
  });
}

function buildProviderInput(input: {
  readonly application: LoadedApplication;
  readonly sourceVersion: { readonly id: string };
  readonly screening: LoadedScreening | null;
}): string {
  const job = input.application.job;
  const screening = input.screening;
  const payload = {
    job: {
      title: job.title,
      summary: readSummary(job.descriptionJson),
      responsibilities: readStringList(job.intelligenceProfile?.responsibilitiesJson),
      requiredSkills: readStringList(job.intelligenceProfile?.requiredSkillsJson),
      niceToHaveSkills: readStringList(job.intelligenceProfile?.niceToHaveSkillsJson),
      competencies: job.intelligenceProfile?.competenciesJson ?? [],
      approvedQuestionBlueprint: input.sourceVersion.id,
    },
    candidate: {
      name: input.application.candidate.fullName,
      cvText: screening?.extractedText?.slice(0, 12_000) ?? "",
    },
    screening: {
      recommendation: screening?.recommendation ?? null,
      confidence: screening?.confidence ?? null,
      matchedSkills: readStringList(screening?.matchedSkillsJson),
      missingSkills: readStringList(screening?.missingSkillsJson),
      concerns: readStringList(screening?.concernsJson),
      suggestedInterviewFocusAreas: readStringList(screening?.focusAreasJson),
      evidenceExcerpts: readStringList(screening?.evidenceJson).slice(0, 5),
      limitations: readStringList(screening?.limitationsJson),
    },
    hr: {
      applicationStatus: input.application.status,
      latestDecision: input.application.decisionHistory[0]?.decision ?? null,
    },
    requirements: {
      questionCount: "5 to 7",
      requiredTypes: [...questionTypes],
      candidateFacingSafety:
        "Do not reveal AI screening score, concerns labels, missing-skills labels, or internal HR rationale.",
    },
  };
  return JSON.stringify(payload);
}

function buildQuestionBlueprint(questions: readonly GeneratedQuestion[]): Prisma.InputJsonArray {
  return questions.map((question, index) => ({
    key: `${question.questionType}_${String(index + 1)}`,
    kind: index === 0 ? "opening" : index === questions.length - 1 ? "closing" : "main",
    sequence: index + 1,
    prompt: question.questionText,
    required: true,
    competency: question.competency,
    questionType: question.questionType,
    reason: question.reason,
    expectedSignals: question.expectedSignals,
    redFlags: question.redFlags,
    followUps: question.followUps,
  }));
}

function buildCompetencyJson(questions: readonly GeneratedQuestion[]): Prisma.InputJsonObject {
  const seen = new Set<string>();
  const competencies = questions
    .map((question) => question.competency.trim())
    .filter((competency) => {
      const key = slugify(competency).replace(/-/gu, "_");
      if (key.length === 0 || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((competency) => ({
      key: slugify(competency).replace(/-/gu, "_").slice(0, 80),
      label: competency.slice(0, 160),
      maxScore: 5,
    }));
  return {
    schemaVersion: 1,
    competencies:
      competencies.length > 0
        ? competencies
        : [{ key: "role_relevance", label: "Role relevance", maxScore: 5 }],
  };
}

function buildSafeDiagnostics(
  loaded: Awaited<ReturnType<typeof loadGenerationInput>>,
  error: PersonalizedInterviewError | null,
) {
  return {
    applicationId: loaded.application.id,
    jobId: loaded.application.jobId,
    candidateId: loaded.application.candidateId,
    jdIntelligenceExists: loaded.application.job.intelligenceProfile !== null,
    cvScreeningExists: loaded.screening !== null,
    availabilityStatus: firstOrNull(loaded.application.availabilityRequests)?.status ?? "NONE",
    provider: selectedProviderKey(),
    model: selectedModel(),
    inputLength: loaded.providerInput.length,
    inputHash: createHash("sha256").update(loaded.providerInput).digest("hex"),
    schemaName: OPENAI_SCHEMA_NAME,
    error:
      error === null
        ? null
        : { code: error.code, message: sanitizeMessage(error.message), ...error.details },
  };
}

function selectedProviderKey(): "openai" | "deterministic" {
  return env.EVALUATION_PROVIDER === "openai" && env.OPENAI_API_KEY ? "openai" : "deterministic";
}

function selectedModel(): string {
  return selectedProviderKey() === "openai" ? env.OPENAI_MODEL : "deterministic-personalized-v1";
}

function normalizeGeneratedPlan(value: z.infer<typeof generatedPlanSchema>): GeneratedPlan {
  return {
    basisSummary: sanitizeText(value.basisSummary, 2_000),
    questions: value.questions.map((question) => ({
      questionText: sanitizeText(question.questionText, 1_200),
      questionType: question.questionType,
      competency: sanitizeText(question.competency, 160),
      reason: sanitizeText(question.reason, 1_000),
      expectedSignals: question.expectedSignals.map((item) => sanitizeText(item, 500)).slice(0, 6),
      redFlags: question.redFlags.map((item) => sanitizeText(item, 500)).slice(0, 6),
      followUps: question.followUps.map((item) => sanitizeText(item, 500)).slice(0, 4),
    })),
  };
}

function normalizeOpenAIError(error: unknown): PersonalizedInterviewError {
  if (error instanceof OpenAI.APIError) {
    const rawStatus: unknown = error.status;
    const status = typeof rawStatus === "number" ? rawStatus : "unknown";
    const rawCode: unknown = error.code;
    const rawType: unknown = error.type;
    const rawRequestId: unknown = error.requestID;
    const details = {
      status,
      code: typeof rawCode === "string" ? rawCode : null,
      type: typeof rawType === "string" ? rawType : null,
      requestId: typeof rawRequestId === "string" ? rawRequestId : null,
    };
    return new PersonalizedInterviewError(
      `OpenAI personalized interview request failed. status=${String(status)} message=${sanitizeMessage(error.message)}`,
      status === 401 || status === 403 ? "provider_unavailable" : "provider_retryable",
      status === 429 || (typeof status === "number" && status >= 500),
      details,
    );
  }
  if (error instanceof Error && (error.name === "AbortError" || /timeout/iu.test(error.message))) {
    return new PersonalizedInterviewError(
      "OpenAI personalized interview request timed out.",
      "provider_timeout",
      true,
    );
  }
  return new PersonalizedInterviewError(
    error instanceof Error
      ? sanitizeMessage(error.message)
      : "Personalized interview generation failed.",
    "provider_retryable",
    true,
  );
}

function normalizeGenerationError(error: unknown): PersonalizedInterviewError {
  return error instanceof PersonalizedInterviewError
    ? error
    : new PersonalizedInterviewError(
        error instanceof Error
          ? sanitizeMessage(error.message)
          : "Personalized interview generation failed.",
        "generation_failed",
      );
}

function readSummary(value: unknown): string {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return "";
  const summary = (value as { readonly summary?: unknown }).summary;
  return typeof summary === "string" ? summary : "";
}

function readStringList(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function firstOrNull<T>(items: readonly T[]): T | null {
  return items.at(0) ?? null;
}

function sanitizeMessage(value: string): string {
  return value.replace(/sk-[A-Za-z0-9_-]+/gu, "[redacted]").slice(0, 800);
}

function sanitizeText(value: string, max: number): string {
  return value.replace(/\s+/gu, " ").trim().slice(0, max);
}

type LoadedApplication = Awaited<ReturnType<typeof loadGenerationInput>>["application"];
type LoadedScreening = Awaited<ReturnType<typeof loadGenerationInput>>["screening"];
type GeneratedPlan = z.infer<typeof generatedPlanSchema>;
type GeneratedQuestion = GeneratedPlan["questions"][number];
