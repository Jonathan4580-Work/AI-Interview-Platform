import { z } from "zod";

import { AuditWriter, PrismaAuditEventStore } from "@/modules/audit";
import {
  PrismaWorkflowRepository,
  WorkflowService,
  type WorkflowMutationContext,
} from "@/modules/workflows";
import { assertCsrf } from "@/server/api";
import {
  getAuthenticatedContext,
  requirePermissionForContext,
  requireTenantContext,
} from "@/server/auth";

import type { PermissionKey } from "@/modules/access-control";
import type { AuthenticatedContext } from "@/server/auth";
import type { RequestContext } from "@/shared";
import type { NextRequest } from "next/server";

export const workflowStatusSchema = z
  .enum(["pending", "running", "completed", "failed", "cancelled", "partially_completed"])
  .optional();

export const replaySchema = z.object({
  reason: z.string().trim().min(5).max(500),
});

export async function requireWorkflowContext(
  request: NextRequest,
  requestContext: RequestContext,
  permission: PermissionKey,
  mutation = false,
): Promise<WorkflowMutationContext & { readonly auth: AuthenticatedContext }> {
  if (mutation) {
    assertCsrf(request);
  }
  const auth = await getAuthenticatedContext(request);
  requirePermissionForContext(auth, permission);
  const tenant = requireTenantContext(auth, request);
  return {
    auth,
    tenant,
    actor:
      auth.kind === "platform"
        ? { type: "platform_user", id: auth.subject.platformUserId }
        : { type: "user", id: auth.subject.userId },
    request: {
      requestId: requestContext.requestId,
      correlationId: requestContext.correlationId,
      sessionId: auth.session.id,
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
    },
  };
}

export function createWorkflowApiService(): WorkflowService {
  return new WorkflowService(
    new PrismaWorkflowRepository(),
    new AuditWriter(new PrismaAuditEventStore()),
  );
}
