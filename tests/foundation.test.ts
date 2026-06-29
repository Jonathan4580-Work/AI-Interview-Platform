import { describe, expect, it } from "vitest";

import { loadEnvironment } from "@/config";
import { queueNames } from "@/infra/queue/queue-names";

describe("foundation scaffold", () => {
  it("validates required environment configuration", () => {
    const environment = loadEnvironment();

    expect(environment.APP_NAME).toBe("Aptly Test");
    expect(environment.NODE_ENV).toBe("test");
    expect(environment.REQUEST_ID_HEADER).toBe("x-request-id");
    expect(environment.SMTP_SECRET_REF).toBe("test/smtp");
  });

  it("rejects unsafe secret reference values", () => {
    expect(() =>
      loadEnvironment({
        ...process.env,
        SMTP_SECRET_REF: "raw secret with spaces",
      }),
    ).toThrow();
  });

  it("declares queue names without registering business processors", () => {
    expect(queueNames).toContain("email");
    expect(queueNames).toContain("evaluation");
  });
});
