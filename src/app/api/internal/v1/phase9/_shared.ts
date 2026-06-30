import { z } from "zod";

import { AuditWriter, PrismaAuditEventStore } from "@/modules/audit";
import {
  EvaluationService,
  PrismaEvaluationRepository,
  createEvaluationProvider,
} from "@/modules/evaluation";
import { PrismaAiGovernanceRepository } from "@/modules/ai-governance";
import { PrismaReportingRepository, ReportingService } from "@/modules/reporting";
import {
  PrismaTranscriptRepository,
  TranscriptionService,
  createTranscriptionProvider,
} from "@/modules/transcription";
import { assertCsrf } from "@/server/api";
import {
  getAuthenticatedContext,
  requirePermissionForContext,
  requireTenantContext,
} from "@/server/auth";

import type { EvaluationMutationContext } from "@/modules/evaluation";
import type { PermissionKey } from "@/modules/access-control";
import type { ApiHandlerContext } from "@/server/api";
import type { NextRequest } from "next/server";

export const phase9IdSchema = z.string().trim().min(1).max(128);

export async function requirePhase9Context(
  request: NextRequest,
  apiContext: ApiHandlerContext,
  permission: PermissionKey,
  options: { readonly mutation?: boolean } = {},
): Promise<EvaluationMutationContext> {
  if (options.mutation === true) {
    assertCsrf(request);
  }
  const auth = await getAuthenticatedContext(request);
  requirePermissionForContext(auth, permission);
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

export function createInternalEvaluationService(): EvaluationService {
  const auditWriter = new AuditWriter(new PrismaAuditEventStore());
  return new EvaluationService(
    new PrismaEvaluationRepository(),
    new PrismaAiGovernanceRepository(),
    createEvaluationProvider(),
    auditWriter,
  );
}

export function createInternalReportingService(): ReportingService {
  return new ReportingService(
    new PrismaReportingRepository(),
    new AuditWriter(new PrismaAuditEventStore()),
  );
}

export function createInternalTranscriptionService(): TranscriptionService {
  return new TranscriptionService(
    new PrismaTranscriptRepository(),
    createTranscriptionProvider(),
    new AuditWriter(new PrismaAuditEventStore()),
  );
}
