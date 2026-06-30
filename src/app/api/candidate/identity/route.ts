import { z } from "zod";

import { CandidatePortalService } from "@/modules/candidate-portal";
import { apiSuccess, parseJsonBody, withApiHandler } from "@/server/api";

import {
  createCandidateRequestContext,
  enforceCandidateRateLimit,
  requireCandidateSession,
} from "../_shared";

const snapshotSchema = z.object({
  storageRef: z.string().trim().min(1).max(300),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  sizeBytes: z.number().int().min(1).max(5_000_000),
  checksumSha256: z
    .string()
    .trim()
    .regex(/^[a-fA-F0-9]{64}$/u),
});

const identitySchema = z.object({
  selfAttestedName: z.string().trim().min(1).max(160),
  confirmedName: z.string().trim().min(1).max(160),
  snapshot: snapshotSchema.nullable().optional(),
});

export const POST = withApiHandler(async (request, context) => {
  await enforceCandidateRateLimit(request, "identity", 20);
  const session = await requireCandidateSession(request, context, true);
  const body = await parseJsonBody(request, identitySchema);
  await new CandidatePortalService().submitIdentity({
    session,
    request: createCandidateRequestContext(request, context),
    selfAttestedName: body.selfAttestedName,
    confirmedName: body.confirmedName,
    snapshot: body.snapshot ?? null,
  });
  return apiSuccess(context.requestContext, { saved: true });
});
