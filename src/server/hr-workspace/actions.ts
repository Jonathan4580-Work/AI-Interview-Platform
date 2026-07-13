"use server";

import { createHash, randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/infra/database";
import { AuditWriter, PrismaAuditEventStore } from "@/modules/audit";
import {
  createAvailabilityRequestToken,
  hashAvailabilityRequestToken,
} from "@/modules/availability/tokens";
import { CandidatePortalService } from "@/modules/candidate-portal";
import { hashJobDescriptionText } from "@/modules/jobs/jd-analysis";
import { parseJobDescriptionAutofill } from "@/modules/jobs/jd-local-autofill";
import { slugify } from "@/modules/organization";
import { generatePersonalizedInterviewPlan } from "@/modules/personalized-interviews/service";
import { CompanySettingsService, PrismaCompanySettingsRepository } from "@/modules/tenant";
import { WorkflowService } from "@/modules/workflows";
import { PrismaWorkflowRepository } from "@/modules/workflows/prisma-workflow-repository";

import { requireHrWorkspaceContext } from "./context";
import { extractJobDescriptionText } from "./jd-text-extraction";

import type { Prisma } from "@prisma/client";

const DEFAULT_REQUIREMENTS = ["Review the role description before the interview."];
const DEFAULT_EXPIRY_HOURS = 72;
const DEFAULT_AVAILABILITY_EXPIRY_DAYS = 7;

export async function createJobAction(formData: FormData): Promise<void> {
  const context = await requireHrWorkspaceContext("jobs:manage");
  const title = requiredText(formData, "title", 2, 120);
  const summary = requiredText(formData, "summary", 1, 2_000);
  const details = optionalText(formData, "details", 10_000);
  const questions = parseQuestions(formData);
  const pipeline = await ensureDefaultPipeline(context.tenant.companyId);

  const job = await prisma.$transaction(async (tx) => {
    const created = await tx.job.create({
      data: {
        companyId: context.tenant.companyId,
        pipelineId: pipeline.id,
        title,
        slug: uniqueJobSlug(context.tenant.companyId, title),
        descriptionJson: { summary, details } satisfies Prisma.InputJsonObject,
        requirementsJson: { items: DEFAULT_REQUIREMENTS } satisfies Prisma.InputJsonObject,
        employmentType: enumValue(formData, "employmentType", [
          "FULL_TIME",
          "PART_TIME",
          "CONTRACT",
          "TEMPORARY",
          "INTERNSHIP",
        ]),
        workplaceType: enumValue(formData, "workplaceType", ["ONSITE", "HYBRID", "REMOTE"]),
        seniorityLevel: enumValue(formData, "seniorityLevel", [
          "ENTRY",
          "MID",
          "SENIOR",
          "STAFF",
          "EXECUTIVE",
        ]),
        status: "OPEN",
        openedAt: new Date(),
      },
    });

    const plan = await tx.interviewPlan.create({
      data: {
        companyId: context.tenant.companyId,
        jobId: created.id,
        name: `${title} interview`,
        status: "ACTIVE",
      },
    });
    const version = await tx.interviewPlanVersion.create({
      data: {
        companyId: context.tenant.companyId,
        interviewPlanId: plan.id,
        versionNumber: 1,
        status: "PUBLISHED",
        competencyJson: defaultCompetencies(),
        questionBlueprintJson: buildQuestionBlueprint(questions),
        durationMinutes: 30,
        publishedAt: new Date(),
      },
    });
    await tx.interviewPlan.update({
      where: { companyId_id: { companyId: context.tenant.companyId, id: plan.id } },
      data: { activeVersionId: version.id },
    });
    return created;
  });

  await audit(context, "hr_mvp.job_created", "job", job.id, { after: { id: job.id, title } });
  revalidatePath("/");
  revalidatePath("/jobs");
  redirect(`/jobs/${job.id}`);
}

export async function createJobFromJdAction(formData: FormData): Promise<void> {
  const context = await requireHrWorkspaceContext("jobs:manage");
  const fileValue = formData.get("jobDescriptionFile");
  const file = fileValue instanceof File && fileValue.size > 0 ? fileValue : null;
  const pastedText = readFormText(formData, "jobDescriptionText");
  const extracted = await extractJobDescriptionText({
    pastedText,
    file,
  });
  const pipeline = await ensureDefaultPipeline(context.tenant.companyId);
  const initialTitle = deriveSafeJdTitle({
    submittedTitle: readFormText(formData, "detectedTitle"),
    pastedText,
    extractedText: extracted.text,
  });
  const textHash = hashJobDescriptionText(extracted.text);

  const created = await prisma.$transaction(async (tx) => {
    const job = await tx.job.create({
      data: {
        companyId: context.tenant.companyId,
        pipelineId: pipeline.id,
        title: initialTitle,
        slug: uniqueJobSlug(context.tenant.companyId, initialTitle),
        descriptionJson: {
          summary: extracted.text.slice(0, 600),
          details: extracted.text.slice(0, 5_000),
          source: "job_description_upload",
        } satisfies Prisma.InputJsonObject,
        requirementsJson: { items: DEFAULT_REQUIREMENTS } satisfies Prisma.InputJsonObject,
        employmentType: "FULL_TIME",
        workplaceType: "REMOTE",
        seniorityLevel: "MID",
        status: "DRAFT",
      },
    });
    const asset = await tx.jobDescriptionAsset.create({
      data: {
        companyId: context.tenant.companyId,
        jobId: job.id,
        sourceType: extracted.sourceType,
        status: "TEXT_EXTRACTED",
        fileName: extracted.fileName,
        mimeType: extracted.mimeType,
        storageKey: null,
        extractedText: extracted.text,
        textHash,
        metadataJson: extracted.metadata as Prisma.InputJsonObject,
      },
    });
    await tx.jobIntelligenceProfile.create({
      data: {
        companyId: context.tenant.companyId,
        jobId: job.id,
        sourceAssetId: asset.id,
        status: "AI_ANALYSIS_PENDING",
        title: job.title,
        responsibilitiesJson: [],
        requiredSkillsJson: [],
        niceToHaveSkillsJson: [],
        educationJson: [],
        toolsJson: [],
        seniorityJson: [],
        screeningCriteriaJson: [],
        competenciesJson: [],
        interviewStructureJson: [],
        rubricJson: [],
        redFlagsJson: [],
      },
    });
    return { job, asset };
  });

  const workflowService = new WorkflowService(
    new PrismaWorkflowRepository(),
    new AuditWriter(new PrismaAuditEventStore()),
  );
  const workflow = await workflowService.createWorkflow({
    context,
    workflowType: "job_description_analysis",
    subjectType: "job",
    subjectId: created.job.id,
    idempotencyKey: `jd-analysis:${context.tenant.companyId}:${created.job.id}:${textHash}`,
    metadata: {
      jobId: created.job.id,
      sourceAssetId: created.asset.id,
      textHash,
    },
    steps: [
      {
        stepKey: "jd_ai_analysis",
        queueName: "orchestration",
        sequence: 1,
        maxAttempts: 2,
        metadata: { workflowSubjectId: created.job.id, sourceAssetId: created.asset.id },
      },
    ],
  });
  await workflowService.queueReadySteps({ context, workflowId: workflow.id });

  await audit(context, "jd.job_description_uploaded", "job", created.job.id, {
    after: {
      id: created.job.id,
      sourceType: extracted.sourceType,
      fileName: extracted.fileName,
      textHash,
    },
  });
  await audit(context, "jd.ai_analysis_requested", "job", created.job.id, {
    after: { id: created.job.id, workflowId: workflow.id },
  });
  revalidatePath("/");
  revalidatePath("/jobs");
  redirect(`/jobs/${created.job.id}/review`);
}

export async function saveJdReviewAction(formData: FormData): Promise<void> {
  const context = await requireHrWorkspaceContext("jobs:manage");
  const jobId = requiredText(formData, "jobId", 1, 200);
  const title = requiredText(formData, "title", 2, 160);
  const summary = requiredText(formData, "summary", 1, 2_000);
  const details = optionalText(formData, "details", 10_000);
  const responsibilities = textareaList(formData, "responsibilities");
  const requiredSkills = textareaList(formData, "requiredSkills");
  const niceToHaveSkills = textareaList(formData, "niceToHaveSkills");
  const competencies = textareaList(formData, "competencies").map((line) => {
    const [name, ...descriptionParts] = line.split(":");
    return {
      name: name.trim(),
      description: descriptionParts.join(":").trim() || "Assess role-related evidence.",
    };
  });
  const questions = parseJdQuestions(formData);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.job.update({
      where: { companyId_id: { companyId: context.tenant.companyId, id: jobId } },
      data: {
        title,
        descriptionJson: { summary, details, source: "jd_review" } satisfies Prisma.InputJsonObject,
        requirementsJson: { items: requiredSkills } satisfies Prisma.InputJsonObject,
        employmentType: enumValue(formData, "employmentType", [
          "FULL_TIME",
          "PART_TIME",
          "CONTRACT",
          "TEMPORARY",
          "INTERNSHIP",
        ]),
        workplaceType: enumValue(formData, "workplaceType", ["ONSITE", "HYBRID", "REMOTE"]),
        seniorityLevel: enumValue(formData, "seniorityLevel", [
          "ENTRY",
          "MID",
          "SENIOR",
          "STAFF",
          "EXECUTIVE",
        ]),
      },
    });
    await tx.jobIntelligenceProfile.update({
      where: { companyId_jobId: { companyId: context.tenant.companyId, jobId } },
      data: {
        status: "HR_REVIEW_NEEDED",
        title,
        responsibilitiesJson: responsibilities,
        requiredSkillsJson: requiredSkills,
        niceToHaveSkillsJson: niceToHaveSkills,
        competenciesJson: competencies,
        interviewStructureJson: textareaList(formData, "interviewStructure"),
        rubricJson: textareaList(formData, "rubric"),
        redFlagsJson: textareaList(formData, "redFlags"),
        editedAt: now,
      },
    });
    await tx.jobInterviewQuestion.deleteMany({
      where: { companyId: context.tenant.companyId, jobId },
    });
    await tx.jobInterviewQuestion.createMany({
      data: questions.map((question, index) => ({
        companyId: context.tenant.companyId,
        jobId,
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
  await audit(context, "jd.job_profile_edited", "job", jobId, { after: { id: jobId, title } });
  await audit(context, "jd.interview_plan_edited", "job", jobId, {
    after: { id: jobId, questionCount: questions.length },
  });
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/jobs/${jobId}/review`);
}

export async function publishJdJobAction(formData: FormData): Promise<void> {
  const context = await requireHrWorkspaceContext("jobs:manage");
  const jobId = requiredText(formData, "jobId", 1, 200);
  const job = await prisma.job.findUnique({
    where: { companyId_id: { companyId: context.tenant.companyId, id: jobId } },
    include: {
      intelligenceProfile: true,
      interviewQuestions: { orderBy: { sequence: "asc" } },
      plans: { where: { deletedAt: null }, orderBy: { createdAt: "asc" }, take: 1 },
    },
  });
  if (job?.intelligenceProfile == null) {
    throw new Error("Job review is required before publishing.");
  }
  if (job.interviewQuestions.length < 3) {
    throw new Error("Publish requires at least three interview questions.");
  }
  const profile = job.intelligenceProfile;
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const plan =
      job.plans[0] ??
      (await tx.interviewPlan.create({
        data: {
          companyId: context.tenant.companyId,
          jobId: job.id,
          name: `${job.title} interview`,
          status: "ACTIVE",
        },
      }));
    await tx.interviewPlan.update({
      where: { companyId_id: { companyId: context.tenant.companyId, id: plan.id } },
      data: { status: "ACTIVE", name: `${job.title} interview` },
    });
    await tx.interviewPlanVersion.updateMany({
      where: { companyId: context.tenant.companyId, interviewPlanId: plan.id, status: "PUBLISHED" },
      data: { status: "RETIRED" },
    });
    const latest = await tx.interviewPlanVersion.aggregate({
      where: { companyId: context.tenant.companyId, interviewPlanId: plan.id },
      _max: { versionNumber: true },
    });
    const version = await tx.interviewPlanVersion.create({
      data: {
        companyId: context.tenant.companyId,
        interviewPlanId: plan.id,
        versionNumber: (latest._max.versionNumber ?? 0) + 1,
        status: "PUBLISHED",
        competencyJson: buildJdCompetencyJson(profile.competenciesJson),
        questionBlueprintJson: buildJdQuestionBlueprint(job.interviewQuestions),
        durationMinutes: Math.max(20, Math.min(60, job.interviewQuestions.length * 8)),
        publishedAt: now,
      },
    });
    await tx.interviewPlan.update({
      where: { companyId_id: { companyId: context.tenant.companyId, id: plan.id } },
      data: { activeVersionId: version.id },
    });
    await tx.job.update({
      where: { companyId_id: { companyId: context.tenant.companyId, id: job.id } },
      data: { status: "OPEN", openedAt: now, closedAt: null },
    });
    await tx.jobIntelligenceProfile.update({
      where: { companyId_jobId: { companyId: context.tenant.companyId, jobId: job.id } },
      data: { status: "PUBLISHED", publishedAt: now },
    });
  });
  await audit(context, "jd.job_published", "job", job.id, {
    after: { id: job.id, status: "OPEN", questionCount: job.interviewQuestions.length },
  });
  revalidatePath("/");
  revalidatePath("/jobs");
  redirect(`/jobs/${job.id}`);
}

export async function updateJobAction(formData: FormData): Promise<void> {
  const context = await requireHrWorkspaceContext("jobs:manage");
  const jobId = requiredText(formData, "jobId", 1, 200);
  const title = requiredText(formData, "title", 2, 120);
  const summary = requiredText(formData, "summary", 1, 2_000);
  const details = optionalText(formData, "details", 10_000);
  const status = enumValue(formData, "status", ["DRAFT", "OPEN", "PAUSED", "CLOSED", "ARCHIVED"]);
  const requiredSkills = textareaList(formData, "requiredSkills");
  const responsibilities = textareaList(formData, "responsibilities");
  const niceToHaveSkills = textareaList(formData, "niceToHaveSkills");
  const locationText = optionalText(formData, "locationText", 160);
  const departmentText = optionalText(formData, "departmentText", 160);
  const experienceText = optionalText(formData, "experienceText", 400);
  const now = new Date();
  const job = await prisma.$transaction(async (tx) => {
    const updated = await tx.job.update({
      where: { companyId_id: { companyId: context.tenant.companyId, id: jobId } },
      data: {
        title,
        descriptionJson: { summary, details } satisfies Prisma.InputJsonObject,
        requirementsJson: { items: requiredSkills } satisfies Prisma.InputJsonObject,
        employmentType: enumValue(formData, "employmentType", [
          "FULL_TIME",
          "PART_TIME",
          "CONTRACT",
          "TEMPORARY",
          "INTERNSHIP",
        ]),
        workplaceType: enumValue(formData, "workplaceType", ["ONSITE", "HYBRID", "REMOTE"]),
        seniorityLevel: enumValue(formData, "seniorityLevel", [
          "ENTRY",
          "MID",
          "SENIOR",
          "STAFF",
          "EXECUTIVE",
        ]),
        status,
        openedAt: status === "OPEN" ? now : undefined,
        closedAt: status === "CLOSED" ? now : status === "OPEN" ? null : undefined,
      },
    });
    await tx.jobIntelligenceProfile.updateMany({
      where: { companyId: context.tenant.companyId, jobId },
      data: {
        title,
        locationText,
        departmentText,
        experienceText,
        responsibilitiesJson: responsibilities,
        requiredSkillsJson: requiredSkills,
        niceToHaveSkillsJson: niceToHaveSkills,
        editedAt: now,
      },
    });
    return updated;
  });
  await audit(context, "hr_mvp.job_updated", "job", job.id, { after: { id: job.id, title } });
  revalidatePath("/jobs");
  redirect(`/jobs/${job.id}`);
}

export async function setJobStatusAction(formData: FormData): Promise<void> {
  const context = await requireHrWorkspaceContext("jobs:manage");
  const jobId = requiredText(formData, "jobId", 1, 200);
  const status = enumValue(formData, "status", ["OPEN", "CLOSED", "PAUSED"]);
  const job = await prisma.job.update({
    where: { companyId_id: { companyId: context.tenant.companyId, id: jobId } },
    data: {
      status,
      openedAt: status === "OPEN" ? new Date() : undefined,
      closedAt: status === "CLOSED" ? new Date() : status === "OPEN" ? null : undefined,
    },
  });
  await audit(context, "hr_mvp.job_status_changed", "job", job.id, {
    after: { id: job.id, status },
  });
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${job.id}`);
}

export async function createCandidateAction(formData: FormData): Promise<void> {
  const context = await requireHrWorkspaceContext("candidates:manage");
  const fullName = requiredText(formData, "fullName", 2, 160);
  const email = requiredText(formData, "email", 3, 320).toLowerCase();
  const phone = optionalText(formData, "phone", 40);
  const candidate = await prisma.candidate.create({
    data: {
      companyId: context.tenant.companyId,
      fullName,
      primaryEmail: email,
      normalizedEmail: email,
      phone,
      sourceType: "MANUAL",
      sourceLabel: "HR workspace",
      profileJson: {},
    },
  });
  await audit(context, "hr_mvp.candidate_created", "candidate", candidate.id, {
    after: { id: candidate.id, email },
  });
  revalidatePath("/");
  revalidatePath("/candidates");
  redirect(`/candidates/${candidate.id}`);
}

export async function updateCandidateAction(formData: FormData): Promise<void> {
  const context = await requireHrWorkspaceContext("candidates:manage");
  const candidateId = requiredText(formData, "candidateId", 1, 200);
  const fullName = requiredText(formData, "fullName", 2, 160);
  const email = requiredText(formData, "email", 3, 320).toLowerCase();
  const phone = optionalText(formData, "phone", 40);
  const candidate = await prisma.candidate.update({
    where: { companyId_id: { companyId: context.tenant.companyId, id: candidateId } },
    data: { fullName, primaryEmail: email, normalizedEmail: email, phone },
  });
  await audit(context, "hr_mvp.candidate_updated", "candidate", candidate.id, {
    after: { id: candidate.id, email },
  });
  revalidatePath("/candidates");
  redirect(`/candidates/${candidate.id}`);
}

export async function updateCompanySettingsAction(formData: FormData): Promise<void> {
  const context = await requireHrWorkspaceContext("tenant:manage");
  const displayName = optionalText(formData, "displayName", 160);
  const logoUrl = optionalText(formData, "logoUrl", 500);
  const primaryColor = readFormText(formData, "primaryColor").trim() || "#2563EB";
  const duplicateCandidateMode = readFormText(formData, "duplicateCandidateMode") === "on";
  const allowEmailLessCandidates = readFormText(formData, "allowEmailLessCandidates") === "on";
  const defaultExpirationDays = boundedInteger(formData, "defaultExpirationDays", 1, 30);
  const minimumExpirationHours = boundedInteger(formData, "minimumExpirationHours", 1, 168);
  const maximumExpirationDays = boundedInteger(formData, "maximumExpirationDays", 1, 90);
  const defaultTimeZone = requiredText(formData, "defaultTimeZone", 1, 120);

  const service = new CompanySettingsService(
    new PrismaCompanySettingsRepository(),
    new AuditWriter(new PrismaAuditEventStore()),
  );

  await service.updateBranding({
    tenant: context.tenant,
    actor: context.actor,
    request: context.request,
    displayName,
    logoUrl,
    primaryColor,
  });
  await service.updateCandidatePolicy({
    tenant: context.tenant,
    actor: context.actor,
    request: context.request,
    duplicateCandidateMode,
    allowEmailLessCandidates,
  });
  await service.updateInvitationPolicy({
    tenant: context.tenant,
    actor: context.actor,
    request: context.request,
    defaultExpirationDays,
    minimumExpirationHours,
    maximumExpirationDays,
  });
  await service.updateSchedulingPolicy({
    tenant: context.tenant,
    actor: context.actor,
    request: context.request,
    defaultTimeZone,
    allowExternalCalendarSync: false,
  });

  revalidatePath("/settings/company");
  revalidatePath("/dashboard");
  revalidatePath("/jobs");
}

export async function createApplicationAction(formData: FormData): Promise<void> {
  const context = await requireHrWorkspaceContext("applications:manage");
  const candidateId = requiredText(formData, "candidateId", 1, 200);
  const jobId = requiredText(formData, "jobId", 1, 200);
  const stageId = optionalText(formData, "stageId", 200);
  const application = await prisma.candidateApplication.create({
    data: {
      companyId: context.tenant.companyId,
      candidateId,
      jobId,
      currentStageId: stageId,
      metadataJson: {},
    },
  });
  await audit(context, "hr_mvp.application_created", "candidate_application", application.id, {
    after: { id: application.id, candidateId, jobId },
  });
  revalidatePath("/");
  revalidatePath("/jobs");
  revalidatePath("/candidates");
  redirect(`/candidates/${candidateId}`);
}

export async function updateApplicationStageAction(formData: FormData): Promise<void> {
  const context = await requireHrWorkspaceContext("applications:manage");
  const applicationId = requiredText(formData, "applicationId", 1, 200);
  const stageId = optionalText(formData, "stageId", 200);
  const application = await prisma.candidateApplication.update({
    where: { companyId_id: { companyId: context.tenant.companyId, id: applicationId } },
    data: { currentStageId: stageId },
  });
  await audit(
    context,
    "hr_mvp.application_stage_changed",
    "candidate_application",
    application.id,
    {
      after: { id: application.id, stageId },
    },
  );
  revalidatePath("/jobs");
  revalidatePath("/candidates");
}

export async function shortlistApplicationAction(formData: FormData): Promise<void> {
  await recordApplicationDecision(formData, "SHORTLISTED", "SHORTLISTED");
}

export async function markApplicationNotSelectedAction(formData: FormData): Promise<void> {
  await recordApplicationDecision(formData, "NOT_SELECTED", "NOT_SELECTED");
}

export async function returnApplicationToReviewAction(formData: FormData): Promise<void> {
  await recordApplicationDecision(formData, "RETURNED_TO_REVIEW", "IN_REVIEW");
}

export async function recordHrVerificationAction(formData: FormData): Promise<void> {
  const context = await requireHrWorkspaceContext("applications:manage");
  const applicationId = requiredText(formData, "applicationId", 1, 200);
  const decision = enumValue(formData, "decision", [
    "HR_VERIFIED",
    "HR_REJECTED",
    "HOLD",
    "REQUEST_ANOTHER_AI_INTERVIEW",
  ]);
  const note = requiredText(formData, "verificationNote", 5, 2_000);
  const nextStatus = hrVerificationStatus(decision);
  const now = new Date();

  const application = await prisma.$transaction(async (tx) => {
    const existing = await tx.candidateApplication.findUnique({
      where: { companyId_id: { companyId: context.tenant.companyId, id: applicationId } },
    });
    if (existing === null) {
      throw new Error("Application was not found.");
    }
    const updated = await tx.candidateApplication.update({
      where: { companyId_id: { companyId: context.tenant.companyId, id: applicationId } },
      data: {
        status: nextStatus,
        rejectedAt: nextStatus === "NOT_SELECTED" ? now : null,
      },
    });
    await tx.applicationDecisionHistory.create({
      data: {
        companyId: context.tenant.companyId,
        applicationId: updated.id,
        candidateId: updated.candidateId,
        jobId: updated.jobId,
        decision,
        note,
        createdByUserId: context.actor.id,
      },
    });
    return updated;
  });

  await audit(
    context,
    "application.hr_verification_recorded",
    "candidate_application",
    application.id,
    {
      after: {
        id: application.id,
        decision,
        status: application.status,
        noteAdded: true,
      },
    },
  );
  revalidatePath(`/applications/${application.id}/verification`);
  revalidatePath(`/jobs/${application.jobId}`);
  revalidatePath(`/candidates/${application.candidateId}`);
}

export async function recordHrInterviewOutcomeAction(formData: FormData): Promise<void> {
  const context = await requireHrWorkspaceContext("applications:manage");
  const applicationId = requiredText(formData, "applicationId", 1, 200);
  const outcome = enumValue(formData, "outcome", ["HIRE", "REJECT", "HOLD"]);
  const note = requiredText(formData, "outcomeNote", 5, 2_000);
  const score = parseHrInterviewScore(formData);
  const onboardingDate = optionalDateText(formData, "onboardingDate");
  const now = new Date();
  const decision = hrOutcomeDecision(outcome);
  const nextStatus = hrOutcomeStatus(outcome);

  const application = await prisma.$transaction(async (tx) => {
    const existing = await tx.candidateApplication.findUnique({
      where: { companyId_id: { companyId: context.tenant.companyId, id: applicationId } },
      include: { candidate: { select: { fullName: true, primaryEmail: true } }, job: true },
    });
    if (existing === null) {
      throw new Error("Application was not found.");
    }
    if (!["INTERVIEW", "OFFER", "HIRED", "REJECTED"].includes(existing.status)) {
      throw new Error("Record HR verification before final interview outcome.");
    }
    if (!isHrOutcomeAllowed(outcome, existing.status)) {
      throw new Error("This HR interview outcome cannot be recorded for the current status.");
    }
    const metadata = readJsonObject(existing.metadataJson);
    const updated = await tx.candidateApplication.update({
      where: { companyId_id: { companyId: context.tenant.companyId, id: applicationId } },
      data: {
        status: nextStatus,
        hiredAt: nextStatus === "HIRED" ? now : existing.hiredAt,
        rejectedAt: nextStatus === "REJECTED" ? now : existing.rejectedAt,
        metadataJson: {
          ...metadata,
          hrInterviewOutcome: {
            schemaVersion: 1,
            decision,
            score,
            note,
            onboardingDate,
            recordedAt: now.toISOString(),
            recordedByUserId: context.actor.id,
          },
        } satisfies Prisma.InputJsonObject,
      },
    });
    await tx.applicationDecisionHistory.create({
      data: {
        companyId: context.tenant.companyId,
        applicationId: updated.id,
        candidateId: updated.candidateId,
        jobId: updated.jobId,
        decision,
        note,
        createdByUserId: context.actor.id,
      },
    });
    if (nextStatus === "HIRED" || nextStatus === "REJECTED") {
      await createCandidateDecisionNotificationIntent(tx, {
        companyId: context.tenant.companyId,
        applicationId: updated.id,
        candidateEmail: existing.candidate.primaryEmail,
        candidateName: existing.candidate.fullName,
        jobTitle: existing.job.title,
        decision,
        status: nextStatus,
        onboardingDate,
      });
    }
    return updated;
  });

  await audit(
    context,
    "application.hr_interview_outcome_recorded",
    "candidate_application",
    application.id,
    {
      after: {
        id: application.id,
        decision,
        status: application.status,
        score,
        onboardingDateSet: onboardingDate !== null,
        noteAdded: true,
      },
    },
  );
  revalidatePath(`/applications/${application.id}/verification`);
  revalidatePath(`/jobs/${application.jobId}`);
  revalidatePath(`/candidates/${application.candidateId}`);
}

export async function createAvailabilitySlotAction(formData: FormData): Promise<void> {
  const context = await requireHrWorkspaceContext("applications:manage");
  const jobId = requiredText(formData, "jobId", 1, 200);
  const date = requiredText(formData, "slotDate", 8, 20);
  const start = requiredText(formData, "startTime", 4, 20);
  const end = requiredText(formData, "endTime", 4, 20);
  const timezone = readFormText(formData, "timezone").trim() || "Asia/Colombo";
  const startAt = new Date(`${date}T${start}:00`);
  const endAt = new Date(`${date}T${end}:00`);
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || endAt <= startAt) {
    throw new Error("Availability slot start and end times are invalid.");
  }

  const job = await prisma.job.findUnique({
    where: { companyId_id: { companyId: context.tenant.companyId, id: jobId } },
    select: { id: true },
  });
  if (job === null) {
    throw new Error("Job was not found.");
  }

  const slot = await prisma.interviewAvailabilitySlot.create({
    data: {
      companyId: context.tenant.companyId,
      jobId,
      startAt,
      endAt,
      timezone,
      locationNote: optionalText(formData, "locationNote", 1_000),
      isOnline: formData.get("isOnline") !== "false",
      status: "OPEN",
      createdByUserId: context.actor.id,
    },
  });
  await audit(context, "availability.slot_created", "interview_availability_slot", slot.id, {
    after: { id: slot.id, jobId, startAt: slot.startAt, endAt: slot.endAt, status: slot.status },
  });
  revalidatePath(`/jobs/${jobId}`);
}

export async function sendAvailabilityRequestAction(formData: FormData): Promise<void> {
  const context = await requireHrWorkspaceContext("applications:manage");
  const applicationId = requiredText(formData, "applicationId", 1, 200);
  const now = new Date();
  const tokenSalt = randomBytes(16).toString("base64url");

  const result = await prisma.$transaction(async (tx) => {
    const application = await tx.candidateApplication.findUnique({
      where: { companyId_id: { companyId: context.tenant.companyId, id: applicationId } },
      include: { job: true, candidate: true },
    });
    if (application === null) {
      throw new Error("Application was not found.");
    }
    if (application.status !== "SHORTLISTED" && application.status !== "AVAILABILITY_REQUESTED") {
      throw new Error("Shortlist the application before requesting availability.");
    }
    if (application.job.status !== "OPEN") {
      throw new Error("Availability can only be requested for open jobs.");
    }

    const openSlotCount = await tx.interviewAvailabilitySlot.count({
      where: {
        companyId: context.tenant.companyId,
        jobId: application.jobId,
        status: "OPEN",
        startAt: { gt: now },
      },
    });
    if (openSlotCount === 0) {
      throw new Error("Create at least one upcoming availability slot first.");
    }

    await tx.applicationAvailabilityRequest.updateMany({
      where: {
        companyId: context.tenant.companyId,
        applicationId,
        status: "ACTIVE",
      },
      data: { status: "CANCELLED", cancelledAt: now },
    });

    const request = await tx.applicationAvailabilityRequest.create({
      data: {
        companyId: context.tenant.companyId,
        jobId: application.jobId,
        applicationId: application.id,
        candidateId: application.candidateId,
        candidateAccountId: application.candidateAccountId,
        tokenHash: `pending:${randomBytes(16).toString("base64url")}`,
        tokenSalt,
        status: "ACTIVE",
        expiresAt: new Date(now.getTime() + DEFAULT_AVAILABILITY_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
        sentAt: now,
        emailStatus: "LINK_GENERATED",
        createdByUserId: context.actor.id,
      },
    });
    const token = createAvailabilityRequestToken({
      requestId: request.id,
      companyId: request.companyId,
      applicationId: request.applicationId,
      tokenSalt,
    });
    const updated = await tx.applicationAvailabilityRequest.update({
      where: { companyId_id: { companyId: context.tenant.companyId, id: request.id } },
      data: { tokenHash: hashAvailabilityRequestToken(token) },
    });
    await tx.candidateApplication.update({
      where: { companyId_id: { companyId: context.tenant.companyId, id: application.id } },
      data: { status: "AVAILABILITY_REQUESTED" },
    });
    return { request: updated, application };
  });

  await audit(
    context,
    "availability.request_sent",
    "application_availability_request",
    result.request.id,
    {
      after: {
        id: result.request.id,
        applicationId: result.application.id,
        status: result.request.status,
        emailStatus: result.request.emailStatus,
      },
    },
  );
  revalidatePath(`/jobs/${result.application.jobId}`);
  revalidatePath(`/candidates/${result.application.candidateId}`);
}

export async function createHrInterviewSlotAction(formData: FormData): Promise<void> {
  const context = await requireHrWorkspaceContext("applications:manage");
  const applicationId = requiredText(formData, "applicationId", 1, 200);
  const date = requiredText(formData, "slotDate", 8, 20);
  const start = requiredText(formData, "startTime", 4, 20);
  const end = requiredText(formData, "endTime", 4, 20);
  const timezone = readFormText(formData, "timezone").trim() || "Asia/Colombo";
  const startAt = new Date(`${date}T${start}:00`);
  const endAt = new Date(`${date}T${end}:00`);
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || endAt <= startAt) {
    throw new Error("HR interview slot start and end times are invalid.");
  }
  const application = await prisma.candidateApplication.findUnique({
    where: { companyId_id: { companyId: context.tenant.companyId, id: applicationId } },
    select: { id: true, jobId: true },
  });
  if (application === null) {
    throw new Error("Application was not found.");
  }
  const slot = await prisma.interviewAvailabilitySlot.create({
    data: {
      companyId: context.tenant.companyId,
      jobId: application.jobId,
      purpose: "HR_INTERVIEW",
      startAt,
      endAt,
      timezone,
      locationNote: optionalText(formData, "locationNote", 1_000),
      isOnline: formData.get("isOnline") !== "false",
      status: "OPEN",
      createdByUserId: context.actor.id,
    },
  });
  await audit(context, "hr_interview.slot_created", "interview_availability_slot", slot.id, {
    after: { id: slot.id, applicationId, jobId: application.jobId, startAt, endAt },
  });
  revalidatePath(`/applications/${applicationId}/verification`);
}

export async function sendHrInterviewAvailabilityRequestAction(formData: FormData): Promise<void> {
  const context = await requireHrWorkspaceContext("applications:manage");
  const applicationId = requiredText(formData, "applicationId", 1, 200);
  const now = new Date();
  const tokenSalt = randomBytes(16).toString("base64url");

  const result = await prisma.$transaction(async (tx) => {
    const application = await tx.candidateApplication.findUnique({
      where: { companyId_id: { companyId: context.tenant.companyId, id: applicationId } },
      include: { job: true, candidate: true },
    });
    if (application === null) {
      throw new Error("Application was not found.");
    }
    if (application.status !== "INTERVIEW") {
      throw new Error("Approve this candidate for HR interview before sending scheduling.");
    }
    if (application.job.status !== "OPEN") {
      throw new Error("HR interview scheduling is only available for open jobs.");
    }
    const openSlotCount = await tx.interviewAvailabilitySlot.count({
      where: {
        companyId: context.tenant.companyId,
        jobId: application.jobId,
        purpose: "HR_INTERVIEW",
        status: "OPEN",
        startAt: { gt: now },
      },
    });
    if (openSlotCount === 0) {
      throw new Error("Create at least one upcoming HR interview slot first.");
    }
    await tx.applicationAvailabilityRequest.updateMany({
      where: {
        companyId: context.tenant.companyId,
        applicationId,
        purpose: "HR_INTERVIEW",
        status: "ACTIVE",
      },
      data: { status: "CANCELLED", cancelledAt: now },
    });
    const request = await tx.applicationAvailabilityRequest.create({
      data: {
        companyId: context.tenant.companyId,
        jobId: application.jobId,
        applicationId: application.id,
        candidateId: application.candidateId,
        candidateAccountId: application.candidateAccountId,
        purpose: "HR_INTERVIEW",
        tokenHash: `pending:${randomBytes(16).toString("base64url")}`,
        tokenSalt,
        status: "ACTIVE",
        expiresAt: new Date(now.getTime() + DEFAULT_AVAILABILITY_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
        sentAt: now,
        emailStatus: "LINK_GENERATED",
        createdByUserId: context.actor.id,
      },
    });
    const token = createAvailabilityRequestToken({
      requestId: request.id,
      companyId: request.companyId,
      applicationId: request.applicationId,
      tokenSalt,
    });
    const updated = await tx.applicationAvailabilityRequest.update({
      where: { companyId_id: { companyId: context.tenant.companyId, id: request.id } },
      data: { tokenHash: hashAvailabilityRequestToken(token) },
    });
    return { request: updated, application };
  });

  await audit(
    context,
    "hr_interview.scheduling_request_sent",
    "application_availability_request",
    result.request.id,
    {
      after: {
        id: result.request.id,
        applicationId: result.application.id,
        purpose: result.request.purpose,
        status: result.request.status,
      },
    },
  );
  revalidatePath(`/applications/${result.application.id}/verification`);
  revalidatePath(`/jobs/${result.application.jobId}`);
  revalidatePath(`/candidates/${result.application.candidateId}`);
}

export async function generatePersonalizedInterviewAction(formData: FormData): Promise<void> {
  const context = await requireHrWorkspaceContext("applications:manage");
  const applicationId = requiredText(formData, "applicationId", 1, 200);
  const plan = await generatePersonalizedInterviewPlan({ context, applicationId });
  await audit(
    context,
    "application.personalized_interview_generated",
    "candidate_application",
    applicationId,
    {
      after: {
        applicationId,
        status: plan.status,
        questionCount: plan.questionCount,
        provider: plan.provider,
        model: plan.model,
      },
    },
  );
  revalidatePath("/jobs");
  revalidatePath("/candidates");
}

export async function regeneratePersonalizedInterviewAction(formData: FormData): Promise<void> {
  const context = await requireHrWorkspaceContext("applications:manage");
  const applicationId = requiredText(formData, "applicationId", 1, 200);
  const plan = await generatePersonalizedInterviewPlan({
    context,
    applicationId,
    forceRegenerate: true,
  });
  await audit(
    context,
    "application.personalized_interview_regenerated",
    "candidate_application",
    applicationId,
    {
      after: {
        applicationId,
        status: plan.status,
        questionCount: plan.questionCount,
        provider: plan.provider,
        model: plan.model,
      },
    },
  );
  revalidatePath("/jobs");
  revalidatePath("/candidates");
}

export async function sendInvitationAction(formData: FormData): Promise<void> {
  const context = await requireHrWorkspaceContext("invitations:manage");
  const applicationId = requiredText(formData, "applicationId", 1, 200);
  const application = await prisma.candidateApplication.findUnique({
    where: { companyId_id: { companyId: context.tenant.companyId, id: applicationId } },
    include: {
      candidate: true,
      job: true,
      personalizedInterviewPlans: { orderBy: { updatedAt: "desc" }, take: 1 },
    },
  });
  if (
    application?.candidate.primaryEmail === null ||
    application?.candidate.primaryEmail === undefined
  ) {
    throw new Error("Application and candidate email are required to send an invitation.");
  }
  const expiryValue = readFormText(formData, "expiresInHours");
  const expiresInHours = Number(expiryValue.length === 0 ? DEFAULT_EXPIRY_HOURS : expiryValue);
  if (!Number.isInteger(expiresInHours) || expiresInHours < 1 || expiresInHours > 336) {
    throw new Error("Invitation expiry must be between 1 and 336 hours.");
  }
  const personalizedPlan = application.personalizedInterviewPlans.at(0) ?? null;
  if (
    personalizedPlan?.status !== "READY" ||
    personalizedPlan.personalizedInterviewPlanVersionId === null
  ) {
    throw new Error("Generate and review a personalized interview before sending the invite.");
  }

  const invitation = await prisma.candidateInvitation.create({
    data: {
      companyId: context.tenant.companyId,
      candidateId: application.candidateId,
      applicationId: application.id,
      jobId: application.jobId,
      interviewPlanVersionId: personalizedPlan.personalizedInterviewPlanVersionId,
      tokenHash: `draft:${randomBytes(24).toString("base64url")}`,
      email: application.candidate.primaryEmail,
      expiresAt: new Date(Date.now() + expiresInHours * 60 * 60 * 1000),
    },
  });

  await new CandidatePortalService().activateInvitation({
    tenant: context.tenant,
    actor: context.actor,
    request: {
      requestId: context.request.requestId ?? "hr-mvp-invitation",
      correlationId: context.request.correlationId ?? "hr-mvp-invitation",
      ipAddress: context.request.ipAddress,
      userAgent: context.request.userAgent,
    },
    invitationId: invitation.id,
    expiresInHours,
    idempotencyKey: `hr-mvp-invitation:${context.tenant.companyId}:${application.id}:${invitation.id}`,
  });

  await audit(context, "hr_mvp.invitation_sent", "candidate_invitation", invitation.id, {
    after: {
      id: invitation.id,
      applicationId: application.id,
      interviewPlanVersionId: personalizedPlan.personalizedInterviewPlanVersionId,
    },
  });
  revalidatePath("/");
  revalidatePath("/jobs");
  revalidatePath("/candidates");
  redirect(`/candidates/${application.candidateId}`);
}

export async function revokeInvitationAction(formData: FormData): Promise<void> {
  const context = await requireHrWorkspaceContext("invitations:manage");
  const invitationId = requiredText(formData, "invitationId", 1, 200);
  const now = new Date();
  const invitation = await prisma.$transaction(async (tx) => {
    const updated = await tx.candidateInvitation.update({
      where: { companyId_id: { companyId: context.tenant.companyId, id: invitationId } },
      data: { status: "CANCELLED", tokenRevokedAt: now, cancelledAt: now },
    });
    await tx.emailDelivery.updateMany({
      where: {
        companyId: context.tenant.companyId,
        templateKey: "INTERVIEW_INVITATION",
        idempotencyKey: { contains: invitationId },
        status: { in: ["PENDING", "QUEUED", "DEFERRED", "FAILED"] },
      },
      data: { status: "CANCELLED", cancelledAt: now },
    });
    return updated;
  });
  await audit(context, "hr_mvp.invitation_revoked", "candidate_invitation", invitation.id, {
    after: { id: invitation.id, status: invitation.status },
  });
  revalidatePath("/jobs");
  revalidatePath("/candidates");
}

async function ensureDefaultPipeline(companyId: string) {
  const existing = await prisma.hiringPipeline.findFirst({
    where: { companyId, slug: "default-hiring-pipeline", status: "ACTIVE" },
  });
  if (existing !== null) {
    return existing;
  }

  return prisma.$transaction(async (tx) => {
    const pipeline = await tx.hiringPipeline.create({
      data: {
        companyId,
        name: "Default hiring pipeline",
        slug: "default-hiring-pipeline",
        description: "Standard hiring flow for staging interviews.",
      },
    });
    const stages = [
      ["Application review", "application-review", "APPLICATION_REVIEW", 1, false],
      ["Interview", "interview", "INTERVIEW", 2, false],
      ["Offer", "offer", "OFFER", 3, false],
      ["Hired", "hired", "HIRED", 4, true],
      ["Rejected", "rejected", "REJECTED", 5, true],
    ] as const;
    await tx.pipelineStage.createMany({
      data: stages.map(([name, slug, category, position, isTerminal]) => ({
        companyId,
        pipelineId: pipeline.id,
        name,
        slug,
        category,
        position,
        isTerminal,
      })),
    });
    return pipeline;
  });
}

function uniqueJobSlug(companyId: string, title: string): string {
  const safeTitle = normalizeSafeJobTitle(title) ?? "Untitled Job";
  const digest = createHash("sha256")
    .update(`${companyId}:${safeTitle}:${Date.now().toString()}`)
    .digest("hex");
  let base = "untitled-job";
  try {
    base = slugify(safeTitle);
  } catch {
    base = "untitled-job";
  }
  return `${base}-${digest.slice(0, 8)}`;
}

function buildQuestionBlueprint(questions: readonly string[]): Prisma.InputJsonArray {
  return questions.map((prompt, index) => ({
    key: `q${String(index + 1)}`,
    kind: index === 0 ? "opening" : index === questions.length - 1 ? "closing" : "main",
    sequence: index + 1,
    prompt,
    required: true,
  }));
}

function defaultCompetencies(): Prisma.InputJsonObject {
  return {
    schemaVersion: 1,
    competencies: [
      { key: "communication", label: "Communication", maxScore: 5 },
      { key: "problem_solving", label: "Problem solving", maxScore: 5 },
      { key: "role_relevance", label: "Role relevance", maxScore: 5 },
      { key: "professionalism", label: "Professionalism", maxScore: 5 },
    ],
  };
}

function parseQuestions(formData: FormData): readonly string[] {
  const raw = requiredText(formData, "questions", 10, 4_000);
  const questions = raw
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (questions.length < 3 || questions.length > 5) {
    throw new Error("Interview plans must include 3 to 5 questions.");
  }
  return questions;
}

function parseJdQuestions(formData: FormData) {
  const count = Number(readFormText(formData, "questionCount") || "0");
  if (!Number.isInteger(count) || count < 3 || count > 8) {
    throw new Error("Job interview plans must include 3 to 8 questions.");
  }
  return Array.from({ length: count }, (_, index) => {
    const prefix = `questions.${String(index)}.`;
    return {
      competencyName: requiredText(formData, `${prefix}competencyName`, 1, 160),
      competencyDescription: optionalText(formData, `${prefix}competencyDescription`, 1_000),
      questionText: requiredText(formData, `${prefix}questionText`, 10, 2_000),
      questionType: enumValue(formData, `${prefix}questionType`, [
        "introduction",
        "behavioral",
        "technical",
        "situational",
        "role-specific",
        "culture/team fit",
      ]),
      difficulty: enumValue(formData, `${prefix}difficulty`, [
        "introductory",
        "standard",
        "advanced",
      ]),
      expectedAnswerSignals: textareaList(formData, `${prefix}expectedAnswerSignals`),
      scoringRubric: textareaList(formData, `${prefix}scoringRubric`),
      redFlags: textareaList(formData, `${prefix}redFlags`),
      followUps: textareaList(formData, `${prefix}followUps`),
    };
  });
}

function textareaList(formData: FormData, key: string): string[] {
  return readFormText(formData, key)
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 30);
}

function buildJdQuestionBlueprint(
  questions: readonly {
    readonly sequence: number;
    readonly questionText: string;
    readonly competencyName: string;
    readonly questionType: string;
    readonly difficulty: string;
  }[],
): Prisma.InputJsonArray {
  return questions.map((question, index) => ({
    key: `q${String(index + 1)}`,
    kind: index === 0 ? "opening" : index === questions.length - 1 ? "closing" : "main",
    sequence: question.sequence,
    prompt: question.questionText,
    required: true,
    competency: question.competencyName,
    questionType: question.questionType,
    difficulty: question.difficulty,
  }));
}

function buildJdCompetencyJson(value: Prisma.JsonValue): Prisma.InputJsonObject {
  const rows = Array.isArray(value) ? value : [];
  const competencies = rows
    .map((row, index) => {
      if (typeof row !== "object" || row === null || Array.isArray(row)) {
        return null;
      }
      const name = (row as { name?: unknown }).name;
      return {
        key:
          typeof name === "string"
            ? slugify(name).replace(/-/gu, "_").slice(0, 80) || `competency_${String(index + 1)}`
            : `competency_${String(index + 1)}`,
        label:
          typeof name === "string" && name.length > 0 ? name : `Competency ${String(index + 1)}`,
        maxScore: 5,
      };
    })
    .filter((row): row is { key: string; label: string; maxScore: number } => row !== null)
    .slice(0, 8);
  return {
    schemaVersion: 1,
    competencies:
      competencies.length > 0
        ? competencies
        : [
            { key: "communication", label: "Communication", maxScore: 5 },
            { key: "problem_solving", label: "Problem solving", maxScore: 5 },
            { key: "role_relevance", label: "Role relevance", maxScore: 5 },
            { key: "professionalism", label: "Professionalism", maxScore: 5 },
          ],
  } satisfies Prisma.InputJsonObject;
}

function deriveSafeJdTitle(input: {
  readonly submittedTitle: string;
  readonly pastedText: string;
  readonly extractedText: string;
}): string {
  return (
    normalizeSafeJobTitle(input.submittedTitle) ??
    normalizeSafeJobTitle(parseJobDescriptionAutofill(input.pastedText).title ?? "") ??
    normalizeSafeJobTitle(firstMeaningfulJdLine(input.pastedText)) ??
    normalizeSafeJobTitle(firstMeaningfulJdLine(input.extractedText)) ??
    "Untitled Job"
  );
}

function firstMeaningfulJdLine(value: string): string {
  const lines = value.includes("\n") ? value.split(/\r?\n/u) : value.split(/[.!?]/u);
  return (
    lines
      .map((line) => line.replace(/^[-*•\d.)\s]+/u, "").trim())
      .find((line) => isUsableJobTitle(line)) ?? ""
  );
}

function normalizeSafeJobTitle(value: string): string | null {
  const normalized = value.replace(/\s+/gu, " ").trim();
  if (!isUsableJobTitle(normalized)) {
    return null;
  }
  return normalized.slice(0, 120);
}

function isUsableJobTitle(value: string): boolean {
  if (value.length < 2 || value.length > 140) {
    return false;
  }
  const lower = value.toLowerCase();
  return ![
    "job description",
    "about the role",
    "overview",
    "responsibilities",
    "requirements",
    "nice to have",
    "preferred",
  ].some((label) => lower === label || lower.startsWith(`${label}:`));
}

function requiredText(formData: FormData, key: string, min: number, max: number): string {
  const value = readFormText(formData, key).trim();
  if (value.length < min || value.length > max) {
    throw new Error(`${key} must be between ${String(min)} and ${String(max)} characters.`);
  }
  return value;
}

function optionalText(formData: FormData, key: string, max: number): string | null {
  const value = readFormText(formData, key).trim();
  if (value.length === 0) {
    return null;
  }
  if (value.length > max) {
    throw new Error(`${key} cannot exceed ${String(max)} characters.`);
  }
  return value;
}

function enumValue<const T extends readonly [string, ...string[]]>(
  formData: FormData,
  key: string,
  allowed: T,
): T[number] {
  const value = readFormText(formData, key).trim() || allowed[0];
  if (!allowed.includes(value)) {
    throw new Error(`${key} is invalid.`);
  }
  return value;
}

function readFormText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function boundedInteger(formData: FormData, key: string, min: number, max: number): number {
  const value = Number(readFormText(formData, key).trim());
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${key} must be between ${String(min)} and ${String(max)}.`);
  }
  return value;
}

function hrVerificationStatus(
  decision: "HR_VERIFIED" | "HR_REJECTED" | "HOLD" | "REQUEST_ANOTHER_AI_INTERVIEW",
): "INTERVIEW" | "NOT_SELECTED" | "IN_REVIEW" | "AVAILABILITY_CONFIRMED" {
  switch (decision) {
    case "HR_VERIFIED":
      return "INTERVIEW";
    case "HR_REJECTED":
      return "NOT_SELECTED";
    case "REQUEST_ANOTHER_AI_INTERVIEW":
      return "AVAILABILITY_CONFIRMED";
    case "HOLD":
      return "IN_REVIEW";
  }
}

function hrOutcomeDecision(outcome: "HIRE" | "REJECT" | "HOLD"): "HIRED" | "REJECTED" | "HOLD" {
  switch (outcome) {
    case "HIRE":
      return "HIRED";
    case "REJECT":
      return "REJECTED";
    case "HOLD":
      return "HOLD";
  }
}

function hrOutcomeStatus(outcome: "HIRE" | "REJECT" | "HOLD"): "HIRED" | "REJECTED" | "INTERVIEW" {
  switch (outcome) {
    case "HIRE":
      return "HIRED";
    case "REJECT":
      return "REJECTED";
    case "HOLD":
      return "INTERVIEW";
  }
}

function isHrOutcomeAllowed(outcome: "HIRE" | "REJECT" | "HOLD", status: string): boolean {
  if (outcome === "HIRE") {
    return status === "INTERVIEW" || status === "HIRED";
  }
  if (outcome === "REJECT") {
    return status === "INTERVIEW" || status === "REJECTED";
  }
  return status === "INTERVIEW";
}

async function createCandidateDecisionNotificationIntent(
  tx: Prisma.TransactionClient,
  input: {
    readonly companyId: string;
    readonly applicationId: string;
    readonly candidateEmail: string | null;
    readonly candidateName: string;
    readonly jobTitle: string;
    readonly decision: "HIRED" | "REJECTED" | "HOLD";
    readonly status: "HIRED" | "REJECTED";
    readonly onboardingDate: string | null;
  },
): Promise<void> {
  if (input.candidateEmail === null) {
    return;
  }
  const recipientEmail = input.candidateEmail.trim().toLowerCase();
  if (recipientEmail.length === 0) {
    return;
  }
  const existing = await tx.notificationIntent.findFirst({
    where: {
      companyId: input.companyId,
      type: "APPLICATION_DECISION",
      recipientEmail,
      targetResourceType: "candidate_application",
      targetResourceId: input.applicationId,
      status: { in: ["PENDING", "DISPATCHED"] },
    },
    select: { id: true },
  });
  if (existing !== null) {
    return;
  }
  await tx.notificationIntent.create({
    data: {
      companyId: input.companyId,
      type: "APPLICATION_DECISION",
      channel: "EMAIL",
      recipientEmail,
      recipientName: input.candidateName,
      targetResourceType: "candidate_application",
      targetResourceId: input.applicationId,
      payloadJson: {
        schemaVersion: 1,
        applicationId: input.applicationId,
        jobTitle: input.jobTitle,
        decision: input.decision,
        status: input.status,
        onboardingDate: input.onboardingDate,
      } satisfies Prisma.InputJsonObject,
    },
  });
}

function parseHrInterviewScore(formData: FormData): number | null {
  const raw = readFormText(formData, "interviewScore").trim();
  if (raw.length === 0) {
    return null;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new Error("Interview score must be between 1 and 5.");
  }
  return value;
}

function optionalDateText(formData: FormData, key: string): string | null {
  const value = readFormText(formData, key).trim();
  if (value.length === 0) {
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    throw new Error(`${key} must use YYYY-MM-DD format.`);
  }
  return value;
}

function readJsonObject(value: Prisma.JsonValue): Prisma.InputJsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
}

async function recordApplicationDecision(
  formData: FormData,
  decision: "SHORTLISTED" | "NOT_SELECTED" | "RETURNED_TO_REVIEW",
  nextStatus: "SHORTLISTED" | "NOT_SELECTED" | "IN_REVIEW",
): Promise<void> {
  const context = await requireHrWorkspaceContext("applications:manage");
  const applicationId = requiredText(formData, "applicationId", 1, 200);
  const note = optionalText(formData, "decisionNote", 2_000);
  const now = new Date();
  const application = await prisma.$transaction(async (tx) => {
    const existing = await tx.candidateApplication.findUnique({
      where: { companyId_id: { companyId: context.tenant.companyId, id: applicationId } },
    });
    if (existing === null) {
      throw new Error("Application was not found.");
    }
    const updated = await tx.candidateApplication.update({
      where: { companyId_id: { companyId: context.tenant.companyId, id: applicationId } },
      data: {
        status: nextStatus,
        rejectedAt: nextStatus === "NOT_SELECTED" ? now : null,
      },
    });
    await tx.applicationDecisionHistory.create({
      data: {
        companyId: context.tenant.companyId,
        applicationId: updated.id,
        candidateId: updated.candidateId,
        jobId: updated.jobId,
        decision,
        note,
        createdByUserId: context.actor.id,
      },
    });
    return updated;
  });
  await audit(context, "application.decision_recorded", "candidate_application", application.id, {
    after: { id: application.id, decision, status: application.status, noteAdded: note !== null },
  });
  revalidatePath(`/jobs/${application.jobId}`);
  revalidatePath(`/candidates/${application.candidateId}`);
}

async function audit(
  context: Awaited<ReturnType<typeof requireHrWorkspaceContext>>,
  action: string,
  resourceType: string,
  resourceId: string,
  snapshots: { readonly before?: unknown; readonly after?: unknown },
): Promise<void> {
  await new AuditWriter(new PrismaAuditEventStore()).record({
    companyId: context.tenant.companyId,
    actor: context.actor,
    request: context.request,
    action,
    resourceType,
    resourceId,
    riskLevel: "medium",
    before: snapshots.before,
    after: snapshots.after,
  });
}
