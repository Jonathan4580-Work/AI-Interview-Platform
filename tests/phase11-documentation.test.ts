import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("Phase 11 hardening documentation", () => {
  it("creates the required review reports and runbooks", () => {
    for (const path of [
      ["docs", "PHASE11_HARDENING_REVIEW.md"],
      ["docs", "SECURITY_REVIEW_SUMMARY.md"],
      ["docs", "ACCESSIBILITY_AUDIT.md"],
      ["docs", "PERFORMANCE_LOAD_TEST_REPORT.md"],
      ["docs", "runbooks", "BACKUP_RESTORE.md"],
      ["docs", "runbooks", "INCIDENT_RESPONSE.md"],
      ["docs", "runbooks", "DEPLOYMENT_ROLLBACK.md"],
      ["docs", "runbooks", "OBSERVABILITY_ALERTS.md"],
    ]) {
      expect(existsSync(join(process.cwd(), ...path))).toBe(true);
    }
  });

  it("records accepted risks and excludes Phase 12 and Phase 13 implementation", () => {
    const review = readFileSync(join(process.cwd(), "docs", "PHASE11_HARDENING_REVIEW.md"), "utf8");

    expect(review).toContain("Remaining Accepted Risks");
    expect(review).toContain("Phase 12 Prerequisites");
    expect(review).toContain("production deployment and infrastructure provisioning in Phase 13");
    expect(review).not.toContain("SSO implemented");
    expect(review).not.toContain("ATS integration implemented");
  });
});
