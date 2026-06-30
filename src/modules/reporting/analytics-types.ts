import type { TenantContext, TenantId } from "@/modules/tenant";
import type { Brand } from "@/shared";

export type AnalyticsEventId = Brand<string, "AnalyticsEventId">;

export const analyticsEventKeys = [
  "candidate.created",
  "invitation.sent",
  "invitation.opened",
  "candidate_portal.entered",
  "readiness.completed",
  "interview.started",
  "interview.completed",
  "interview.interrupted",
  "processing.completed",
  "evaluation.completed",
  "report.reviewed",
  "monitoring.warning_aggregated",
  "email.delivered",
  "email.bounced",
  "email.complained",
  "support_access.opened",
] as const;

export type AnalyticsEventKey = (typeof analyticsEventKeys)[number];

export const analyticsSubjectTypes = [
  "candidate",
  "job",
  "application",
  "invitation",
  "interview_session",
  "evaluation",
  "report",
  "email_delivery",
  "support_access_session",
] as const;

export type AnalyticsSubjectType = (typeof analyticsSubjectTypes)[number];

export type AnalyticsProperties = Record<string, string | number | boolean | null>;

export interface AnalyticsEventRecord {
  readonly id: AnalyticsEventId;
  readonly companyId: TenantId;
  readonly eventKey: AnalyticsEventKey;
  readonly subjectType: AnalyticsSubjectType;
  readonly subjectId: string;
  readonly idempotencyKey: string;
  readonly schemaVersion: string;
  readonly occurredAt: Date;
  readonly properties: AnalyticsProperties;
  readonly createdAt: Date;
}

export interface RecordAnalyticsEventInput {
  readonly tenant: TenantContext;
  readonly eventKey: AnalyticsEventKey;
  readonly subjectType: AnalyticsSubjectType;
  readonly subjectId: string;
  readonly idempotencyKey: string;
  readonly occurredAt?: Date;
  readonly properties: AnalyticsProperties;
}

export interface AnalyticsEventStore {
  findByIdempotencyKey(input: {
    readonly companyId: TenantId;
    readonly idempotencyKey: string;
  }): Promise<AnalyticsEventRecord | null>;
  create(input: {
    readonly companyId: TenantId;
    readonly eventKey: AnalyticsEventKey;
    readonly subjectType: AnalyticsSubjectType;
    readonly subjectId: string;
    readonly idempotencyKey: string;
    readonly schemaVersion: string;
    readonly occurredAt: Date;
    readonly properties: AnalyticsProperties;
  }): Promise<AnalyticsEventRecord>;
}
