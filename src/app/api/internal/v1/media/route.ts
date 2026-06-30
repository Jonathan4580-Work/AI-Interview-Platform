import { z } from "zod";

import { PrismaMediaRepository } from "@/modules/media";
import { apiSuccess, parseJsonBody, parseSearchParams, withApiHandler } from "@/server/api";

import {
  checksumSchema,
  createMediaApiService,
  mediaOwnerTypeSchema,
  mediaPurposeSchema,
  requireMediaContext,
  uploadKindSchema,
} from "./_shared";

const listQuerySchema = z.object({
  purpose: mediaPurposeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().min(1).max(128).optional(),
});

const prepareSchema = z.object({
  ownerType: mediaOwnerTypeSchema,
  ownerId: z.string().trim().min(1).max(180),
  subjectType: mediaOwnerTypeSchema,
  subjectId: z.string().trim().min(1).max(180),
  purpose: mediaPurposeSchema,
  mimeType: z.string().trim().min(3).max(120),
  sizeBytes: z.coerce.bigint().positive(),
  checksumSha256: checksumSchema,
  kind: uploadKindSchema.default("single_part"),
  partCount: z.coerce.number().int().min(1).max(10_000).nullable().optional(),
  idempotencyKey: z.string().trim().min(1).max(180),
});

export const GET = withApiHandler(async (request, { requestContext }) => {
  const context = await requireMediaContext(request, requestContext, "media:read");
  const query = parseSearchParams(request, listQuerySchema);
  const media = await new PrismaMediaRepository().listMedia({
    tenant: context.tenant,
    purpose: query.purpose,
    limit: query.limit,
    cursor: query.cursor,
  });

  return apiSuccess(requestContext, { media });
});

export const POST = withApiHandler(async (request, { requestContext }) => {
  const context = await requireMediaContext(request, requestContext, "media:manage", true);
  const body = await parseJsonBody(request, prepareSchema);
  const prepared = await createMediaApiService().prepareUpload({
    context,
    ownerType: body.ownerType,
    ownerId: body.ownerId,
    subjectType: body.subjectType,
    subjectId: body.subjectId,
    purpose: body.purpose,
    mimeType: body.mimeType,
    sizeBytes: body.sizeBytes,
    checksumSha256: body.checksumSha256 ?? null,
    kind: body.kind,
    partCount: body.partCount ?? null,
    idempotencyKey: body.idempotencyKey,
  });

  return apiSuccess(requestContext, prepared, { status: 201 });
});
