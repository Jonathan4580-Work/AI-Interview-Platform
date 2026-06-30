import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("backup and restore operational scripts", () => {
  it("uses environment-scoped database URLs and custom-format PostgreSQL backups", () => {
    const backupScript = read("scripts", "backup-postgres.ps1");
    const restoreScript = read("scripts", "restore-postgres.ps1");

    expect(backupScript).toContain("$env:DATABASE_URL");
    expect(backupScript).toContain("--format=custom");
    expect(backupScript).toContain("--no-owner");
    expect(backupScript).toContain("--no-acl");
    expect(restoreScript).toContain("$env:RESTORE_DATABASE_URL");
    expect(restoreScript).toContain("--no-owner");
    expect(restoreScript).toContain("--no-acl");
  });

  it("documents RPO, RTO, isolated restore, and restore verification", () => {
    const runbook = read("docs", "runbooks", "BACKUP_RESTORE.md");
    const verifyScript = read("scripts", "verify-restore.ps1");

    expect(runbook).toContain("RPO: 15 minutes");
    expect(runbook).toContain("RTO: 4 hours");
    expect(runbook).toContain("isolated database");
    expect(runbook).toContain("Tenant-Level Restore Limitations");
    expect(verifyScript).toContain("phase11-tenant-isolation.test.ts");
    expect(verifyScript).toContain("audit.test.ts");
  });
});

function read(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), "utf8");
}
