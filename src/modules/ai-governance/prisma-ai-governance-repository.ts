import { createHash } from "node:crypto";

import { prisma } from "@/infra/database";

import {
  AI_EVALUATION_SCHEMA_VERSION,
  AI_REDACTION_POLICY_VERSION,
  type AiGovernanceArtifacts,
  type AiGovernanceContext,
  type AiGovernanceRepository,
  type CompetencyDefinition,
} from "./types";
import type { Prisma } from "@prisma/client";

const PROMPT_KEY = "aptly_interview_evaluation";
const RUBRIC_KEY = "aptly_standard_interview_rubric";

const DEFAULT_SYSTEM_PROMPT =
  "Evaluate interview transcripts as decision-support only. Use the published rubric, cite transcript evidence, separate confidence from scores, and avoid protected-characteristic, appearance, emotion, or misconduct inferences.";

const DEFAULT_USER_PROMPT =
  "Return JSON matching the evaluation schema. Assess only the supplied redacted transcript segments and rubric. Do not infer hidden context.";

const DEFAULT_COMPETENCIES: readonly CompetencyDefinition[] = [
  {
    key: "communication",
    label: "Communication",
    description: "Clarity, structure, and ability to explain work-relevant ideas.",
  },
  {
    key: "role_knowledge",
    label: "Role-specific knowledge",
    description: "Demonstrated job-relevant technical or functional knowledge.",
  },
  {
    key: "problem_solving",
    label: "Problem solving",
    description: "Reasoning quality, tradeoff awareness, and approach to ambiguity.",
  },
  {
    key: "relevance",
    label: "Relevance",
    description: "How directly answers address the interview questions.",
  },
  {
    key: "clarity",
    label: "Clarity",
    description: "Conciseness and understandability of responses.",
  },
  {
    key: "professionalism",
    label: "Professionalism",
    description: "Professional tone and preparedness evidenced by responses.",
  },
  {
    key: "evidence_quality",
    label: "Evidence quality",
    description: "Specificity and usefulness of examples or supporting details.",
  },
  {
    key: "overall_performance",
    label: "Overall interview performance",
    description: "Holistic interview performance based on the rubric evidence.",
  },
];

export class PrismaAiGovernanceRepository implements AiGovernanceRepository {
  public async ensurePublishedEvaluationArtifacts(
    context: AiGovernanceContext,
  ): Promise<AiGovernanceArtifacts> {
    const companyId = context.tenant.companyId;
    const prompt = await prisma.$transaction(async (tx) => {
      const promptTemplate = await tx.aiPromptTemplate.upsert({
        where: { companyId_key: { companyId, key: PROMPT_KEY } },
        create: {
          companyId,
          key: PROMPT_KEY,
          name: "Aptly Interview Evaluation",
          status: "PUBLISHED",
          description: "Default governed interview evaluation prompt.",
        },
        update: { status: "PUBLISHED" },
      });
      const promptVersion =
        (await tx.aiPromptVersion.findUnique({
          where: {
            promptTemplateId_versionNumber: {
              promptTemplateId: promptTemplate.id,
              versionNumber: 1,
            },
          },
        })) ??
        (await tx.aiPromptVersion.create({
          data: {
            companyId,
            promptTemplateId: promptTemplate.id,
            versionNumber: 1,
            status: "PUBLISHED",
            promptHash: hashStable({
              systemPrompt: DEFAULT_SYSTEM_PROMPT,
              userPromptTemplate: DEFAULT_USER_PROMPT,
            }),
            systemPrompt: DEFAULT_SYSTEM_PROMPT,
            userPromptTemplate: DEFAULT_USER_PROMPT,
            evaluationSchemaJson: {
              schemaVersion: AI_EVALUATION_SCHEMA_VERSION,
            } satisfies Prisma.InputJsonObject,
            redactionPolicyVersion: AI_REDACTION_POLICY_VERSION,
            publishedAt: new Date(),
          },
        }));
      return promptVersion;
    });

    const rubric = await prisma.$transaction(async (tx) => {
      const rubricTemplate = await tx.aiRubricTemplate.upsert({
        where: { companyId_key: { companyId, key: RUBRIC_KEY } },
        create: {
          companyId,
          key: RUBRIC_KEY,
          name: "Aptly Standard Interview Rubric",
          status: "PUBLISHED",
          description: "Default competency rubric for structured interview evaluation.",
        },
        update: { status: "PUBLISHED" },
      });
      const rubricVersion =
        (await tx.aiRubricVersion.findUnique({
          where: {
            rubricTemplateId_versionNumber: {
              rubricTemplateId: rubricTemplate.id,
              versionNumber: 1,
            },
          },
        })) ??
        (await tx.aiRubricVersion.create({
          data: {
            companyId,
            rubricTemplateId: rubricTemplate.id,
            versionNumber: 1,
            status: "PUBLISHED",
            rubricHash: hashStable(DEFAULT_COMPETENCIES),
            scoreMin: 1,
            scoreMax: 5,
            competencySchemaJson: {
              competencies: DEFAULT_COMPETENCIES.map((competency) => ({ ...competency })),
              schemaVersion: "rubric-v1",
            } satisfies Prisma.InputJsonObject,
            publishedAt: new Date(),
          },
        }));
      return rubricVersion;
    });

    return {
      prompt: {
        id: prompt.id as never,
        companyId,
        versionNumber: prompt.versionNumber,
        promptHash: prompt.promptHash,
        systemPrompt: prompt.systemPrompt,
        userPromptTemplate: prompt.userPromptTemplate,
        evaluationSchemaVersion: AI_EVALUATION_SCHEMA_VERSION,
        redactionPolicyVersion: prompt.redactionPolicyVersion,
      },
      rubric: {
        id: rubric.id as never,
        companyId,
        versionNumber: rubric.versionNumber,
        rubricHash: rubric.rubricHash,
        scoreMin: rubric.scoreMin,
        scoreMax: rubric.scoreMax,
        competencies: DEFAULT_COMPETENCIES,
      },
    };
  }
}

function hashStable(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
