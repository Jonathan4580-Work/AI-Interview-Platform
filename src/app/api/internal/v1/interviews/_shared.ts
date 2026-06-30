import { z } from "zod";

import { AuditWriter, PrismaAuditEventStore } from "@/modules/audit";
import { InterviewService, PrismaInterviewRepository } from "@/modules/interviews";
import { PrismaWorkflowRepository, WorkflowService } from "@/modules/workflows";
import {
  getAuthenticatedContext,
  requirePermissionForContext,
  requireTenantContext,
} from "@/server/auth";

import type { InterviewMutationContext } from "@/modules/interviews";
import type { ApiHandlerContext } from "@/server/api";
import type { NextRequest } from "next/server";

export const interviewSessionIdSchema = z.string().trim().min(1).max(128);

export async function requireInterviewReadContext(
  request: NextRequest,
  apiContext: ApiHandlerContext,
): Promise<InterviewMutationContext> {
  const auth = await getAuthenticatedContext(request);
  requirePermissionForContext(auth, "interviews:read");
  const tenant = requireTenantContext(auth, request);
  return {
    tenant,
    actor:
      auth.kind === "platform"
        ? { type: "platform_user", id: auth.subject.platformUserId }
        : { type: "user", id: auth.subject.userId },
    request: {
      requestId: apiContext.requestContext.requestId,
      correlationId: apiContext.requestContext.correlationId,
      sessionId: auth.session.id,
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
    },
  };
}

export function createInternalInterviewService(): InterviewService {
  const auditWriter = new AuditWriter(new PrismaAuditEventStore());
  return new InterviewService(
    new PrismaInterviewRepository(),
    auditWriter,
    new WorkflowService(new PrismaWorkflowRepository(), auditWriter),
  );
}
