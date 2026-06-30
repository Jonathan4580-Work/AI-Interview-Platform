import { z } from "zod";

import { MediaDomainError } from "@/modules/media";
import { apiSuccess, parseJsonBody, withApiHandler } from "@/server/api";

import {
  candidateMediaPurposeSchema,
  checksumSchema,
  createCandidateMediaService,
  requireCandidateMediaContext,
} from "./_shared";

const prepareSchema = z.object({
  purpose: candidateMediaPurposeSchema,
  mimeType: z.string().trim().min(3).max(120),
  sizeBytes: z.coerce.bigint().positive(),
  checksumSha256: checksumSchema,
  kind: z.enum(["single_part", "multipart"]).default("single_part"),
  partCount: z.coerce.number().int().min(1).max(10_000).nullable().optional(),
  idempotencyKey: z.string().trim().min(1).max(180),
});

export const POST = withApiHandler(async (request, apiContext) => {
  const context = await requireCandidateMediaContext(request, apiContext);
  const body = await parseJsonBody(request, prepareSchema);
  const subject = resolveCandidateMediaSubject(context, body.purpose);
  const prepared = await createCandidateMediaService().prepareUpload({
    context,
    ownerType: "candidate_session",
    ownerId: context.session.sessionId,
    subjectType: subject.type,
    subjectId: subject.id,
    purpose: body.purpose,
    mimeType: body.mimeType,
    sizeBytes: body.sizeBytes,
    checksumSha256: body.checksumSha256 ?? null,
    kind: body.kind,
    partCount: body.partCount ?? null,
    idempotencyKey: `candidate:${context.session.sessionId}:${body.idempotencyKey}`,
  });

  return apiSuccess(apiContext.requestContext, prepared, { status: 201 });
});

function resolveCandidateMediaSubject(
  context: Awaited<ReturnType<typeof requireCandidateMediaContext>>,
  purpose: "identity_snapshot" | "interview_recording",
) {
  if (purpose === "identity_snapshot") {
    return { type: "candidate_session" as const, id: context.session.sessionId };
  }
  if (context.session.interviewSessionId === null) {
    throw new MediaDomainError("Interview recording upload is not available yet.");
  }
  return { type: "interview_session" as const, id: context.session.interviewSessionId };
}
