import { readFileSync } from "node:fs";

const envPath = process.argv.at(2);
const source = envPath === undefined ? process.env : parseEnvFile(envPath);

Object.assign(process.env, {
  ...source,
  NODE_ENV: "production",
});

const { loadEnvironment } = await import("../src/config/env");
loadEnvironment(process.env);

console.log("Production environment validation passed.");

function parseEnvFile(path: string): Record<string, string> {
  const lines = readFileSync(path, "utf8").split(/\r?\n/u);
  const values: Record<string, string> = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      continue;
    }
    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex < 1) {
      continue;
    }
    const key = trimmed.slice(0, equalsIndex);
    const value = trimmed.slice(equalsIndex + 1);
    values[key] = value;
  }

  return values;
}
