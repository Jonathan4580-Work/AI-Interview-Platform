import { describe, expect, it } from "vitest";

import {
  MetricsRegistry,
  assertMetricTags,
  metricDefinitions,
  createErrorReport,
  phase11MetricDefinitions,
  phase12MetricDefinitions,
} from "@/modules/observability";

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

  it("defines Phase 11 production-pilot metrics without high-cardinality labels", () => {
    expect(phase11MetricDefinitions.map((definition) => definition.name)).toEqual(
      expect.arrayContaining([
        "web.request.duration_ms",
        "queue.depth",
        "worker.failures_total",
        "candidate.portal_failures_total",
        "interview.lifecycle_total",
        "media.upload_failures_total",
        "ai.provider_failures_total",
        "retention.deletion_failures_total",
        "audit.write_failures_total",
      ]),
    );

    for (const definition of phase11MetricDefinitions) {
      expect(definition.allowedTags).not.toEqual(
        expect.arrayContaining(["candidateId", "email", "transcript"]),
      );
      expect(definition.allowedTags.length).toBeLessThanOrEqual(4);
    }
  });

  it("defines Phase 12 integration and scale metrics without sensitive labels", () => {
    expect(phase12MetricDefinitions.map((definition) => definition.name)).toEqual(
      expect.arrayContaining([
        "outbox.backlog",
        "webhook.delivery_failures_total",
        "sso.login_total",
        "scim.provisioning_failures_total",
        "ats.sync_conflicts_total",
        "worker.tenant_fairness_ratio",
        "data_region.policy_violations_total",
      ]),
    );

    for (const definition of metricDefinitions) {
      expect(definition.allowedTags).not.toEqual(
        expect.arrayContaining(["candidateId", "email", "transcript", "providerPayload"]),
      );
      expect(definition.allowedTags.length).toBeLessThanOrEqual(4);
    }
  });

  it("rejects metric tags that could leak PII or explode cardinality", () => {
    expect(() => {
      assertMetricTags({ route: "candidate" });
    }).not.toThrow();
    expect(() => {
      assertMetricTags({ candidateId: "candidate_1" });
    }).toThrow("Metric tags must not contain candidate PII");
    expect(() => {
      assertMetricTags({ route: "x".repeat(129) });
    }).toThrow("Metric tag values must remain low-cardinality");
    expect(() => {
      assertMetricTags({
        one: "1",
        two: "2",
        three: "3",
        four: "4",
        five: "5",
        six: "6",
        seven: "7",
        eight: "8",
        nine: "9",
      });
    }).toThrow("Metric tags exceed the cardinality limit.");
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
