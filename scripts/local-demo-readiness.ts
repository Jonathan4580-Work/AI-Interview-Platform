import { PrismaClient } from "@prisma/client";

import { env } from "@/config";

type ReadinessStatus = "READY" | "ACTION" | "BLOCKED";

interface ReadinessItem {
  readonly status: ReadinessStatus;
  readonly name: string;
  readonly detail: string;
}

const configuredDemoSlug = process.env.LOCAL_DEMO_COMPANY_SLUG?.trim() ?? "";
const demoSlug = configuredDemoSlug.length > 0 ? configuredDemoSlug : "aptly-demo";

async function main(): Promise<void> {
  if (env.APP_ENV !== "development") {
    throw new Error("Local demo readiness requires APP_ENV=development.");
  }

  const prisma = new PrismaClient();
  const items: ReadinessItem[] = [];

  try {
    items.push(await checkDatabase(prisma));
    items.push(...checkEnvironment());
    items.push(...(await checkDemoData(prisma)));
    items.push(...(await checkProcessingState(prisma)));
  } finally {
    await prisma.$disconnect();
  }

  printReport(items);
}

async function checkDatabase(prisma: PrismaClient): Promise<ReadinessItem> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return ready("MySQL", "XAMPP database connection is responding.");
  } catch {
    return blocked("MySQL", "Start XAMPP MySQL and run npm run db:local:migrate.");
  }
}

function checkEnvironment(): ReadinessItem[] {
  const items: ReadinessItem[] = [];
  const requiredSecrets = [
    "LOCAL_DEMO_COMPANY_ADMIN_EMAIL",
    "LOCAL_DEMO_COMPANY_ADMIN_PASSWORD",
    "LOCAL_DEMO_HR_EMAIL",
    "LOCAL_DEMO_HR_PASSWORD",
  ];
  const missingDemoSecrets = requiredSecrets.filter((key) => !hasEnv(key));

  items.push(
    missingDemoSecrets.length === 0
      ? ready("Demo credentials", "Environment-provided demo credentials are present.")
      : action(
          "Demo credentials",
          `Set ${missingDemoSecrets.join(", ")} before npm run db:local:seed.`,
        ),
  );

  items.push(
    env.STORAGE_PROVIDER === "local"
      ? ready("Local storage", "LOCAL_STORAGE_ROOT will store uploads locally.")
      : blocked("Local storage", "Set STORAGE_PROVIDER=local for the XAMPP demo."),
  );

  items.push(
    hasAll(["SMTP_HOST", "SMTP_PORT", "SMTP_USERNAME", "SMTP_PASSWORD", "SMTP_FROM_EMAIL"])
      ? ready("Gmail SMTP", "SMTP configuration is present. Run npm run local:smtp-smoke.")
      : action("Gmail SMTP", "Configure Gmail SMTP values before sending real invitations."),
  );

  items.push(
    env.EVALUATION_PROVIDER === "openai" && Boolean(env.OPENAI_API_KEY)
      ? ready("OpenAI evaluation", `Configured with model ${env.OPENAI_MODEL}.`)
      : action(
          "OpenAI evaluation",
          "Set EVALUATION_PROVIDER=openai and OPENAI_API_KEY, then run npm run local:openai-smoke.",
        ),
  );

  return items;
}

async function checkDemoData(prisma: PrismaClient): Promise<ReadinessItem[]> {
  const company = await prisma.company.findFirst({
    where: { slug: demoSlug },
    select: { id: true, name: true, status: true },
  });

  if (company === null) {
    return [
      action("Demo company", "Run npm run db:local:seed to create the synthetic Aptly workspace."),
      action("Demo HR login", "Run npm run db:local:seed after setting demo credentials."),
      action("Demo role", "Run npm run db:local:seed to create the synthetic open role."),
    ];
  }

  const [users, openJobs, publishedPlans, candidateAccounts, applications] = await Promise.all([
    prisma.user.count({ where: { companyId: company.id, status: "ACTIVE" } }),
    prisma.job.count({ where: { companyId: company.id, status: "OPEN" } }),
    prisma.interviewPlanVersion.count({
      where: { companyId: company.id, status: "PUBLISHED" },
    }),
    prisma.candidateAccount.count({ where: { companyId: company.id } }),
    prisma.candidateApplication.count({ where: { companyId: company.id } }),
  ]);

  return [
    company.status === "ACTIVE"
      ? ready("Demo company", `${company.name} is active. Workspace ID: ${company.id}.`)
      : blocked("Demo company", `${company.name} status is ${company.status}.`),
    users > 0
      ? ready("Demo HR login", `${String(users)} active company user(s) exist.`)
      : action("Demo HR login", "Run npm run db:local:seed to create an HR user."),
    openJobs > 0
      ? ready("Demo role", `${String(openJobs)} open job(s) available.`)
      : action("Demo role", "Create or seed an open published job."),
    publishedPlans > 0
      ? ready("Published interview plan", `${String(publishedPlans)} published plan version(s).`)
      : action("Published interview plan", "Publish an interview plan before sending interviews."),
    candidateAccounts > 0
      ? ready("Candidate portal", `${String(candidateAccounts)} candidate account(s) exist.`)
      : action(
          "Candidate portal",
          "Apply through the public job page to create a candidate account.",
        ),
    applications > 0
      ? ready("Applications", `${String(applications)} application(s) exist.`)
      : action(
          "Applications",
          "Submit a synthetic candidate application from the public apply page.",
        ),
  ];
}

