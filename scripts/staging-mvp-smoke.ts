import { PrismaClient } from "@prisma/client";
import { stdout as output } from "node:process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

interface SmokeCheck {
  readonly name: string;
  readonly status: "passed" | "blocked";
  readonly detail: string;
}

async function runSmoke(): Promise<readonly SmokeCheck[]> {
  if (process.env.APP_ENV !== "staging") {
    throw new Error("Staging MVP smoke requires APP_ENV=staging.");
  }
  const slug = process.env.STAGING_DEMO_COMPANY_SLUG?.trim();
  if (slug === undefined || slug.length === 0) {
    throw new Error("STAGING_DEMO_COMPANY_SLUG is required.");
  }

  const prisma = new PrismaClient();
  try {
    const company = await prisma.company.findUnique({ where: { slug } });
    if (company === null) {
      return [
        {
          name: "Demo workspace",
          status: "blocked",
          detail: "Run npm run staging:demo before the smoke flow.",
        },
      ];
    }
    const [
      users,
      jobs,
      candidates,
      applications,
      invitations,
      interviews,
      transcripts,
      evaluations,
      reports,
    ] = await Promise.all([
      prisma.user.count({ where: { companyId: company.id, status: "ACTIVE" } }),
      prisma.job.count({ where: { companyId: company.id, status: "OPEN" } }),
      prisma.candidate.count({ where: { companyId: company.id, status: "ACTIVE" } }),
      prisma.candidateApplication.count({ where: { companyId: company.id } }),
      prisma.candidateInvitation.count({ where: { companyId: company.id } }),
      prisma.interviewSession.count({ where: { companyId: company.id } }),
      prisma.transcript.count({ where: { companyId: company.id } }),
      prisma.evaluationVersion.count({ where: { companyId: company.id, status: "READY" } }),
      prisma.hrReport.count({ where: { companyId: company.id, status: "READY" } }),
    ]);

    return [
      check("HR login prerequisites", users >= 2, `${String(users)} active company users`),
      check("Job creation", jobs >= 1, `${String(jobs)} open jobs`),
      check("Candidate creation", candidates >= 1, `${String(candidates)} active candidates`),
      check("Application creation", applications >= 1, `${String(applications)} applications`),
      check(
        "Invitation creation",
        invitations >= 1,
        invitations === 0
          ? "Use the HR UI to send the synthetic candidate invitation."
          : `${String(invitations)} invitations`,
      ),
      check(
        "Email delivery mode",
        process.env.EMAIL_DELIVERY_MODE === "preview" || process.env.EMAIL_DELIVERY_MODE === "smtp",
        "EMAIL_DELIVERY_MODE must be preview or smtp.",
      ),
      check(
        "Object storage configuration",
        hasObjectStorageConfig(),
        "Set OBJECT_STORAGE_ENDPOINT, OBJECT_STORAGE_BUCKET, OBJECT_STORAGE_ACCESS_KEY_ID, OBJECT_STORAGE_SECRET_ACCESS_KEY, and OBJECT_STORAGE_SECRET_REF for real recording uploads.",
      ),
      check(
        "Worker process",
        process.env.STAGING_WORKER_SERVICE_ENABLED === "true",
        "Create a Railway worker service from the same image with start command: npm run worker:prod",
      ),
      check(
        "Candidate interview completion",
        interviews >= 1,
        interviews === 0
          ? "Open the secure invitation link and complete consent, readiness, and interview recording."
          : `${String(interviews)} interview sessions`,
      ),
      check("Transcript creation", transcripts >= 1, `${String(transcripts)} transcripts`),
      check("Evaluation creation", evaluations >= 1, `${String(evaluations)} ready evaluations`),
      check("Report creation", reports >= 1, `${String(reports)} ready reports`),
    ];
  } finally {
    await prisma.$disconnect();
  }
}

function check(name: string, passed: boolean, detail: string): SmokeCheck {
  return { name, status: passed ? "passed" : "blocked", detail };
}

function hasObjectStorageConfig(): boolean {
  return [
    process.env.OBJECT_STORAGE_ENDPOINT,
    process.env.OBJECT_STORAGE_BUCKET,
    process.env.OBJECT_STORAGE_ACCESS_KEY_ID,
    process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY,
    process.env.OBJECT_STORAGE_SECRET_REF,
  ].every((value) => value !== undefined && value.trim().length > 0);
}

function render(checks: readonly SmokeCheck[]): string {
  const lines = ["Staging MVP smoke result:"];
  for (const check of checks) {
    lines.push(`${check.status.toUpperCase()}: ${check.name} - ${check.detail}`);
  }
  const blocked = checks.filter((check) => check.status === "blocked");
  lines.push("");
  lines.push(
    blocked.length === 0
      ? "All smoke checks passed."
      : `${String(blocked.length)} checks are blocked.`,
  );
  return `${lines.join("\n")}\n`;
}

async function runCli(): Promise<void> {
  const checks = await runSmoke();
  output.write(render(checks));
  if (checks.some((check) => check.status === "blocked")) {
    process.exitCode = 1;
  }
}

const executedPath = resolve(process.argv[1] ?? "");
if (fileURLToPath(import.meta.url) === executedPath) {
  runCli().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown staging smoke failure.";
    console.error(`Staging MVP smoke failed: ${message}`);
    process.exitCode = 1;
  });
}
