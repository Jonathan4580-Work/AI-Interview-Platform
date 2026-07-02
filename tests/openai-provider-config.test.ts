import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("OpenAI evaluation configuration", () => {
  it("does not expose OpenAI secrets through public environment names or browser code", () => {
    const envExample = readFileSync(join(root, ".env.example"), "utf8");
    const productionEnvExample = readFileSync(join(root, ".env.production.example"), "utf8");
    expect(envExample).not.toContain("NEXT_PUBLIC_OPENAI");
    expect(productionEnvExample).not.toContain("NEXT_PUBLIC_OPENAI");

    const clientFacingSources = [
      "src/app/(workspace)/candidates/[candidateId]/invitation-access-actions.tsx",
      "src/app/(workspace)/interviews/[interviewSessionId]/page.tsx",
      "src/app/candidate/interview/page.tsx",
    ].map((path) => readFileSync(join(root, path), "utf8"));
    for (const source of clientFacingSources) {
      expect(source).not.toContain("OPENAI_API_KEY");
      expect(source).not.toContain("OPENAI_MODEL");
    }
  });

  it("removes legacy provider configuration from environment examples", () => {
    const examples = [
      readFileSync(join(root, ".env.example"), "utf8"),
      readFileSync(join(root, ".env.production.example"), "utf8"),
    ].join("\n");
    const removedProviderPrefix = ["DEEP", "SEEK"].join("");
    expect(examples).not.toContain(removedProviderPrefix);
    expect(examples).toContain("OPENAI_API_KEY");
    expect(examples).toContain("OPENAI_MODEL=gpt-5-mini");
  });
});
