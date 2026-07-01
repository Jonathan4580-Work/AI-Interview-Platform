import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const addEnumValuePattern =
  /ALTER\s+TYPE\s+"(?<enumName>[^"]+)"\s+ADD\s+VALUE(?:\s+IF\s+NOT\s+EXISTS)?\s+'(?<enumValue>[^']+)'/giu;

describe("Prisma migration enum transaction safety", () => {
  it("does not use newly added enum values as defaults in the same transaction", () => {
    const unsafeUsages = listMigrationSqlFiles(join(process.cwd(), "prisma", "migrations")).flatMap(
      (filePath) => findUnsafeEnumDefaultUsages(filePath, readFileSync(filePath, "utf8")),
    );

    expect(unsafeUsages).toEqual([]);
  });
});

function findUnsafeEnumDefaultUsages(
  filePath: string,
  sql: string,
): readonly {
  readonly filePath: string;
  readonly enumName: string;
  readonly enumValue: string;
}[] {
  return splitTransactionScopes(sql).flatMap((scope) => {
    const additions = [...scope.matchAll(addEnumValuePattern)];
    return additions.flatMap((addition) => {
      const enumName = addition.groups?.enumName;
      const enumValue = addition.groups?.enumValue;
      if (enumName === undefined || enumValue === undefined) {
        return [];
      }
      const remainingTransaction = scope.slice(addition.index + addition[0].length);
      const defaultPattern = new RegExp(`DEFAULT\\s+'${escapeRegex(enumValue)}'`, "iu");
      return defaultPattern.test(remainingTransaction) ? [{ filePath, enumName, enumValue }] : [];
    });
  });
}

function splitTransactionScopes(sql: string): readonly string[] {
  const scopes: string[] = [];
  let current = "";
  for (const statement of sql.split(/(?<=;)/u)) {
    current += statement;
    if (/^\s*COMMIT\s*;/iu.test(statement)) {
      scopes.push(current);
      current = "";
    }
  }
  if (current.trim().length > 0) {
    scopes.push(current);
  }
  return scopes;
}

function listMigrationSqlFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      return listMigrationSqlFiles(entryPath);
    }
    return entry.isFile() && entry.name === "migration.sql" ? [entryPath] : [];
  });
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
