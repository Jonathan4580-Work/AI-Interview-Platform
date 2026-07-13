import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("applications inbox", () => {
  it("adds a permission-aware applications route to workspace navigation", () => {
    const navigation = source("src/components/layout/workspace-navigation.ts");

    expect(navigation).toContain('"/applications"');
    expect(navigation).toContain('label: "Applications"');
    expect(navigation).toContain('permission: "applications:read"');
  });

  it("renders a tenant-scoped HR applications inbox", () => {
    const page = source("src/app/(workspace)/applications/page.tsx");
    const queries = source("src/server/hr-workspace/queries.ts");

    expect(page).toContain('requireHrWorkspaceContext("applications:read")');
    expect(page).toContain("Applications");
    expect(page).toContain("Open application");
    expect(page).toContain("HR review");
    expect(page).toContain("Screening complete");
    expect(page).toContain("Report pending");
    expect(queries).toContain("listApplicationsInbox");
    expect(queries).toContain("companyId: context.tenant.companyId");
    expect(queries).toContain("candidateApplication.findMany");
  });

  it("points dashboard application metrics to the inbox", () => {
    const dashboard = source("src/app/(workspace)/dashboard/page.tsx");

    expect(dashboard).toContain('href: "/applications?status=NEW"');
    expect(dashboard).toContain('href: "/applications?status=SHORTLISTED"');
    expect(dashboard).toContain('href: "/applications?status=AVAILABILITY_REQUESTED"');
    expect(dashboard).toContain('href: "/applications?status=HIRED"');
    expect(dashboard).toContain("Review applications");
  });
});