async function checkProcessingState(prisma: PrismaClient): Promise<ReadinessItem[]> {
  const [queuedJobs, processingJobs, failedJobs, latestInterview] = await Promise.all([
    prisma.localJob.count({ where: { status: { in: ["QUEUED", "RETRYING"] } } }),
    prisma.localJob.count({ where: { status: "PROCESSING" } }),
    prisma.localJob.count({ where: { status: "FAILED" } }),
    prisma.interviewSession.findFirst({
      where: { status: { in: ["COMPLETED", "PROCESSING"] } },
      orderBy: [{ completedAt: "desc" }, { updatedAt: "desc" }],
      select: { id: true, companyId: true },
    }),
  ]);

  const items: ReadinessItem[] = [
    failedJobs === 0
      ? ready("Worker failed jobs", "No failed local worker jobs.")
      : action(
          "Worker failed jobs",
          `${String(failedJobs)} failed job(s). Start npm run worker:local and inspect logs.`,
        ),
    queuedJobs === 0 && processingJobs === 0
      ? ready("Worker queue", "No queued or processing local jobs.")
      : action(
          "Worker queue",
          `${String(queuedJobs)} queued/retrying and ${String(processingJobs)} processing. Keep npm run worker:local running.`,
        ),
  ];

  if (latestInterview === null) {
    items.push(action("Completed interview", "Complete a synthetic candidate interview."));
    items.push(
      action("Results", "Run npm run local:full-flow-status after an interview completes."),
    );
    return items;
  }

  const [transcript, evaluation, report] = await Promise.all([
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

  items.push(ready("Completed interview", `Latest completed interview: ${latestInterview.id}.`));
  items.push(
    transcript > 0 && evaluation > 0 && report > 0
      ? ready("Results", "Transcript, OpenAI evaluation, and HR report are ready.")
      : action(
          "Results",
          "Keep npm run worker:local running, then run npm run local:full-flow-status.",
        ),
  );

  return items;
}

function printReport(items: readonly ReadinessItem[]): void {
  console.log("Aptly local demo readiness");
  console.log("==========================");
  for (const item of items) {
    console.log(`${item.status.padEnd(7)} ${item.name} - ${item.detail}`);
  }

  console.log("");
  console.log("Recommended final checks");
  console.log("- npm run local:storage-smoke");
  console.log("- npm run local:smtp-smoke");
  console.log("- npm run local:openai-smoke");
  console.log("- npm run local:full-flow-status");
  console.log("");
  console.log("Demo routes");
  console.log("- Public landing: http://localhost:3000/");
  console.log(`- Careers page: http://localhost:3000/careers/${demoSlug}`);
  console.log("- HR login: http://localhost:3000/login");
  console.log("- Candidate dashboard: http://localhost:3000/candidate");
}

function hasAll(keys: readonly string[]): boolean {
  return keys.every(hasEnv);
}

function hasEnv(key: string): boolean {
  return (process.env[key]?.trim() ?? "").length > 0;
}

function ready(name: string, detail: string): ReadinessItem {
  return { status: "READY", name, detail };
}

function action(name: string, detail: string): ReadinessItem {
  return { status: "ACTION", name, detail };
}

function blocked(name: string, detail: string): ReadinessItem {
  return { status: "BLOCKED", name, detail };
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown local demo readiness failure.";
  console.error(`Local demo readiness failed: ${message}`);
  process.exitCode = 1;
});
