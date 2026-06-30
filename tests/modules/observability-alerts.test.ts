import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("Phase 11 observability alert runbook", () => {
  it("documents critical alert classes required for production pilot operations", () => {
    const runbook = readFileSync(
      join(process.cwd(), "docs", "runbooks", "OBSERVABILITY_ALERTS.md"),
      "utf8",
    );

    for (const required of [
      "Authentication failure spike",
      "Candidate token abuse",
      "Cross-tenant denial anomaly",
      "Database unavailable",
      "Redis unavailable",
      "Queue backlog",
      "Dead-letter growth",
      "Email failure spike",
      "Recording upload failures",
      "Workflow processing failures",
      "AI provider failure spike",
      "Audit-write failure",
      "Backup failure",
      "Restore verification failure",
      "Object-storage errors",
      "Elevated 5xx rate",
    ]) {
      expect(runbook).toContain(required);
    }
  });

  it("forbids sensitive metric labels in operational guidance", () => {
    const runbook = readFileSync(
      join(process.cwd(), "docs", "runbooks", "OBSERVABILITY_ALERTS.md"),
      "utf8",
    );

    expect(runbook).toContain("Candidate names, emails, transcript text");
    expect(runbook).toContain("must never appear in metric labels");
  });
});
