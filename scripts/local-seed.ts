import { stdout as output } from "node:process";

import { PrismaClient } from "@prisma/client";

import { createStagingDemoData } from "./staging-demo-mvp";

function required(name: string, fallback?: string): string {
  const value = process.env[name]?.trim() ?? fallback;
  if (value === undefined || value.length === 0) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

async function main(): Promise<void> {
  if (process.env.APP_ENV !== "development") {
    throw new Error("Local seed requires APP_ENV=development.");
  }

  const prisma = new PrismaClient();
  try {
    const result = await createStagingDemoData(
      {
        companyName: required("LOCAL_DEMO_COMPANY_NAME", "Aptly"),
        companySlug: required("LOCAL_DEMO_COMPANY_SLUG", "aptly-demo"),
        companyAdminEmail: required("LOCAL_DEMO_COMPANY_ADMIN_EMAIL"),
        companyAdminName: required("LOCAL_DEMO_COMPANY_ADMIN_NAME", "Demo Company Admin"),
        companyAdminPassword: required("LOCAL_DEMO_COMPANY_ADMIN_PASSWORD"),
        hrEmail: required("LOCAL_DEMO_HR_EMAIL"),
        hrName: required("LOCAL_DEMO_HR_NAME", "Demo HR User"),
        hrPassword: required("LOCAL_DEMO_HR_PASSWORD"),
      },
      prisma,
    );

    output.write(
      [
        "Local demo data ready.",
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
      ].join("\n"),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown local seed failure.";
  console.error(`Local seed failed: ${message}`);
  process.exitCode = 1;
});
