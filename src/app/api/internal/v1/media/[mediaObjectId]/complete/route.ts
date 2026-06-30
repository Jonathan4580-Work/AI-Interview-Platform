import { z } from "zod";

import { type MediaObjectId, type MediaUploadSessionId } from "@/modules/media";
import { apiSuccess, parseJsonBody, withApiHandler } from "@/server/api";

import { checksumSchema, createMediaApiService, requireMediaContext } from "../../_shared";

const completeSchema = z.object({
  uploadSessionId: z.string().trim().min(1).max(128),
  parts: z
    .array(
      z.object({
        partNumber: z.coerce.number().int().min(1).max(10_000),
        etag: z.string().trim().min(1).max(200),
        checksumSha256: checksumSchema,
        sizeBytes: z.coerce.bigint().positive().nullable().optional(),
      }),
    )
    .optional(),
});

export const POST = withApiHandler(async (request, { requestContext }) => {
  const context = await requireMediaContext(request, requestContext, "media:manage", true);
  const mediaObjectId = request.nextUrl.pathname.split("/").at(-2) as MediaObjectId;
  const body = await parseJsonBody(request, completeSchema);
  const media = await createMediaApiService().completeUpload({
    context,
    mediaObjectId,
    uploadSessionId: body.uploadSessionId as MediaUploadSessionId,
    parts: body.parts?.map((part) => ({
      partNumber: part.partNumber,
      etag: part.etag,
      checksumSha256: part.checksumSha256 ?? null,
      sizeBytes: part.sizeBytes ?? null,
    })),
  });

  return apiSuccess(requestContext, { media });
});
