import { z } from "zod";

import { AuditWriter, PrismaAuditEventStore } from "@/modules/audit";
import { MonitoringService, PrismaMonitoringRepository } from "@/modules/monitoring";
import {
  getAuthenticatedContext,
  requirePermissionForContext,
  requireTenantContext,
} from "@/server/auth";

import type { MonitoringMutationContext } from "@/modules/monitoring";
import type { ApiHandlerContext } from "@/server/api";
import type { NextRequest } from "next/server";

export const monitoringEventIdSchema = z.string().trim().min(1).max(128);
export const monitoringReviewSchema = z.object({
  reviewState: z.enum(["acknowledged", "dismissed", "noted"]),
  reason: z.string().trim().min(3).max(500),
});

export async function requireMonitoringReadContext(
  request: NextRequest,
  apiContext: ApiHandlerContext,
): Promise<MonitoringMutationContext> {
  const auth = await getAuthenticatedContext(request);
  requirePermissionForContext(auth, "monitoring_events:read");
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

export async function requireMonitoringReviewContext(
  request: NextRequest,
  apiContext: ApiHandlerContext,
): Promise<MonitoringMutationContext> {
  const auth = await getAuthenticatedContext(request);
  requirePermissionForContext(auth, "monitoring_events:review");
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

export function createInternalMonitoringService(): MonitoringService {
  return new MonitoringService(
    new PrismaMonitoringRepository(),
    new AuditWriter(new PrismaAuditEventStore()),
  );
}
