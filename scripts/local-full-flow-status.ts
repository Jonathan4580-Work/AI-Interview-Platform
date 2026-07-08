import { PrismaClient } from "@prisma/client";

import { env } from "@/config";
import { LocalFilesystemStorageProvider } from "@/modules/media";

type Status = "PASSED" | "BLOCKED" | "FAILED";

interface CheckResult {
  readonly name: string;
  readonly status: Status;
  readonly detail: string;
}

async function main(): Promise<void> {
  if (env.APP_ENV !== "development") {
    throw new Error("Local full-flow status requires APP_ENV=development.");
  }

  const prisma = new PrismaClient();
  const checks: CheckResult[] = [];
  try {
    checks.push(await checkMySql(prisma));
    checks.push(await checkStorage());
    checks.push(checkSmtpConfiguration());
    checks.push(checkOpenAiConfiguration());
    checks.push(await checkWorkerHeartbeat(prisma));
    checks.push(...(await checkDomainData(prisma)));
    checks.push(...(await checkFlowArtifacts(prisma)));
  } finally {
    await prisma.$disconnect();
  }

  for (const check of checks) {
    console.log(`${check.status.padEnd(7)} ${check.name} - ${check.detail}`);
  }

  if (checks.some((check) => check.status === "FAILED")) {
    process.exitCode = 1;
  }
}

async function checkMySql(prisma: PrismaClient): Promise<CheckResult> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return pass("MySQL connectivity", "database responded");
  } catch {
    return fail("MySQL connectivity", "database did not respond");
  }
}

async function checkStorage(): Promise<CheckResult> {
  try {
    const provider = new LocalFilesystemStorageProvider();
    await provider.verifyObject("status/nonexistent.txt");
    return pass("local storage", `provider ${provider.providerKey} ready`);
  } catch {
    return fail("local storage", "local storage provider failed to initialize");
  }
}

function checkSmtpConfiguration(): CheckResult {
  const missing = [
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_USERNAME",
    "SMTP_PASSWORD",
    "SMTP_FROM_EMAIL",
  ].filter((name) => (process.env[name]?.trim() ?? "").length === 0);
  return missing.length === 0
    ? pass("SMTP configuration", "configured")
    : block("SMTP configuration", `missing ${missing.join(", ")}`);
}

function checkOpenAiConfiguration(): CheckResult {
  if (env.EVALUATION_PROVIDER !== "openai") {
    return block(
      "OpenAI configuration",
      "EVALUATION_PROVIDER must be openai for the local AI demo",
    );
  }
  if (!env.OPENAI_API_KEY) {
    return block("OpenAI configuration", "OPENAI_API_KEY is missing");
  }
  return pass("OpenAI configuration", `model ${env.OPENAI_MODEL}`);
}

async function checkWorkerHeartbeat(prisma: PrismaClient): Promise<CheckResult> {
  const processing = await prisma.localJob.count({ where: { status: "PROCESSING" } });
  const queued = await prisma.localJob.count({ where: { status: { in: ["QUEUED", "RETRYING"] } } });
  return pass("local worker queue", `${String(processing)} processing, ${String(queued)} queued`);
}

async function checkDomainData(prisma: PrismaClient): Promise<CheckResult[]> {
  const company = await prisma.company.findFirst({
    where: { slug: process.env.LOCAL_DEMO_COMPANY_SLUG ?? "aptly-demo" },
    select: { id: true, status: true },
  });
  if (company === null) {
    return [
      block("company active", "run npm run db:local:seed"),
      block("HR active", "run npm run db:local:seed"),
      block("job active", "run npm run db:local:seed"),
      block("interview plan published", "run npm run db:local:seed"),
      block("candidate active", "run npm run db:local:seed"),
      block("application active", "run npm run db:local:seed"),
    ];
  }

  const [hr, job, planVersion, candidate, application] = await Promise.all([
    prisma.user.count({ where: { companyId: company.id, status: "ACTIVE" } }),
    prisma.job.count({ where: { companyId: company.id, status: "OPEN" } }),
    prisma.interviewPlanVersion.count({ where: { companyId: company.id, status: "PUBLISHED" } }),
    prisma.candidate.count({ where: { companyId: company.id, status: "ACTIVE" } }),
    prisma.candidateApplication.count({ where: { companyId: company.id } }),
  ]);

  return [
    company.status === "ACTIVE"
      ? pass("company active", company.id)
      : block("company active", `status ${company.status}`),
    hr > 0
      ? pass("HR active", `${String(hr)} active users`)
      : block("HR active", "no active users"),
    job > 0 ? pass("job active", `${String(job)} open jobs`) : block("job active", "no open jobs"),
    planVersion > 0
      ? pass("interview plan published", `${String(planVersion)} published versions`)
      : block("interview plan published", "no published plan versions"),
    candidate > 0
      ? pass("candidate active", `${String(candidate)} active candidates`)
      : block("candidate active", "no active candidates"),
    application > 0
      ? pass("application active", `${String(application)} applications`)
      : block("application active", "no applications"),
  ];
}

