import { z } from "zod";

import { AuditWriter, PrismaAuditEventStore } from "@/modules/audit";
import {
  monitoringEventTypes,
  MonitoringService,
  PrismaMonitoringRepository,
  type CandidateMonitoringContext,
} from "@/modules/monitoring";

import { idempotencyKeySchema, requireCandidateInterviewContext } from "../_shared";

import type { ApiHandlerContext } from "@/server/api";
import type { NextRequest } from "next/server";

const detectorCategories = [
  "camera_presence",
  "multiple_face",
  "face_position",
  "camera_obstruction",
  "page_visibility",
  "window_focus",
  "network_quality",
  "recording_health",
  "activity",
] as const;

const dateSchema = z
  .string()
  .datetime()
  .transform((value) => new Date(value));

export const monitoringEventSchema = z.object({
  type: z.enum(monitoringEventTypes),
  occurredAt: dateSchema,
  endedAt: dateSchema.nullable().optional(),
  durationMs: z.number().int().min(0).max(3_600_000).nullable().optional(),
  occurrenceCount: z.number().int().min(1).max(1_000).optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  sourceDetector: z.string().trim().min(1).max(80),
  detectorCategory: z.enum(detectorCategories),
  detectorVersion: z.string().trim().min(1).max(80),
  aggregationKey: z.string().trim().min(1).max(160),
  idempotencyKey: idempotencyKeySchema,
  metadata: z.record(z.union([z.string().max(200), z.number(), z.boolean()])).optional(),
});

export const monitoringBatchSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  detectorConfigVersion: z.string().trim().min(1).max(80),
  thresholdVersion: z.string().trim().min(1).max(80),
  events: z.array(monitoringEventSchema).min(1).max(25),
});

export async function requireCandidateMonitoringContext(
  request: NextRequest,
  apiContext: ApiHandlerContext,
  mutation = false,
): Promise<CandidateMonitoringContext> {
  return requireCandidateInterviewContext(request, apiContext, mutation);
}

export function createCandidateMonitoringService(): MonitoringService {
  return new MonitoringService(
    new PrismaMonitoringRepository(),
    new AuditWriter(new PrismaAuditEventStore()),
  );
}
