import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { companyPostLoginPath, getPostLoginRedirect } from "../src/lib/auth/post-login-redirect";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("application entry routing", () => {
  it("renders a public landing page at the root route", () => {
    const landingPage = source("src/app/page.tsx");

    expect(landingPage).toContain("AI-powered hiring, from job description to interview insights");
    expect(landingPage).toContain('href="/login"');
    expect(landingPage).toContain('href="/careers/aptly-demo"');
    expect(landingPage).toContain("JD-based job creation");
    expect(landingPage).toContain("Candidate applies");
    expect(landingPage).toContain("HR reports");
  });

  it("keeps login available and sends company users to the real HR dashboard", () => {
    expect(existsSync(join(process.cwd(), "src/app/(auth)/login/page.tsx"))).toBe(true);
    expect(companyPostLoginPath).toBe("/dashboard");
    expect(
      getPostLoginRedirect({
        type: "user",
        email: "hr@example.com",
        name: "HR User",
        status: "ACTIVE",
        userId: "user_1",
        companyId: "company_1",
      }),
    ).toBe("/dashboard");
  });

  it("serves the authenticated HR dashboard at /dashboard instead of /", () => {
    const dashboardPage = source("src/app/(workspace)/dashboard/page.tsx");
    const workspaceNavigation = source("src/components/layout/workspace-navigation.ts");

    expect(existsSync(join(process.cwd(), "src/app/(workspace)/page.tsx"))).toBe(false);
    expect(dashboardPage).toContain("Recruiting command center");
    expect(dashboardPage).toContain("getDashboardData");
    expect(workspaceNavigation).toContain('href: "/dashboard"');
    expect(workspaceNavigation).not.toContain('label: "Dashboard", href: "/"');
  });

  it("redirects unauthenticated HR dashboard access to login and keeps candidates out", () => {
    const workspaceLayout = source("src/app/(workspace)/layout.tsx");
    const candidateAuth = source("src/server/public-careers/candidate-auth.ts");

    expect(workspaceLayout).toContain("authCookieNames.session");
    expect(workspaceLayout).toContain('redirect("/login")');
    expect(candidateAuth).toContain("aptly_candidate_account_session");
    expect(candidateAuth).not.toContain("authCookieNames.session");
  });

  it("keeps candidate entry routes reachable without a raw not-found experience", () => {
    const candidateHome = source("src/app/candidate/page.tsx");
    const candidateApplications = source("src/app/candidate/applications/page.tsx");

    expect(candidateHome).toContain("Track applications with Aptly");
    expect(candidateHome).toContain("Open the job posting you applied from");
    expect(candidateApplications).toContain("Candidate sign in required");
    expect(candidateApplications).toContain("Return to the public job posting");
  });

  it("keeps public careers routes available from the landing flow", () => {
    expect(existsSync(join(process.cwd(), "src/app/careers/[companySlug]/page.tsx"))).toBe(true);
    expect(
      existsSync(join(process.cwd(), "src/app/careers/[companySlug]/jobs/[jobSlug]/page.tsx")),
    ).toBe(true);
    expect(
      existsSync(
        join(process.cwd(), "src/app/careers/[companySlug]/jobs/[jobSlug]/apply/page.tsx"),
      ),
    ).toBe(true);
  });
});
