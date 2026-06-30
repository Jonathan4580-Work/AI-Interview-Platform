import { z } from "zod";

import {
  analyticsEventKeys,
  analyticsSubjectTypes,
  type AnalyticsEventKey,
  type AnalyticsEventRecord,
  type AnalyticsEventStore,
  type AnalyticsProperties,
  type RecordAnalyticsEventInput,
} from "./analytics-types";

const MAX_ID_LENGTH = 128;
const MAX_IDEMPOTENCY_KEY_LENGTH = 160;
const MAX_EVENT_AGE_DAYS = 366;
const MAX_EVENT_FUTURE_SKEW_MS = 5 * 60 * 1000;

const safeIdSchema = z.string().trim().min(1).max(MAX_ID_LENGTH);
const basePropertyValue = z.union([
  z.string().trim().max(160),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);

const analyticsPropertySchemas = {
  "candidate.created": z.object({ sourceType: z.string().trim().max(64).optional() }).strict(),
  "invitation.sent": z.object({ jobId: safeIdSchema, invitationId: safeIdSchema }).strict(),
  "invitation.opened": z.object({ invitationId: safeIdSchema }).strict(),
  "candidate_portal.entered": z.object({ invitationId: safeIdSchema }).strict(),
  "readiness.completed": z.object({ status: z.enum(["pass", "warning", "fail"]) }).strict(),
  "interview.started": z.object({ interviewSessionId: safeIdSchema }).strict(),
  "interview.completed": z
    .object({
      interviewSessionId: safeIdSchema,
      durationSeconds: z
        .number()
        .int()
        .min(0)
        .max(24 * 60 * 60),
    })
    .strict(),
  "interview.interrupted": z
    .object({ interviewSessionId: safeIdSchema, reasonCode: z.string().max(80) })
    .strict(),
  "processing.completed": z
    .object({ workflowId: safeIdSchema, durationMs: z.number().int().min(0).max(86_400_000) })
    .strict(),
  "evaluation.completed": z
    .object({
      evaluationId: safeIdSchema,
      confidence: z.enum(["high", "moderate", "limited", "insufficient"]),
    })
    .strict(),
  "report.reviewed": z.object({ reportId: safeIdSchema }).strict(),
  "monitoring.warning_aggregated": z
    .object({
      warningType: z.enum([
        "looking_away",
        "multiple_faces",
        "camera_blocked",
        "left_frame",
        "copy_paste",
      ]),
      severity: z.enum(["low", "medium", "high"]),
      count: z.number().int().min(1).max(10_000),
    })
    .strict(),
  "email.delivered": z.object({ deliveryId: safeIdSchema }).strict(),
  "email.bounced": z
    .object({ deliveryId: safeIdSchema, category: z.string().trim().max(80) })
    .strict(),
  "email.complained": z.object({ deliveryId: safeIdSchema }).strict(),
  "support_access.opened": z.object({ supportAccessSessionId: safeIdSchema }).strict(),
} satisfies Record<AnalyticsEventKey, z.ZodType<AnalyticsProperties>>;

export class AnalyticsDomainError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "AnalyticsDomainError";
  }
}

export class AnalyticsService {
  public constructor(private readonly store: AnalyticsEventStore) {}

  public async record(input: RecordAnalyticsEventInput): Promise<AnalyticsEventRecord> {
    validateEventKey(input.eventKey);
    validateSubjectType(input.subjectType);
    const subjectId = parseSafeId(input.subjectId, "subject ID");
    const idempotencyKey = parseIdempotencyKey(input.idempotencyKey);
    const occurredAt = validateOccurredAt(input.occurredAt ?? new Date());
    const properties = parseProperties(input.eventKey, input.properties);

    const existing = await this.store.findByIdempotencyKey({
      companyId: input.tenant.companyId,
      idempotencyKey,
    });
    if (existing !== null) {
      return existing;
    }

    return this.store.create({
      companyId: input.tenant.companyId,
      eventKey: input.eventKey,
      subjectType: input.subjectType,
      subjectId,
      idempotencyKey,
      schemaVersion: "analytics.v1",
      occurredAt,
      properties,
    });
  }
}

function validateEventKey(value: string): asserts value is AnalyticsEventKey {
  if (!analyticsEventKeys.includes(value as AnalyticsEventKey)) {
    throw new AnalyticsDomainError("Analytics event key is not allowlisted.");
  }
}

function validateSubjectType(value: string): void {
  if (!analyticsSubjectTypes.includes(value as never)) {
    throw new AnalyticsDomainError("Analytics subject type is not allowlisted.");
  }
}

function parseSafeId(value: string, label: string): string {
  const parsed = safeIdSchema.safeParse(value);
  if (!parsed.success) {
    throw new AnalyticsDomainError(`Invalid analytics ${label}.`);
  }
  return parsed.data;
}

function parseIdempotencyKey(value: string): string {
  const parsed = z.string().trim().min(8).max(MAX_IDEMPOTENCY_KEY_LENGTH).safeParse(value);
  if (!parsed.success) {
    throw new AnalyticsDomainError("Invalid analytics idempotency key.");
  }
  return parsed.data;
}

function validateOccurredAt(value: Date): Date {
  const timestamp = value.getTime();
  const now = Date.now();
  if (
    Number.isNaN(timestamp) ||
    timestamp < now - MAX_EVENT_AGE_DAYS * 24 * 60 * 60 * 1000 ||
    timestamp > now + MAX_EVENT_FUTURE_SKEW_MS
  ) {
    throw new AnalyticsDomainError("Analytics event timestamp is outside the accepted range.");
  }

  return value;
}

function parseProperties(
  eventKey: AnalyticsEventKey,
  properties: AnalyticsProperties,
): AnalyticsProperties {
  const preflight = z.record(z.string().min(1).max(80), basePropertyValue).safeParse(properties);
  if (!preflight.success) {
    throw new AnalyticsDomainError("Analytics properties must use safe scalar values.");
  }

  const parsed = analyticsPropertySchemas[eventKey].safeParse(preflight.data);
  if (!parsed.success) {
    throw new AnalyticsDomainError("Analytics properties do not match the event allowlist.");
  }

  return parsed.data;
}
