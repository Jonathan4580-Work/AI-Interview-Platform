import { PrismaClient, type Prisma } from "@prisma/client";
import { stdout as output } from "node:process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { hashPassword } from "../src/modules/auth/password";
import { permissionKeys, type PermissionKey } from "../src/modules/access-control/types";
import { slugify } from "../src/modules/organization";

const hrPermissions: readonly PermissionKey[] = [
  "tenant:read",
  "jobs:read",
  "jobs:manage",
  "pipelines:read",
  "interview_plans:read",
  "interview_plans:manage",
  "candidates:read",
  "candidates:manage",
  "applications:read",
  "applications:manage",
  "invitations:read",
  "invitations:manage",
  "interviews:read",
  "candidate_readiness:read",
  "monitoring_events:read",
  "transcripts:read",
  "evaluations:read",
  "reports:read",
  "search:workspace",
  "exports:read",
];

interface DemoInput {
  readonly companyName: string;
  readonly companySlug: string;
  readonly companyAdminEmail: string;
  readonly companyAdminName: string;
  readonly companyAdminPassword: string;
  readonly hrEmail: string;
  readonly hrName: string;
  readonly hrPassword: string;
}

interface DemoResult {
  readonly companyId: string;
  readonly companySlug: string;
  readonly companyAdminEmail: string;
  readonly hrEmail: string;
  readonly jobId: string;
  readonly interviewPlanVersionId: string;
  readonly candidateId: string;
  readonly applicationId: string;
}

