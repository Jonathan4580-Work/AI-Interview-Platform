export interface MetricSample {
  readonly name: string;
  readonly value: number;
  readonly tags: Readonly<Record<string, string>>;
}

export interface MetricDefinition {
  readonly name: string;
  readonly type: "counter" | "gauge" | "histogram";
  readonly description: string;
  readonly allowedTags: readonly string[];
}

export const phase11MetricDefinitions = [
  metric("web.request.duration_ms", "histogram", ["route", "method", "status_class"]),
  metric("web.request.errors_total", "counter", ["route", "status_class"]),
  metric("database.health", "gauge", ["dependency"]),
  metric("database.slow_queries_total", "counter", ["query_family"]),
  metric("redis.health", "gauge", ["dependency"]),
  metric("queue.depth", "gauge", ["queue"]),
  metric("queue.oldest_job_age_ms", "gauge", ["queue"]),
  metric("worker.failures_total", "counter", ["queue", "job"]),
  metric("email.delivery_failures_total", "counter", ["provider", "status"]),
  metric("candidate.portal_failures_total", "counter", ["flow"]),
  metric("interview.lifecycle_total", "counter", ["event"]),
  metric("media.upload_failures_total", "counter", ["purpose"]),
  metric("monitoring.ingestion_failures_total", "counter", ["reason"]),
  metric("ai.provider_failures_total", "counter", ["provider", "operation"]),
  metric("reporting.query_duration_ms", "histogram", ["report_type"]),
  metric("export.failures_total", "counter", ["export_type"]),
  metric("retention.deletion_failures_total", "counter", ["data_class"]),
  metric("audit.write_failures_total", "counter", ["action_family"]),
] as const satisfies readonly MetricDefinition[];

export const phase12MetricDefinitions = [
  metric("outbox.backlog", "gauge", ["status"]),
  metric("outbox.oldest_available_age_ms", "gauge", ["status"]),
  metric("outbox.failures_total", "counter", ["event_key", "status"]),
  metric("webhook.delivery.duration_ms", "histogram", ["status"]),
  metric("webhook.delivery_failures_total", "counter", ["reason"]),
  metric("sso.login_total", "counter", ["provider", "status"]),
  metric("scim.provisioning_failures_total", "counter", ["operation", "reason"]),
  metric("ats.sync.duration_ms", "histogram", ["provider", "status"]),
  metric("ats.sync_conflicts_total", "counter", ["provider", "policy"]),
  metric("integration.queue_depth", "gauge", ["queue"]),
  metric("worker.class_health", "gauge", ["queue", "resource_class"]),
  metric("worker.tenant_fairness_ratio", "gauge", ["queue"]),
  metric("provider.throttles_total", "counter", ["provider", "operation"]),
  metric("data_region.policy_violations_total", "counter", ["region", "reason"]),
] as const satisfies readonly MetricDefinition[];

export const metricDefinitions = [
  ...phase11MetricDefinitions,
  ...phase12MetricDefinitions,
] as const satisfies readonly MetricDefinition[];

const protectedTagNames = new Set([
  "candidate",
  "candidateid",
  "email",
  "name",
  "transcript",
  "prompt",
  "mediaurl",
  "signedurl",
]);

export class MetricsRegistry {
  private readonly counters = new Map<string, MetricSample>();

  public increment(name: string, tags: Readonly<Record<string, string>> = {}, amount = 1): void {
    assertMetricTags(tags);
    const key = this.createKey(name, tags);
    const current = this.counters.get(key);

    this.counters.set(key, {
      name,
      tags,
      value: (current?.value ?? 0) + amount,
    });
  }

  public snapshot(): readonly MetricSample[] {
    return Array.from(this.counters.values()).sort((left, right) =>
      left.name.localeCompare(right.name),
    );
  }

  private createKey(name: string, tags: Readonly<Record<string, string>>): string {
    return JSON.stringify([name, Object.entries(tags).sort()]);
  }
}

export function assertMetricTags(tags: Readonly<Record<string, string>>): void {
  const entries = Object.entries(tags);
  if (entries.length > 8) {
    throw new Error("Metric tags exceed the cardinality limit.");
  }

  for (const [key, value] of entries) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (protectedTagNames.has(normalizedKey)) {
      throw new Error("Metric tags must not contain candidate PII or sensitive content.");
    }
    if (value.length > 128) {
      throw new Error("Metric tag values must remain low-cardinality.");
    }
  }
}

function metric(
  name: string,
  type: MetricDefinition["type"],
  allowedTags: readonly string[],
): MetricDefinition {
  return {
    name,
    type,
    description: `${name} metric for Aptly operational monitoring.`,
    allowedTags,
  };
}
