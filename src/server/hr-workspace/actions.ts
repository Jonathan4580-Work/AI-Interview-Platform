"use server";

import { createHash, randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/infra/database";
import { AuditWriter, PrismaAuditEventStore } from "@/modules/audit";
import { CandidatePortalService } from "@/modules/candidate-portal";
import { slugify } from "@/modules/organization";

import { requireHrWorkspaceContext } from "./context";

import type { Prisma } from "@prisma/client";

const DEFAULT_REQUIREMENTS = ["Review the role description before the interview."];
const DEFAULT_EXPIRY_HOURS = 72;

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

export async function updateJobAction(formData: FormData): Promise<void> {
  const context = await requireHrWorkspaceContext("jobs:manage");
  const jobId = requiredText(formData, "jobId", 1, 200);
  const title = requiredText(formData, "title", 2, 120);
  const summary = requiredText(formData, "summary", 1, 2_000);
  const details = optionalText(formData, "details", 10_000);
  const job = await prisma.job.update({
    where: { companyId_id: { companyId: context.tenant.companyId, id: jobId } },
    data: {
      title,
      descriptionJson: { summary, details } satisfies Prisma.InputJsonObject,
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
      closedAt: status === "CLOSED" ? new Date() : undefined,
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

export async function sendInvitationAction(formData: FormData): Promise<void> {
  const context = await requireHrWorkspaceContext("invitations:manage");
  const applicationId = requiredText(formData, "applicationId", 1, 200);
  const application = await prisma.candidateApplication.findUnique({
    where: { companyId_id: { companyId: context.tenant.companyId, id: applicationId } },
    include: { candidate: true, job: true },
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

  const invitation = await prisma.candidateInvitation.create({
    data: {
      companyId: context.tenant.companyId,
      candidateId: application.candidateId,
      applicationId: application.id,
      jobId: application.jobId,
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
    after: { id: invitation.id, applicationId: application.id },
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
  const base = slugify(title);
  const digest = createHash("sha256")
    .update(`${companyId}:${title}:${Date.now().toString()}`)
    .digest("hex");
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