export async function createStagingDemoData(
  input: DemoInput,
  prisma = new PrismaClient(),
): Promise<DemoResult> {
  const normalized = normalizeInput(input);
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const company = await tx.company.upsert({
      where: { slug: normalized.companySlug },
      update: { name: normalized.companyName, status: "ACTIVE" },
      create: {
        name: normalized.companyName,
        slug: normalized.companySlug,
        status: "ACTIVE",
      },
    });

    await tx.permission.createMany({
      data: permissionKeys.map((key) => ({
        key,
        description: `System permission: ${key}`,
      })),
      skipDuplicates: true,
    });

    const companyAdminRole = await upsertRole(tx, company.id, "company_admin", "Company Admin");
    const hrRole = await upsertRole(tx, company.id, "hr", "HR");
    await grantPermissions(tx, companyAdminRole.id, [...permissionKeys]);
    await grantPermissions(tx, hrRole.id, hrPermissions);

    const companyAdmin = await upsertCompanyUser(tx, {
      companyId: company.id,
      email: normalized.companyAdminEmail,
      name: normalized.companyAdminName,
      password: normalized.companyAdminPassword,
      roleId: companyAdminRole.id,
      now,
    });
    const hrUser = await upsertCompanyUser(tx, {
      companyId: company.id,
      email: normalized.hrEmail,
      name: normalized.hrName,
      password: normalized.hrPassword,
      roleId: hrRole.id,
      now,
    });

    const pipeline = await tx.hiringPipeline.upsert({
      where: { companyId_slug: { companyId: company.id, slug: "demo-hiring-pipeline" } },
      update: { status: "ACTIVE" },
      create: {
        companyId: company.id,
        name: "Demo hiring pipeline",
        slug: "demo-hiring-pipeline",
        description: "Synthetic staging hiring flow.",
      },
    });
    await ensureStage(
      tx,
      company.id,
      pipeline.id,
      "Application review",
      "application-review",
      "APPLICATION_REVIEW",
      1,
    );
    const interviewStage = await ensureStage(
      tx,
      company.id,
      pipeline.id,
      "Interview",
      "interview",
      "INTERVIEW",
      2,
    );
    await ensureStage(tx, company.id, pipeline.id, "Offer", "offer", "OFFER", 3);
    await ensureStage(tx, company.id, pipeline.id, "Hired", "hired", "HIRED", 4, true);
    await ensureStage(tx, company.id, pipeline.id, "Rejected", "rejected", "REJECTED", 5, true);

    const job = await tx.job.upsert({
      where: { companyId_slug: { companyId: company.id, slug: "demo-customer-success-manager" } },
      update: { status: "OPEN", openedAt: now },
      create: {
        companyId: company.id,
        pipelineId: pipeline.id,
        title: "Demo Customer Success Manager",
        slug: "demo-customer-success-manager",
        descriptionJson: {
          summary: "Synthetic staging role for validating the HR interview workflow.",
        },
        requirementsJson: { items: ["Synthetic staging data only."] },
        employmentType: "FULL_TIME",
        workplaceType: "REMOTE",
        seniorityLevel: "MID",
        status: "OPEN",
        openedAt: now,
      },
    });

    const existingPlan = await tx.interviewPlan.findFirst({
      where: { companyId: company.id, jobId: job.id, name: "Demo interview plan", deletedAt: null },
    });
    const plan =
      existingPlan ??
      (await tx.interviewPlan.create({
        data: {
          companyId: company.id,
          jobId: job.id,
          name: "Demo interview plan",
          status: "ACTIVE",
        },
      }));
    if (existingPlan !== null && existingPlan.status !== "ACTIVE") {
      await tx.interviewPlan.update({
        where: { companyId_id: { companyId: company.id, id: existingPlan.id } },
        data: { status: "ACTIVE" },
      });
    }
    const version = await tx.interviewPlanVersion.upsert({
      where: {
        companyId_interviewPlanId_versionNumber: {
          companyId: company.id,
          interviewPlanId: plan.id,
          versionNumber: 1,
        },
      },
      update: { status: "PUBLISHED", publishedAt: now },
      create: {
        companyId: company.id,
        interviewPlanId: plan.id,
        versionNumber: 1,
        status: "PUBLISHED",
        competencyJson: {
          schemaVersion: 1,
          competencies: [
            { key: "communication", label: "Communication", maxScore: 5 },
            { key: "problem_solving", label: "Problem solving", maxScore: 5 },
            { key: "role_relevance", label: "Role relevance", maxScore: 5 },
          ],
        },
        questionBlueprintJson: [
          {
            key: "q1",
            kind: "opening",
            sequence: 1,
            prompt: "Please introduce yourself and summarize your customer-facing experience.",
            required: true,
          },
          {
            key: "q2",
            kind: "main",
            sequence: 2,
            prompt: "Tell us about a customer problem you resolved and how you approached it.",
            required: true,
          },
          {
            key: "q3",
            kind: "main",
            sequence: 3,
            prompt: "How do you prioritize competing requests from multiple customers?",
            required: true,
          },
          {
            key: "q4",
            kind: "closing",
            sequence: 4,
            prompt: "What would help you be successful in this role?",
            required: true,
          },
        ],
        durationMinutes: 30,
        publishedAt: now,
      },
    });
    await tx.interviewPlan.update({
      where: { companyId_id: { companyId: company.id, id: plan.id } },
      data: { activeVersionId: version.id },
    });

    const candidateEmail = `candidate+${normalized.companySlug}@example.invalid`;
    const candidate = await tx.candidate.upsert({
      where: {
        companyId_normalizedEmail: { companyId: company.id, normalizedEmail: candidateEmail },
      },
      update: { status: "ACTIVE" },
      create: {
        companyId: company.id,
        fullName: "Synthetic Demo Candidate",
        primaryEmail: candidateEmail,
        normalizedEmail: candidateEmail,
        sourceType: "MANUAL",
        sourceLabel: "Staging demo",
        profileJson: {},
      },
    });

    const application = await tx.candidateApplication.upsert({
      where: {
        companyId_candidateId_jobId: {
          companyId: company.id,
          candidateId: candidate.id,
          jobId: job.id,
        },
      },
      update: { currentStageId: interviewStage.id, status: "INTERVIEW" },
      create: {
        companyId: company.id,
        candidateId: candidate.id,
        jobId: job.id,
        currentStageId: interviewStage.id,
        status: "INTERVIEW",
        metadataJson: { source: "staging_demo" },
      },
    });

    return {
      companyId: company.id,
      companySlug: company.slug,
      companyAdminEmail: companyAdmin.email,
      hrEmail: hrUser.email,
      jobId: job.id,
      interviewPlanVersionId: version.id,
      candidateId: candidate.id,
      applicationId: application.id,
    };
  });
}

function loadInputFromEnv(source: NodeJS.ProcessEnv): DemoInput {
  return {
    companyName: required(source, "STAGING_DEMO_COMPANY_NAME"),
    companySlug: normalizeSlug(required(source, "STAGING_DEMO_COMPANY_SLUG")),
    companyAdminEmail: normalizeEmail(required(source, "STAGING_DEMO_COMPANY_ADMIN_EMAIL")),
    companyAdminName: required(source, "STAGING_DEMO_COMPANY_ADMIN_NAME"),
    companyAdminPassword: required(source, "STAGING_DEMO_COMPANY_ADMIN_PASSWORD"),
    hrEmail: normalizeEmail(required(source, "STAGING_DEMO_HR_EMAIL")),
    hrName: required(source, "STAGING_DEMO_HR_NAME"),
    hrPassword: required(source, "STAGING_DEMO_HR_PASSWORD"),
  };
}

