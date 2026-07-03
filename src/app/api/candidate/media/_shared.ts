import { z } from "zod";

import { AuditWriter, PrismaAuditEventStore } from "@/modules/audit";
import {
  MediaDomainError,
  MediaService,
  PrismaMediaRepository,
  createObjectStorageProvider,
  type MediaMutationContext,
  type MediaObjectId,
} from "@/modules/media";

import {
  createCandidateRequestContext,
  enforceCandidateRateLimit,
  requireCandidateSession,
} from "../_shared";

import type { ApiHandlerContext } from "@/server/api";
import type { NextRequest } from "next/server";

export const candidateMediaPurposeSchema = z.enum(["identity_snapshot", "interview_recording"]);
export const checksumSchema = z
  .string()
  .trim()
  .regex(/^[a-f0-9]{64}$/u)
  .nullable()
  .optional();

export async function requireCandidateMediaContext(
  request: NextRequest,
  apiContext: ApiHandlerContext,
): Promise<
  MediaMutationContext & {
    readonly session: Awaited<ReturnType<typeof requireCandidateSession>>;
  }
> {
  await enforceCandidateRateLimit(request, "media", 20);
  const session = await requireCandidateSession(request, apiContext, true);
  return {
    session,
    tenant: { companyId: session.companyId },
    actor: { type: "candidate_session", id: session.sessionId },
    request: {
      requestId: apiContext.requestContext.requestId,
      correlationId: apiContext.requestContext.correlationId,
      sessionId: session.sessionId,
      ipAddress: createCandidateRequestContext(request, apiContext).ipAddress,
      userAgent: request.headers.get("user-agent"),
    },
  };
}

export function createCandidateMediaService(): MediaService {
  return new MediaService(
    new PrismaMediaRepository(),
    createObjectStorageProvider(),
    new AuditWriter(new PrismaAuditEventStore()),
  );
}

export async function assertCandidateOwnsMedia(input: {
  readonly context: MediaMutationContext & {
    readonly session: Awaited<ReturnType<typeof requireCandidateSession>>;
  };
  readonly mediaObjectId: MediaObjectId;
}): Promise<void> {
  const media = await new PrismaMediaRepository().findMedia(
    input.context.tenant,
    input.mediaObjectId,
  );
  if (
    media?.ownerType !== "candidate_session" ||
    media.ownerId !== input.context.session.sessionId
  ) {
    throw new MediaDomainError("Candidate media object was not found.");
  }
}
