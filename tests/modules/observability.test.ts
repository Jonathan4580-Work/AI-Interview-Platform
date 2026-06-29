import { describe, expect, it } from "vitest";

import { createErrorReport, MetricsRegistry } from "@/modules/observability";

describe("observability module", () => {
  it("records metric counters with tags", () => {
    const metrics = new MetricsRegistry();

    metrics.increment("request.count", { route: "health" });
    metrics.increment("request.count", { route: "health" }, 2);

    expect(metrics.snapshot()).toEqual([
      {
        name: "request.count",
        tags: {
          route: "health",
        },
        value: 3,
      },
    ]);
  });

  it("creates error reports with request context", () => {
    const report = createErrorReport(new Error("database unavailable"), {
      requestId: "req-1",
      correlationId: "corr-1",
    });

    expect(report).toMatchObject({
      name: "Error",
      message: "database unavailable",
      requestId: "req-1",
      correlationId: "corr-1",
    });
  });
});