async function checkFlowArtifacts(prisma: PrismaClient): Promise<CheckResult[]> {
  const [validInvitation, sentEmail, openedInvitation, activeSession, consent, readiness, started] =
    await Promise.all([
      prisma.candidateInvitation.count({
        where: {
          status: { in: ["SENT", "OPENED", "ACCEPTED"] },
          expiresAt: { gt: new Date() },
          tokenRevokedAt: null,
          cancelledAt: null,
        },
      }),
      prisma.emailDelivery.count({ where: { status: "SENT" } }),
      prisma.candidateInvitation.count({ where: { status: { in: ["OPENED", "ACCEPTED"] } } }),
      prisma.candidateSession.count({ where: { revokedAt: null, expiresAt: { gt: new Date() } } }),
      prisma.candidateConsentRecord.count(),
      prisma.readinessCheck.count(),
      prisma.interviewSession.count({
        where: {
          status: {
            in: ["IN_PROGRESS", "INTERRUPTED", "UPLOAD_RECOVERY", "COMPLETED", "PROCESSING"],
          },
        },
      }),
    ]);

  const latestInterview = await prisma.interviewSession.findFirst({
    where: { status: { in: ["COMPLETED", "PROCESSING"] } },
    select: { id: true, companyId: true, completedAt: true, updatedAt: true },
    orderBy: [{ completedAt: "desc" }, { updatedAt: "desc" }],
  });

  const [recording, transcript, evaluation, report] =
    latestInterview === null
      ? [0, 0, 0, 0]
      : await Promise.all([
          prisma.interviewTurnMedia.count({
            where: {
              companyId: latestInterview.companyId,
              interviewSessionId: latestInterview.id,
              status: "VERIFIED",
              mediaObject: {
                purpose: "INTERVIEW_RECORDING",
                uploadStatus: "COMPLETED",
              },
            },
          }),
          prisma.transcript.count({
            where: {
              companyId: latestInterview.companyId,
              interviewSessionId: latestInterview.id,
              status: "READY",
            },
          }),
          prisma.evaluationRun.count({
            where: {
              companyId: latestInterview.companyId,
              interviewSessionId: latestInterview.id,
              status: "READY",
            },
          }),
          prisma.hrReport.count({
            where: {
              companyId: latestInterview.companyId,
              interviewSessionId: latestInterview.id,
              status: "READY",
            },
          }),
        ]);

  const latestDetail =
    latestInterview === null
      ? "no latest completed interview"
      : `latest interview ${latestInterview.id}`;

  return [
    validInvitation > 0
      ? pass("invitation valid", "active invitation exists")
      : block("invitation valid", "no active invitation"),
    sentEmail > 0
      ? pass("email sent", "sent delivery exists")
      : block("email sent", "no sent email delivery"),
    openedInvitation > 0
      ? pass("invitation opened", "candidate has opened an invitation")
      : block("invitation opened", "not opened yet"),
    activeSession > 0
      ? pass("candidate session valid", "active session exists")
      : block("candidate session valid", "no active session"),
    consent > 0
      ? pass("consent completed", "consent recorded")
      : block("consent completed", "no consent record"),
    readiness > 0
      ? pass("readiness completed", "readiness recorded")
      : block("readiness completed", "no readiness record"),
    started > 0
      ? pass("interview started", "interview session started")
      : block("interview started", "no started interview"),
    recording > 0
      ? pass("recording uploaded", `verified recording media exists for ${latestDetail}`)
      : block("recording uploaded", `no verified recording for ${latestDetail}`),
    latestInterview !== null
      ? pass("interview completed", latestDetail)
      : block("interview completed", "no completed interview"),
    transcript > 0
      ? pass("transcript ready", `ready transcript exists for ${latestDetail}`)
      : block("transcript ready", `no ready transcript for ${latestDetail}`),
    evaluation > 0
      ? pass("OpenAI evaluation ready", `completed evaluation exists for ${latestDetail}`)
      : block("OpenAI evaluation ready", `no completed evaluation for ${latestDetail}`),
    report > 0
      ? pass("report ready", `ready report exists for ${latestDetail}`)
      : block("report ready", `no ready report for ${latestDetail}`),
  ];
}

function pass(name: string, detail: string): CheckResult {
  return { name, status: "PASSED", detail };
}

function block(name: string, detail: string): CheckResult {
  return { name, status: "BLOCKED", detail };
}

function fail(name: string, detail: string): CheckResult {
  return { name, status: "FAILED", detail };
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown local status failure.";
  console.error(`Local full-flow status failed: ${message}`);
  process.exitCode = 1;
});
