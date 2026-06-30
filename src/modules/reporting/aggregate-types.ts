import type { TenantContext, TenantId } from "@/modules/tenant";
import type { Brand } from "@/shared";

import type { AnalyticsEventKey, AnalyticsProperties } from "./analytics-types";

export type AggregateReportRunId = Brand<string, "AggregateReportRunId">;

export const aggregateReportTypes = [
  "role_pipeline",
  "invitation_conversion",
  "invitation_delivery",
  "candidate_portal_entry",
  "readiness_dropoff",
  "interview_completion",
  "interview_interruption",
  "processing_latency",
  "evaluation_distribution",
  "confidence_distribution",
  "monitoring_warning_frequency",
  "reviewer_workload",
  "time_to_review",
  "human_decision_distribution",
  "email_deliverability",
  "compliance_access",
  "support_access",
] as const;

export type AggregateReportType = (typeof aggregateReportTypes)[number];

export const aggregateReportRunStatuses = [
  "requested",
  "running",
  "ready",
  "failed",
  "expired",
  "cancelled",
] as const;

export type AggregateReportRunStatus = (typeof aggregateReportRunStatuses)[number];

export interface AggregateReportFilters {
  readonly jobId?: string;
  readonly eventKeys?: readonly AnalyticsEventKey[];
}

export interface AggregateReportDimensions {
  readonly groupBy?: readonly ("eventKey" | "status" | "confidence" | "warningType" | "severity")[];
}

export type AggregateReportRow = Readonly<Record<string, string | number | null>>;

export interface AggregateReportResult {
  readonly schemaVersion: "aggregate-report-v1";
  readonly reportType: AggregateReportType;
  readonly dateRange: {
    readonly start: string;
    readonly end: string;
  };
  readonly totals: Readonly<Record<string, number>>;
  readonly rows: readonly AggregateReportRow[];
  readonly limitations: readonly string[];
}

export interface AggregateReportRunRecord {
  readonly id: AggregateReportRunId;
  readonly companyId: TenantId;
  readonly requestedByUserId: string | null;
  readonly reportType: AggregateReportType;
  readonly status: AggregateReportRunStatus;
  readonly idempotencyKey: string | null;
  readonly dateRangeStart: Date;
  readonly dateRangeEnd: Date;
  readonly filters: AggregateReportFilters;
  readonly dimensions: AggregateReportDimensions;
  readonly result: AggregateReportResult | null;
  readonly rowCount: number | null;
  readonly generatedAt: Date | null;
  readonly expiresAt: Date | null;
  readonly failureReason: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface AggregateSourceEvent {
  readonly eventKey: AnalyticsEventKey;
  readonly subjectType: string;
  readonly subjectId: string;
  readonly occurredAt: Date;
  readonly properties: AnalyticsProperties;
}

export interface AggregateReportRequest {
  readonly tenant: TenantContext;
  readonly requestedByUserId?: string | null;
  readonly reportType: AggregateReportType;
  readonly dateRangeStart: Date;
  readonly dateRangeEnd: Date;
  readonly filters?: AggregateReportFilters;
  readonly dimensions?: AggregateReportDimensions;
  readonly idempotencyKey?: string | null;
}

export interface AggregateReportStore {
  findRunByIdempotencyKey(input: {
    readonly companyId: TenantId;
    readonly idempotencyKey: string;
  }): Promise<AggregateReportRunRecord | null>;
  createRun(input: {
    readonly companyId: TenantId;
    readonly requestedByUserId: string | null;
    readonly reportType: AggregateReportType;
    readonly dateRangeStart: Date;
    readonly dateRangeEnd: Date;
    readonly filters: AggregateReportFilters;
    readonly dimensions: AggregateReportDimensions;
    readonly idempotencyKey: string | null;
    readonly expiresAt: Date;
  }): Promise<AggregateReportRunRecord>;
  markReady(input: {
    readonly companyId: TenantId;
    readonly runId: AggregateReportRunId;
    readonly result: AggregateReportResult;
    readonly rowCount: number;
    readonly generatedAt: Date;
  }): Promise<AggregateReportRunRecord>;
  listEvents(input: {
    readonly companyId: TenantId;
    readonly eventKeys: readonly AnalyticsEventKey[];
    readonly dateRangeStart: Date;
    readonly dateRangeEnd: Date;
    readonly filters: AggregateReportFilters;
    readonly limit: number;
  }): Promise<readonly AggregateSourceEvent[]>;
}
