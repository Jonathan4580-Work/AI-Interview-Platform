import { z } from "zod";

import type { AnalyticsEventKey } from "./analytics-types";
import {
  aggregateReportTypes,
  type AggregateReportFilters,
  type AggregateReportRequest,
  type AggregateReportResult,
  type AggregateReportRunRecord,
  type AggregateReportStore,
  type AggregateReportType,
  type AggregateSourceEvent,
} from "./aggregate-types";

const MAX_REPORT_RANGE_DAYS = 366;
const MAX_EVENT_SCAN = 50_000;
const REPORT_TTL_DAYS = 30;
const safeIdSchema = z.string().trim().min(1).max(128);

const REPORT_EVENT_KEYS: Record<AggregateReportType, readonly AnalyticsEventKey[]> = {
  role_pipeline: [
    "candidate.created",
    "invitation.sent",
    "interview.completed",
    "evaluation.completed",
  ],
  invitation_conversion: [
    "invitation.sent",
    "invitation.opened",
    "candidate_portal.entered",
    "interview.completed",
  ],
  invitation_delivery: ["invitation.sent", "email.delivered", "email.bounced", "email.complained"],
  candidate_portal_entry: ["invitation.sent", "candidate_portal.entered"],
  readiness_dropoff: ["candidate_portal.entered", "readiness.completed"],
  interview_completion: ["interview.started", "interview.completed", "interview.interrupted"],
  interview_interruption: ["interview.interrupted"],
  processing_latency: ["processing.completed"],
  evaluation_distribution: ["evaluation.completed"],
  confidence_distribution: ["evaluation.completed"],
  monitoring_warning_frequency: ["monitoring.warning_aggregated"],
  reviewer_workload: ["report.reviewed"],
  time_to_review: ["report.reviewed"],
  human_decision_distribution: [],
  email_deliverability: ["email.delivered", "email.bounced", "email.complained"],
  compliance_access: ["support_access.opened"],
  support_access: ["support_access.opened"],
};

export class AggregateReportDomainError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "AggregateReportDomainError";
  }
}

export class AggregateReportService {
  public constructor(
    private readonly store: AggregateReportStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async generate(input: AggregateReportRequest): Promise<AggregateReportRunRecord> {
    validateReportRequest(input);
    if (input.idempotencyKey !== null && input.idempotencyKey !== undefined) {
      const existing = await this.store.findRunByIdempotencyKey({
        companyId: input.tenant.companyId,
        idempotencyKey: input.idempotencyKey,
      });
      if (existing !== null) {
        return existing;
      }
    }

    const filters = normalizeFilters(input.filters);
    const dimensions = input.dimensions ?? {};
    const run = await this.store.createRun({
      companyId: input.tenant.companyId,
      requestedByUserId: input.requestedByUserId ?? null,
      reportType: input.reportType,
      dateRangeStart: input.dateRangeStart,
      dateRangeEnd: input.dateRangeEnd,
      filters,
      dimensions,
      idempotencyKey: input.idempotencyKey ?? null,
      expiresAt: addDays(this.now(), REPORT_TTL_DAYS),
    });
    const eventKeys = resolveReportEventKeys(input.reportType, filters);
    const events = await this.store.listEvents({
      companyId: input.tenant.companyId,
      eventKeys,
      dateRangeStart: input.dateRangeStart,
      dateRangeEnd: input.dateRangeEnd,
      filters,
      limit: MAX_EVENT_SCAN,
    });
    const result = buildAggregateResult(
      input.reportType,
      input.dateRangeStart,
      input.dateRangeEnd,
      events,
    );

    return this.store.markReady({
      companyId: input.tenant.companyId,
      runId: run.id,
      result,
      rowCount: result.rows.length,
      generatedAt: this.now(),
    });
  }
}

function validateReportRequest(input: AggregateReportRequest): void {
  if (!aggregateReportTypes.includes(input.reportType)) {
    throw new AggregateReportDomainError("Aggregate report type is not supported.");
  }
  const start = input.dateRangeStart.getTime();
  const end = input.dateRangeEnd.getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || start >= end) {
    throw new AggregateReportDomainError("Aggregate report date range is invalid.");
  }
  if (end - start > MAX_REPORT_RANGE_DAYS * 24 * 60 * 60 * 1000) {
    throw new AggregateReportDomainError("Aggregate report date range exceeds the maximum.");
  }
  if ((input.dimensions?.groupBy?.length ?? 0) > 4) {
    throw new AggregateReportDomainError("Aggregate report dimensions exceed the maximum.");
  }
}

function normalizeFilters(filters: AggregateReportFilters | undefined): AggregateReportFilters {
  if (filters === undefined) {
    return {};
  }
  if (filters.jobId !== undefined && !safeIdSchema.safeParse(filters.jobId).success) {
    throw new AggregateReportDomainError("Aggregate report job filter is invalid.");
  }
  if ((filters.eventKeys?.length ?? 0) > 12) {
    throw new AggregateReportDomainError("Aggregate report filter count exceeds the maximum.");
  }
  return filters;
}

function resolveReportEventKeys(
  reportType: AggregateReportType,
  filters: AggregateReportFilters,
): readonly AnalyticsEventKey[] {
  const allowed = REPORT_EVENT_KEYS[reportType];
  if (allowed.length === 0) {
    return [];
  }

  const requested = filters.eventKeys;
  if (requested === undefined) {
    return allowed;
  }

  return requested.filter((eventKey) => allowed.includes(eventKey));
}

export function buildAggregateResult(
  reportType: AggregateReportType,
  dateRangeStart: Date,
  dateRangeEnd: Date,
  events: readonly AggregateSourceEvent[],
): AggregateReportResult {
  const totals = countBy(events, (event) => event.eventKey);
  const rows = buildRows(reportType, events);

  return {
    schemaVersion: "aggregate-report-v1",
    reportType,
    dateRange: {
      start: dateRangeStart.toISOString(),
      end: dateRangeEnd.toISOString(),
    },
    totals,
    rows,
    limitations: [
      "Aggregate reports are descriptive summaries and must not be used as automated hiring decisions.",
      "Monitoring warnings are reported separately and do not alter competency or comparison scores.",
    ],
  };
}

function buildRows(reportType: AggregateReportType, events: readonly AggregateSourceEvent[]) {
  if (reportType === "monitoring_warning_frequency") {
    return Object.entries(
      countBy(
        events,
        (event) =>
          `${String(event.properties.warningType ?? "unknown")}:${String(event.properties.severity ?? "unknown")}`,
      ),
    ).map(([key, count]) => {
      const [warningType, severity] = key.split(":");
      return { warningType, severity, count };
    });
  }

  if (reportType === "confidence_distribution" || reportType === "evaluation_distribution") {
    return Object.entries(
      countBy(events, (event) => String(event.properties.confidence ?? "unknown")),
    ).map(([confidence, count]) => ({ confidence, count }));
  }

  if (reportType === "email_deliverability" || reportType === "invitation_delivery") {
    return Object.entries(countBy(events, (event) => event.eventKey)).map(([eventKey, count]) => ({
      eventKey,
      count,
    }));
  }

  return Object.entries(countBy(events, (event) => event.eventKey)).map(([eventKey, count]) => ({
    eventKey,
    count,
  }));
}

function countBy<TRecord>(
  records: readonly TRecord[],
  getKey: (record: TRecord) => string,
): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const record of records) {
    const key = getKey(record);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
