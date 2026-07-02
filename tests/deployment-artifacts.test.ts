import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("production deployment artifacts", () => {
  it("keeps the runtime container non-root and production-oriented", () => {
    const dockerfile = read("Dockerfile");

    expect(dockerfile).toContain("FROM builder AS migrator");
    expect(dockerfile).toContain("npm prune --omit=dev");
    expect(dockerfile).toContain("/app/.next/standalone ./.next/standalone");
    expect(dockerfile).toContain("/app/.next/static ./.next/standalone/.next/static");
    expect(dockerfile).toContain("/app/public ./.next/standalone/public");
    expect(dockerfile).toContain("USER aptly");
    expect(dockerfile).toContain("HEALTHCHECK");
    expect(dockerfile).toContain('CMD ["node", ".next/standalone/server.js"]');
    expect(dockerfile).not.toContain('CMD ["npm", "run", "start"]');
    expect(dockerfile).not.toContain('CMD ["npm", "run", "dev"]');
  });

  it("defines a dedicated worker image without a Next.js production build", () => {
    const dockerfile = read("Dockerfile.worker");

    expect(dockerfile).toContain("# syntax=docker/dockerfile");
    expect(dockerfile).toContain("npm ci");
    expect(dockerfile).toContain("--mount=type=cache,id=aptly-worker-npm,target=/root/.npm");
    expect(dockerfile).toContain("npm run prisma:generate");
    expect(dockerfile).toContain("npm prune --omit=dev");
    expect(dockerfile).toContain("scripts/worker-healthcheck.mjs");
    expect(dockerfile).toContain("USER aptly");
    expect(dockerfile).toContain('CMD ["npm", "run", "worker:prod"]');
    expect(dockerfile).not.toContain("npm run next:build");
    expect(dockerfile).not.toContain(".next/standalone");
    expect(dockerfile).not.toContain('CMD ["node", ".next/standalone/server.js"]');
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

  it("keeps Railway web config on the standalone web service", () => {
    const railway = JSON.parse(read("railway.json")) as {
      readonly build?: { readonly builder?: string; readonly dockerfilePath?: string };
      readonly deploy?: {
        readonly startCommand?: string;
        readonly healthcheckPath?: string;
        readonly preDeployCommand?: string;
      };
    };

    expect(railway.build?.builder).toBe("DOCKERFILE");
    expect(railway.build?.dockerfilePath).toBe("Dockerfile");
    expect(railway.deploy?.startCommand).toBe("node .next/standalone/server.js");
    expect(railway.deploy?.healthcheckPath).toBe("/health");
    expect(railway.deploy?.preDeployCommand).not.toBe("npm run worker:prod");
  });

  it("keeps Railway worker config free of web healthchecks and migrations", () => {
    const railway = JSON.parse(read("railway.worker.json")) as {
      readonly build?: { readonly builder?: string; readonly dockerfilePath?: string };
      readonly deploy?: {
        readonly startCommand?: string;
        readonly healthcheckPath?: string | null;
        readonly healthcheckTimeout?: number | null;
        readonly preDeployCommand?: string;
        readonly restartPolicyType?: string;
      };
    };
    const serialized = JSON.stringify(railway);

    expect(railway.build?.builder).toBe("DOCKERFILE");
    expect(railway.build?.dockerfilePath).toBe("Dockerfile.worker");
    expect(railway.deploy?.startCommand).toBe("npm run worker:prod");
    expect(railway.deploy?.healthcheckPath).toBeNull();
    expect(railway.deploy?.healthcheckTimeout).toBeNull();
    expect(railway.deploy?.restartPolicyType).toBe("ALWAYS");
    expect(railway.deploy?.preDeployCommand).toBeUndefined();
    expect(serialized).not.toContain("/health");
    expect(serialized).not.toContain(".next/standalone/server.js");
    expect(serialized).not.toContain("prisma migrate deploy");
  });
});

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}
