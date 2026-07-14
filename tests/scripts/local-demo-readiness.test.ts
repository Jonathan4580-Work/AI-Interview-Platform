import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("local demo readiness command", () => {
  it("exposes a local demo readiness npm script", () => {
    const packageJson = JSON.parse(read("package.json")) as {
      readonly scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.["local:demo-readiness"]).toBe(
      "dotenv -e .env.local -- tsx scripts/local-demo-readiness.ts",
    );
  });

  it("is local-development only and checks the full demo surface", () => {
    const script = read("scripts/local-demo-readiness.ts");

    expect(script).toContain('env.APP_ENV !== "development"');
    expect(script).toContain("LOCAL_DEMO_COMPANY_ADMIN_EMAIL");
    expect(script).toContain("LOCAL_DEMO_HR_EMAIL");
    expect(script).toContain("STORAGE_PROVIDER");
    expect(script).toContain("SMTP_HOST");
    expect(script).toContain("EVALUATION_PROVIDER");
    expect(script).toContain("localJob.count");
    expect(script).toContain("interviewSession.findFirst");
    expect(script).toContain("hrReport.count");
  });

  it("prints actionable commands without exposing secrets or raw candidate links", () => {
    const script = read("scripts/local-demo-readiness.ts");

    expect(script).toContain("npm run local:storage-smoke");
    expect(script).toContain("npm run local:smtp-smoke");
    expect(script).toContain("npm run local:openai-smoke");
    expect(script).toContain("npm run local:full-flow-status");
    expect(script).not.toMatch(/console\.log\([^)]*OPENAI_API_KEY/s);
    expect(script).not.toMatch(/console\.log\([^)]*SMTP_PASSWORD/s);
    expect(script).not.toMatch(/console\.log\([^)]*LOCAL_DEMO_.*PASSWORD/s);
    expect(script).not.toContain("candidateUrl");
    expect(script).not.toContain("tokenHash");
  });

  it("documents the local readiness command in the demo runbooks", () => {
    expect(read("docs/LOCAL_BOSS_DEMO.md")).toContain("npm run local:demo-readiness");
    expect(read("docs/LOCAL_XAMPP_SETUP.md")).toContain("npm run local:demo-readiness");
  });
});

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}
