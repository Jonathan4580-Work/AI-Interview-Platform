import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const phase12Routes = [
  "src/app/api/internal/v1/webhooks/subscriptions/route.ts",
  "src/app/api/internal/v1/webhooks/deliveries/route.ts",
  "src/app/api/internal/v1/sso/configuration/route.ts",
  "src/app/api/internal/v1/sso/domains/route.ts",
  "src/app/api/internal/v1/scim/configuration/route.ts",
  "src/app/api/internal/v1/integrations/connections/route.ts",
  "src/app/api/internal/v1/integrations/mappings/route.ts",
  "src/app/api/internal/v1/integrations/sync-jobs/route.ts",
  "src/app/api/internal/v1/data-residency/settings/route.ts",
] as const;

describe("Phase 12 internal API guardrails", () => {
  it.each(phase12Routes)("%s is tenant-scoped and permission-aware", (routePath) => {
    const source = readFileSync(join(process.cwd(), routePath), "utf8");

    expect(source).toContain("withApiHandler");
    expect(source).toContain("requirePhase12Tenant");
    expect(source).toMatch(
      /"(webhooks|sso|scim|integrations|integration_syncs|data_residency):(read|manage)"/u,
    );
  });

  it("requires CSRF-backed mutation permissions for every Phase 12 mutation route", () => {
    for (const routePath of phase12Routes) {
      const source = readFileSync(join(process.cwd(), routePath), "utf8");
      if (!source.includes("export const POST")) {
        continue;
      }

      expect(source).toContain("true");
      expect(source).toMatch(/requirePhase12Tenant\(request, [^)]+, true\)/u);
    }
  });

  it("does not expose raw secrets or production deployment controls from Phase 12 routes", () => {
    for (const routePath of phase12Routes) {
      const source = readFileSync(join(process.cwd(), routePath), "utf8");

      expect(source).not.toMatch(/productionDeployment:\s*true/u);
      expect(source).not.toMatch(/secret:\s*body/u);
      expect(source).not.toMatch(/token:\s*generatedToken/u);
    }
  });
});
