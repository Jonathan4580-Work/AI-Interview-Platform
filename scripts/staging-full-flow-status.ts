import { PrismaClient } from "@prisma/client";
import { Redis } from "ioredis";
import { stdout as output } from "node:process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { env } from "../src/config/env";

type Status = "PASSED" | "BLOCKED" | "FAILED";

interface CheckResult {
  readonly name: string;
  readonly status: Status;
  readonly detail: string;
}

function assertStagingOnly(): void {
  if (process.env.APP_ENV !== "staging") {
    throw new Error("Full-flow status requires APP_ENV=staging.");
  }
}

async function run(): Promise<void> {
  assertStagingOnly();
  const prisma = new PrismaClient();
  const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: true });
  const checks: CheckResult[] = [];

  try {
    checks.push(check("web configuration", env.APP_URL.startsWith("https://"), env.APP_URL));
    checks.push(
      check(
        "worker configuration",
        process.env.STAGING_WORKER_SERVICE_ENABLED === "true",
        "STAGING_WORKER_SERVICE_ENABLED=true",
      ),
    );

    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.push({
        name: "database connectivity",
        status: "PASSED",
        detail: "PostgreSQL reachable",
      });
    } catch {
      checks.push({
        name: "database connectivity",
        status: "FAILED",
        detail: "PostgreSQL query failed",
      });
    }

    try {
      await redis.connect();
      await redis.ping();
      checks.push({ name: "Redis connectivity", status: "PASSED", detail: "Redis ping succeeded" });
    } catch {
      checks.push({ name: "Redis connectivity", status: "FAILED", detail: "Redis ping failed" });
    }

    checks.push(
      check(
        "object storage configuration",
        env.OBJECT_STORAGE_BUCKET.length > 0 && env.OBJECT_STORAGE_ENDPOINT.startsWith("http"),
        env.OBJECT_STORAGE_BUCKET,
      ),
    );
    checks.push(
      check("SMTP configuration", env.EMAIL_DELIVERY_MODE === "smtp", env.EMAIL_DELIVERY_MODE),
    );
    checks.push(
      check(
        "OpenAI configuration",
        env.EVALUATION_PROVIDER === "openai" && env.OPENAI_API_KEY !== undefined,
        `${env.EVALUATION_PROVIDER}:${env.OPENAI_MODEL}`,
      ),
    );

    const companySlug = process.env.STAGING_DEMO_COMPANY_SLUG?.trim();
    const company =
      companySlug === undefined || companySlug.length === 0
        ? null
        : await prisma.company.findUnique({ where: { slug: companySlug } });
    checks.push(recordCheck("company active", company, company?.status === "ACTIVE"));

    const companyId = company?.id ?? null;
    const [companyAdmin, hrUser, job, plan, candidate, application, invitation] =
      companyId === null
        ? [null, null, null, null, null, null, null]
        : await Promise.all([
            findUser(prisma, companyId, process.env.STAGING_DEMO_COMPANY_ADMIN_EMAIL),
            findUser(prisma, companyId, process.env.STAGING_DEMO_HR_EMAIL),
            prisma.job.findFirst({
              where: { companyId, status: "OPEN" },
              orderBy: { createdAt: "desc" },
            }),
            prisma.interviewPlanVersion.findFirst({
              where: { companyId, status: "PUBLISHED" },
              orderBy: { publishedAt: "desc" },
            }),
            prisma.candidate.findFirst({
              where: { companyId, status: "ACTIVE" },
              orderBy: { createdAt: "desc" },
            }),
            prisma.candidateApplication.findFirst({
              where: { companyId, status: { not: "WITHDRAWN" } },
              orderBy: { createdAt: "desc" },
            }),
            prisma.candidateInvitation.findFirst({
              where: { companyId },
              orderBy: { createdAt: "desc" },
            }),
          ]);

    checks.push(
      recordCheck("Company Admin active", companyAdmin, companyAdmin?.status === "ACTIVE"),
    );
    checks.push(recordCheck("HR active", hrUser, hrUser?.status === "ACTIVE"));
    checks.push(recordCheck("job active", job, job?.status === "OPEN"));
    checks.push(recordCheck("interview plan published", plan, plan?.status === "PUBLISHED"));
    checks.push(recordCheck("candidate active", candidate, candidate?.status === "ACTIVE"));
    checks.push(recordCheck("application active", application, application !== null));
    checks.push(recordCheck("invitation created", invitation, invitation !== null));
    checks.push(
      recordCheck(
        "invitation expiry valid",
        invitation,
        invitation !== null && invitation.expiresAt.getTime() > Date.now(),
      ),
    );
    checks.push(
      recordCheck(
        "invitation link accessible",
        invitation,
        invitation !== null &&
          ["QUEUED", "SENT", "OPENED"].includes(invitation.status) &&
          invitation.tokenRevokedAt === null &&
          invitation.expiresAt.getTime() > Date.now(),
      ),
    );

    const delivery =
      companyId === null || invitation === null
        ? null
        : await prisma.emailDelivery.findFirst({
            where: {
              companyId,
              templateKey: "INTERVIEW_INVITATION",
              idempotencyKey: { contains: invitation.id },
            },
            orderBy: { createdAt: "desc" },
          });
    checks.push(recordCheck("email queued", delivery, delivery !== null));
    checks.push(recordCheck("email sent", delivery, delivery?.status === "SENT"));
    checks.push(recordCheck("invitation opened", invitation, invitation?.openedAt !== null));

    const candidateSession =
      companyId === null || invitation === null
        ? null
        : await prisma.candidateSession.findFirst({
            where: { companyId, invitationId: invitation.id },
            orderBy: { createdAt: "desc" },
          });
    checks.push(
      recordCheck("candidate exchange authenticated", candidateSession, candidateSession !== null),
    );
    checks.push(
      recordCheck(
        "candidate session valid",
        candidateSession,
        candidateSession?.status === "ACTIVE",
      ),
    );

    checks.push(await countCheck(prisma, "consent completed", companyId, "candidateConsentRecord"));
    checks.push(await countCheck(prisma, "readiness completed", companyId, "readinessCheck"));

    const interview =
      companyId === null || invitation === null
        ? null
        : await prisma.interviewSession.findFirst({
            where: { companyId, invitationId: invitation.id },
            orderBy: { createdAt: "desc" },
          });
    checks.push(recordCheck("interview started", interview, interview !== null));
    checks.push(await countCheck(prisma, "recording uploaded", companyId, "interviewTurnMedia"));
    checks.push(
      recordCheck(
        "interview completed",
        interview,
        interview?.status === "COMPLETED" || interview?.status === "PROCESSING",
      ),
    );
    checks.push(await countCheck(prisma, "transcript ready", companyId, "transcriptVersion"));
    checks.push(
      await countCheck(prisma, "OpenAI evaluation ready", companyId, "evaluationVersion"),
    );
    checks.push(await countCheck(prisma, "report ready", companyId, "hrReportVersion"));

    output.write(renderChecks(checks));
    if (checks.some((item) => item.status === "FAILED")) {
      process.exitCode = 1;
    }
  } finally {
    await redis.quit().catch(() => undefined);
    await prisma.$disconnect();
  }
}

