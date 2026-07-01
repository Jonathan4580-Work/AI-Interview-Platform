import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("production deployment artifacts", () => {
  it("keeps the runtime container non-root and production-oriented", () => {
    const dockerfile = read("Dockerfile");

    expect(dockerfile).toContain("FROM builder AS migrator");
    expect(dockerfile).toContain("npm prune --omit=dev");
    expect(dockerfile).toContain("USER aptly");
    expect(dockerfile).toContain("HEALTHCHECK");
    expect(dockerfile).toContain('CMD ["npm", "run", "start"]');
    expect(dockerfile).not.toContain('CMD ["npm", "run", "dev"]');
  });

  it("keeps production compose as a template without embedded secrets", () => {
    const compose = read("docker-compose.production.example.yml");

    expect(compose).toContain("${APTLY_IMAGE:?set APTLY_IMAGE}");
    expect(compose).toContain("read_only: true");
    expect(compose).toContain("no-new-privileges:true");
    expect(compose).not.toMatch(/password:\s*["']?[A-Za-z0-9]/iu);
  });

  it("defines CI verification without enabling production deployment", () => {
    const workflow = read(".github/workflows/ci.yml");

    expect(workflow).toContain("npm run format:check");
    expect(workflow).toContain("npm run lint");
    expect(workflow).toContain("npm run build");
    expect(workflow).toContain("npm run test");
    expect(workflow).toContain("npm audit");
    expect(workflow).toContain("docker build --target runner");
    expect(workflow).toContain("if: false");
  });
});

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}
