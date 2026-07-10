import { Prisma } from "@prisma/client";

import { prisma } from "@/infra/database";

import { analyzeJobDescription, type JobDescriptionAnalysis } from "./jd-analysis";

export async function processJobDescriptionAnalysis(input: {
  readonly companyId: string;
  readonly jobId: string;
}): Promise<{ readonly questionCount: number; readonly title: string }> {
  const job = await prisma.job.findUnique({
    where: { companyId_id: { companyId: input.companyId, id: input.jobId } },
    include: {
      descriptionAssets: { orderBy: { createdAt: "desc" }, take: 1 },
      intelligenceProfile: true,
    },
  });
  if (job === null) {
    throw new Error("Job was not found for JD analysis.");
  }
  const asset = job.descriptionAssets.length > 0 ? job.descriptionAssets[0] : null;
  if (asset === null) {
    throw new Error("Job description source text was not found.");
  }

  try {
    const analysis = await analyzeJobDescription({
      companyId: input.companyId,
      jobId: input.jobId,
      text: asset.extractedText,
    });
    await applyJobDescriptionAnalysis({
      companyId: input.companyId,
      jobId: input.jobId,
      sourceAssetId: asset.id,
      analysis,
      rawAiJson: analysis,
    });
    return { questionCount: analysis.questions.length, title: analysis.title };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1_000) : "JD analysis failed.";
    await prisma.jobIntelligenceProfile.updateMany({
      where: { companyId: input.companyId, jobId: input.jobId },
      data: { status: "HR_REVIEW_NEEDED", failureMessage: message },
    });
    throw error;
  }
}

export async function applyJobDescriptionAnalysis(input: {
  readonly companyId: string;
  readonly jobId: string;
  readonly sourceAssetId: string | null;
  readonly analysis: JobDescriptionAnalysis;
  readonly rawAiJson?: Prisma.InputJsonValue;
}): Promise<void> {
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.job.update({
      where: { companyId_id: { companyId: input.companyId, id: input.jobId } },
      data: {
        title: input.analysis.title,
        descriptionJson: {
          summary: input.analysis.responsibilities.slice(0, 3).join(" "),
          details: input.analysis.responsibilities.join("\n"),
          jdGenerated: true,
        } satisfies Prisma.InputJsonObject,
        requirementsJson: {
          items: input.analysis.requiredSkills,
        } satisfies Prisma.InputJsonObject,
        employmentType: mapEmploymentType(input.analysis.employmentType),
        workplaceType: mapWorkplaceType(input.analysis.workplaceType),
        seniorityLevel: mapSeniority(input.analysis.experience),
      },
    });
    await tx.jobIntelligenceProfile.upsert({
      where: { companyId_jobId: { companyId: input.companyId, jobId: input.jobId } },
      create: profileData(input, now),
      update: {
        ...profileData(input, now),
        status: "AI_ANALYSIS_READY",
        analyzedAt: now,
        failureMessage: null,
      },
    });
    await tx.jobInterviewQuestion.deleteMany({
      where: { companyId: input.companyId, jobId: input.jobId },
    });
    await tx.jobInterviewQuestion.createMany({
      data: input.analysis.questions.map((question, index) => ({
        companyId: input.companyId,
        jobId: input.jobId,
        sequence: index + 1,
        competencyName: question.competencyName,
        competencyDescription: question.competencyDescription,
        questionText: question.questionText,
        questionType: question.questionType,
        difficulty: question.difficulty,
        expectedSignalsJson: question.expectedAnswerSignals,
        scoringRubricJson: question.scoringRubric,
        redFlagsJson: question.redFlags,
        followUpsJson: question.followUps,
      })),
    });
  });
}

function profileData(
  input: {
    readonly companyId: string;
    readonly jobId: string;
    readonly sourceAssetId: string | null;
    readonly analysis: JobDescriptionAnalysis;
    readonly rawAiJson?: Prisma.InputJsonValue;
  },
  now: Date,
): Prisma.JobIntelligenceProfileUncheckedCreateInput {
  return {
    companyId: input.companyId,
    jobId: input.jobId,
    sourceAssetId: input.sourceAssetId,
    status: "AI_ANALYSIS_READY",
    title: input.analysis.title,
    departmentText: input.analysis.department,
    employmentTypeText: input.analysis.employmentType,
    workplaceText: input.analysis.workplaceType,
    locationText: input.analysis.location,
    experienceText: input.analysis.experience,
    responsibilitiesJson: input.analysis.responsibilities,
    requiredSkillsJson: input.analysis.requiredSkills,
    niceToHaveSkillsJson: input.analysis.niceToHaveSkills,
    educationJson: input.analysis.educationAndCertifications,
    toolsJson: input.analysis.toolsAndTechnologies,
    seniorityJson: input.analysis.seniorityExpectations,
    screeningCriteriaJson: input.analysis.screeningCriteria,
    competenciesJson: input.analysis.roleCompetencies,
    interviewStructureJson: input.analysis.interviewStructure,
    rubricJson: input.analysis.scoringRubric,
    redFlagsJson: input.analysis.redFlags,
    rawAiJson: input.rawAiJson ?? Prisma.JsonNull,
    failureMessage: null,
    analyzedAt: now,
  };
}

function mapEmploymentType(value: string | null): Prisma.JobCreateInput["employmentType"] {
  const normalized = (value ?? "").toLowerCase();
  if (normalized.includes("part")) return "PART_TIME";
  if (normalized.includes("contract")) return "CONTRACT";
  if (normalized.includes("temp")) return "TEMPORARY";
  if (normalized.includes("intern")) return "INTERNSHIP";
  return "FULL_TIME";
}

function mapWorkplaceType(value: string | null): Prisma.JobCreateInput["workplaceType"] {
  const normalized = (value ?? "").toLowerCase();
  if (normalized.includes("hybrid")) return "HYBRID";
  if (
    normalized.includes("office") ||
    normalized.includes("onsite") ||
    normalized.includes("on-site")
  ) {
    return "ONSITE";
  }
  return "REMOTE";
}

function mapSeniority(value: string | null): Prisma.JobCreateInput["seniorityLevel"] {
  const normalized = (value ?? "").toLowerCase();
  if (normalized.includes("entry") || normalized.includes("junior")) return "ENTRY";
  if (normalized.includes("senior")) return "SENIOR";
  if (normalized.includes("staff") || normalized.includes("principal")) return "STAFF";
  if (normalized.includes("executive") || normalized.includes("director")) return "EXECUTIVE";
  return "MID";
}
