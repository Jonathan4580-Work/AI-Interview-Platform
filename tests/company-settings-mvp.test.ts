import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("company settings MVP", () => {
  it("adds an audited company settings action using existing tenant settings services", () => {
    const actions = source("src/server/hr-workspace/actions.ts");

    expect(actions).toContain("updateCompanySettingsAction");
    expect(actions).toContain('requireHrWorkspaceContext("tenant:manage")');
    expect(actions).toContain("new CompanySettingsService");
    expect(actions).toContain("updateBranding");
    expect(actions).toContain("updateCandidatePolicy");
    expect(actions).toContain("updateInvitationPolicy");
    expect(actions).toContain("updateSchedulingPolicy");
    expect(actions).not.toContain("password");
  });

  it("renders editable settings without adding new schema", () => {
    const page = source("src/app/(workspace)/settings/company/page.tsx");

    expect(page).toContain("Workspace and candidate-facing settings");
    expect(page).toContain("Careers display name");
    expect(page).toContain("Default invitation expiry days");
    expect(page).toContain("Default scheduling timezone");
    expect(page).toContain("Allow duplicate candidate records");
    expect(page).toContain("Save company settings");
  });

  it("uses configured branding display names on public careers pages", () => {
    const queries = source("src/server/public-careers/queries.ts");

    expect(queries).toContain("publicCompanyName");
    expect(queries).toContain("brandingJson");
    expect(queries).toContain("displayName");
    expect(queries).toContain("company.name");
  });
});
