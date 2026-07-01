import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("staging MVP commands", () => {
  it("exposes explicit staging demo and smoke npm scripts", () => {
    const packageJson = JSON.parse(read("package.json")) as {
      readonly scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.["staging:demo"]).toBe("tsx scripts/staging-demo-mvp.ts");
    expect(packageJson.scripts?.["staging:mvp-smoke"]).toBe("tsx scripts/staging-mvp-smoke.ts");
  });

  it("keeps demo credentials environment-driven and staging-only", () => {
    const script = read("scripts/staging-demo-mvp.ts");

    expect(script).toContain('process.env.APP_ENV !== "staging"');
    expect(script).toContain("STAGING_DEMO_COMPANY_ADMIN_PASSWORD");
    expect(script).toContain("STAGING_DEMO_HR_PASSWORD");
    expect(script).not.toContain("Password123");
  });

  it("documents worker and object-storage blockers in the smoke command", () => {
    const script = read("scripts/staging-mvp-smoke.ts");

    expect(script).toContain("npm run worker:prod");
    expect(script).toContain("OBJECT_STORAGE_ENDPOINT");
    expect(script).toContain("STAGING_WORKER_SERVICE_ENABLED");
  });
});

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}
