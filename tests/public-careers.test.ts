import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("public careers marketplace foundation", () => {
  it("adds public company careers and job detail routes", () => {
    const careersPage = source("src/app/careers/[companySlug]/page.tsx");
    const jobPage = source("src/app/careers/[companySlug]/jobs/[jobSlug]/page.tsx");
    const applyPage = source("src/app/careers/[companySlug]/jobs/[jobSlug]/apply/page.tsx");

    expect(careersPage).toContain("Open roles");
    expect(careersPage).toContain("View job");
    expect(jobPage).toContain("Role overview");
    expect(jobPage).toContain("Responsibilities");
    expect(jobPage).toContain("Nice-to-have skills");
    expect(applyPage).toContain("Create candidate account");
    expect(applyPage).toContain("Submit application");
  });

  it("uses a theme-safe public hero for careers surfaces", () => {
    const careersPage = source("src/app/careers/[companySlug]/page.tsx");
    const jobPage = source("src/app/careers/[companySlug]/jobs/[jobSlug]/page.tsx");
    const applyPage = source("src/app/careers/[companySlug]/jobs/[jobSlug]/apply/page.tsx");
    const recruitingUi = source("src/components/recruiting/recruiting-ui.tsx");

    expect(careersPage).toContain("PublicHero");
    expect(jobPage).toContain("PublicHero");
    expect(applyPage).toContain("PublicHero");
    expect(careersPage).not.toContain("text-white hover:bg-white/15");
    expect(recruitingUi).toContain("text-card-foreground");
    expect(recruitingUi).toContain("text-foreground");
    expect(recruitingUi).toContain("text-muted-foreground");
  });

  it("keeps public listings limited to published open jobs", () => {
    const queries = source("src/server/public-careers/queries.ts");

    expect(queries).toContain('status: "OPEN"');
    expect(queries).toContain("deletedAt: null");
    expect(queries).toContain('intelligenceProfile: { is: { status: "PUBLISHED"');
    expect(queries).not.toContain('status: { in: ["OPEN"');
  });

  it("returns not found for unknown companies and unpublished jobs", () => {
    const careersPage = source("src/app/careers/[companySlug]/page.tsx");
    const jobPage = source("src/app/careers/[companySlug]/jobs/[jobSlug]/page.tsx");
    const queries = source("src/server/public-careers/queries.ts");

    expect(careersPage).toContain("notFound()");
    expect(jobPage).toContain("notFound()");
    expect(queries).toContain("if (job?.intelligenceProfile == null)");
    expect(queries).toContain("return null");
  });

  it("shows the HR public posting link only when published and open", () => {
    const page = source("src/app/(workspace)/jobs/[jobId]/page.tsx");
    const queries = source("src/server/hr-workspace/queries.ts");

    expect(page).toContain('job.status === "OPEN"');
    expect(page).toContain('job.intelligenceProfile?.status === "PUBLISHED"');
    expect(page).toContain("View public job posting");
    expect(queries).toContain("company: { select: { name: true, slug: true } }");
  });

  it("keeps the aptly-demo URL while removing demo display branding from core pages", () => {
    const landingPage = source("src/app/page.tsx");
    const localSeed = source("scripts/local-seed.ts");
    const careersPage = source("src/app/careers/[companySlug]/page.tsx");
    const candidateHome = source("src/app/candidate/page.tsx");
    const dashboardPage = source("src/app/(workspace)/dashboard/page.tsx");

    expect(landingPage).toContain('href="/careers/aptly-demo"');
    expect(landingPage).toContain("View careers page");
    expect(landingPage).not.toContain("View demo careers page");
    expect(landingPage).not.toContain("Demo careers");
    expect(localSeed).toContain('required("LOCAL_DEMO_COMPANY_NAME", "Aptly")');
    for (const page of [landingPage, careersPage, candidateHome, dashboardPage]) {
      expect(page).not.toContain("Aptly Demo Workspace");
      expect(page).not.toContain("Demo Workspace");
    }
  });
});