function normalizeInput(input: DemoInput): DemoInput {
  return {
    ...input,
    companySlug: normalizeSlug(input.companySlug),
    companyAdminEmail: normalizeEmail(input.companyAdminEmail),
    hrEmail: normalizeEmail(input.hrEmail),
  };
}

async function upsertRole(tx: PrismaTransaction, companyId: string, key: string, name: string) {
  return tx.role.upsert({
    where: { companyId_key: { companyId, key } },
    update: { name, description: `${name} role for staging MVP.`, isSystem: true },
    create: { companyId, key, name, description: `${name} role for staging MVP.`, isSystem: true },
  });
}

async function grantPermissions(
  tx: PrismaTransaction,
  roleId: string,
  keys: readonly PermissionKey[],
): Promise<void> {
  const permissions = await tx.permission.findMany({
    where: { key: { in: [...keys] } },
    select: { id: true },
  });
  await tx.rolePermission.createMany({
    data: permissions.map((permission) => ({ roleId, permissionId: permission.id })),
    skipDuplicates: true,
  });
}

async function upsertCompanyUser(
  tx: PrismaTransaction,
  input: {
    readonly companyId: string;
    readonly email: string;
    readonly name: string;
    readonly password: string;
    readonly roleId: string;
    readonly now: Date;
  },
) {
  const user = await tx.user.upsert({
    where: { companyId_email: { companyId: input.companyId, email: input.email } },
    update: { name: input.name, status: "ACTIVE", deletedAt: null },
    create: { companyId: input.companyId, email: input.email, name: input.name, status: "ACTIVE" },
  });
  const credential = await tx.authCredential.findUnique({
    where: { companyId_userId: { companyId: input.companyId, userId: user.id } },
  });
  if (credential === null) {
    await tx.authCredential.create({
      data: {
        subjectType: "USER",
        companyId: input.companyId,
        userId: user.id,
        passwordHash: hashPassword(input.password),
        emailVerifiedAt: input.now,
        passwordUpdatedAt: input.now,
      },
    });
  }
  await tx.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: input.roleId } },
    update: { companyId: input.companyId },
    create: { companyId: input.companyId, userId: user.id, roleId: input.roleId },
  });
  return user;
}

async function ensureStage(
  tx: PrismaTransaction,
  companyId: string,
  pipelineId: string,
  name: string,
  slug: string,
  category: "APPLICATION_REVIEW" | "INTERVIEW" | "OFFER" | "HIRED" | "REJECTED",
  position: number,
  isTerminal = false,
) {
  return tx.pipelineStage.upsert({
    where: { companyId_pipelineId_slug: { companyId, pipelineId, slug } },
    update: { name, category, position, isTerminal, status: "ACTIVE" },
    create: { companyId, pipelineId, name, slug, category, position, isTerminal },
  });
}

function required(source: NodeJS.ProcessEnv, name: string): string {
  const value = source[name]?.trim();
  if (value === undefined || value.length === 0) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function normalizeEmail(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(normalized)) {
    throw new Error("Demo user emails must be valid.");
  }
  return normalized;
}

function normalizeSlug(value: string): string {
  const normalized = slugify(value);
  if (normalized.length === 0) {
    throw new Error("STAGING_DEMO_COMPANY_SLUG is invalid.");
  }
  return normalized;
}

function renderResult(result: DemoResult): string {
  return [
    "Staging MVP demo data ready.",
    `Company Workspace ID: ${result.companyId}`,
    `Company slug: ${result.companySlug}`,
    `Company Admin email: ${result.companyAdminEmail}`,
    `HR email: ${result.hrEmail}`,
    `Job ID: ${result.jobId}`,
    `Interview Plan Version ID: ${result.interviewPlanVersionId}`,
    `Candidate ID: ${result.candidateId}`,
    `Application ID: ${result.applicationId}`,
    "",
    "Company login: choose Company and enter the printed Workspace ID.",
    "Passwords were read from environment variables and were not printed.",
    "",
  ].join("\n");
}

async function runCli(): Promise<void> {
  if (process.env.APP_ENV !== "staging") {
    throw new Error("Staging demo setup requires APP_ENV=staging.");
  }
  const prisma = new PrismaClient();
  try {
    const result = await createStagingDemoData(loadInputFromEnv(process.env), prisma);
    output.write(renderResult(result));
  } finally {
    await prisma.$disconnect();
  }
}

type PrismaTransaction = Prisma.TransactionClient;

const executedPath = resolve(process.argv[1] ?? "");
if (fileURLToPath(import.meta.url) === executedPath) {
  runCli().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown staging demo failure.";
    console.error(`Staging demo setup failed: ${message}`);
    process.exitCode = 1;
  });
}
