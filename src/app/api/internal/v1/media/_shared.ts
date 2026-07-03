import { z } from "zod";

import { AuditWriter, PrismaAuditEventStore } from "@/modules/audit";
import {
  MediaService,
  PrismaMediaRepository,
  createObjectStorageProvider,
  type MediaMutationContext,
} from "@/modules/media";
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

export const mediaPurposeSchema = z.enum([
  "identity_snapshot",
  "interview_recording",
  "report_export",
  "general_attachment",
]);

export const mediaOwnerTypeSchema = z.enum([
  "candidate",
  "candidate_session",
  "invitation",
  "interview_session",
  "identity_verification",
  "export",
]);

export const uploadKindSchema = z.enum(["single_part", "multipart"]);
export const checksumSchema = z
  .string()
  .trim()
  .regex(/^[a-f0-9]{64}$/u)
  .nullable()
  .optional();

export async function requireMediaContext(
  request: NextRequest,
  requestContext: RequestContext,
  permission: PermissionKey,
  mutation = false,
): Promise<MediaMutationContext & { readonly auth: AuthenticatedContext }> {
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

export function createMediaApiService(): MediaService {
  return new MediaService(
    new PrismaMediaRepository(),
    createObjectStorageProvider(),
    new AuditWriter(new PrismaAuditEventStore()),
  );
}