async function findUser(prisma: PrismaClient, companyId: string, email: string | undefined) {
  const normalized = email?.trim().toLowerCase();
  if (normalized === undefined || normalized.length === 0) return null;
  return prisma.user.findUnique({ where: { companyId_email: { companyId, email: normalized } } });
}

async function countCheck(
  prisma: PrismaClient,
  name: string,
  companyId: string | null,
  model:
    | "candidateConsentRecord"
    | "readinessCheck"
    | "interviewTurnMedia"
    | "transcriptVersion"
    | "evaluationVersion"
    | "hrReportVersion",
): Promise<CheckResult> {
  if (companyId === null) {
    return { name, status: "BLOCKED", detail: "company not found" };
  }
  const count = await countCompanyRecords(prisma, model, companyId);
  return { name, status: count > 0 ? "PASSED" : "BLOCKED", detail: `${String(count)} records` };
}

async function countCompanyRecords(
  prisma: PrismaClient,
  model:
    | "candidateConsentRecord"
    | "readinessCheck"
    | "interviewTurnMedia"
    | "transcriptVersion"
    | "evaluationVersion"
    | "hrReportVersion",
  companyId: string,
): Promise<number> {
  switch (model) {
    case "candidateConsentRecord":
      return prisma.candidateConsentRecord.count({ where: { companyId } });
    case "readinessCheck":
      return prisma.readinessCheck.count({ where: { companyId } });
    case "interviewTurnMedia":
      return prisma.interviewTurnMedia.count({ where: { companyId } });
    case "transcriptVersion":
      return prisma.transcriptVersion.count({ where: { companyId } });
    case "evaluationVersion":
      return prisma.evaluationVersion.count({ where: { companyId } });
    case "hrReportVersion":
      return prisma.hrReportVersion.count({ where: { companyId } });
  }
}

function check(name: string, passed: boolean, detail: string): CheckResult {
  return { name, status: passed ? "PASSED" : "BLOCKED", detail };
}

function recordCheck(name: string, record: unknown, passed: boolean): CheckResult {
  if (record === null) {
    return { name, status: "BLOCKED", detail: "record not found" };
  }
  return { name, status: passed ? "PASSED" : "BLOCKED", detail: passed ? "ready" : "not ready" };
}

function renderChecks(checks: readonly CheckResult[]): string {
  return `${checks.map((item) => `${item.status.padEnd(7)} ${item.name} - ${item.detail}`).join("\n")}\n`;
}

const executedPath = resolve(process.argv[1] ?? "");
if (fileURLToPath(import.meta.url) === executedPath) {
  run().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown full-flow status failure.";
    console.error(`Full-flow status FAILED: ${message}`);
    process.exitCode = 1;
  });
}
