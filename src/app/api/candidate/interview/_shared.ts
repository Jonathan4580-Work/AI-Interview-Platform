import { z } from "zod";

import { AuditWriter, PrismaAuditEventStore } from "@/modules/audit";
import {
  InterviewService,
  PrismaInterviewRepository,
  type CandidateInterviewContext,
  type InterviewTurnId,
} from "@/modules/interviews";
import type { MediaObjectId } from "@/modules/media";
import { PrismaWorkflowRepository, WorkflowService } from "@/modules/workflows";

import {
  createCandidateRequestContext,
  enforceCandidateRateLimit,
  requireCandidateSession,
} from "../_shared";

import type { ApiHandlerContext } from "@/server/api";
import type { NextRequest } from "next/server";

export const idempotencyKeySchema = z.string().trim().min(1).max(120);
export const sequenceSchema = z.coerce.number().int().min(1).max(500);
export const interviewTurnIdSchema = z.string().trim().min(1).max(128);
export const mediaObjectIdsSchema = z.array(z.string().trim().min(1).max(128)).max(50).default([]);

export async function requireCandidateInterviewContext(
  request: NextRequest,
  apiContext: ApiHandlerContext,
  mutation = false,
): Promise<CandidateInterviewContext> {
  await enforceCandidateRateLimit(request, "interview", mutation ? 30 : 60);
  const session = await requireCandidateSession(request, apiContext, mutation);
  const requestContext = createCandidateRequestContext(request, apiContext);
  return {
    session,
    request: {
      requestId: requestContext.requestId,
      correlationId: requestContext.correlationId,
      sessionId: session.sessionId,
      ipAddress: requestContext.ipAddress,
      userAgent: requestContext.userAgent,
    },
  };
}

export function createCandidateInterviewService(): InterviewService {
  const auditWriter = new AuditWriter(new PrismaAuditEventStore());
  return new InterviewService(
    new PrismaInterviewRepository(),
    auditWriter,
    new WorkflowService(new PrismaWorkflowRepository(), auditWriter),
  );
}

export function toTurnId(value: string): InterviewTurnId {
  return value as InterviewTurnId;
}

export function toMediaObjectIds(values: readonly string[]): readonly MediaObjectId[] {
  return values.map((value) => value as MediaObjectId);
}
