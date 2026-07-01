import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("Prisma migration SQL encoding", () => {
  it("does not allow UTF-8 BOM bytes at the beginning of migration files", () => {
    const migrations = listMigrationSqlFiles(join(process.cwd(), "prisma", "migrations"));
    const filesWithBom = migrations.filter((filePath) => {
      const bytes = readFileSync(filePath);
      return bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
    });

    expect(filesWithBom).toEqual([]);
  });
});

function listMigrationSqlFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      return listMigrationSqlFiles(entryPath);
    }
    return entry.isFile() && entry.name === "migration.sql" ? [entryPath] : [];
  });
}
