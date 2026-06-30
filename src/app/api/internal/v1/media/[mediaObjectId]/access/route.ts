import { z } from "zod";

import { type MediaObjectId } from "@/modules/media";
import { apiSuccess, parseJsonBody, withApiHandler } from "@/server/api";

import { createMediaApiService, requireMediaContext } from "../../_shared";

const accessSchema = z.object({
  contentDisposition: z.string().trim().max(200).nullable().optional(),
});

export const POST = withApiHandler(async (request, { requestContext }) => {
  const context = await requireMediaContext(request, requestContext, "media:read", true);
  const mediaObjectId = request.nextUrl.pathname.split("/").at(-2) as MediaObjectId;
  const body = await parseJsonBody(request, accessSchema);
  const signedUrl = await createMediaApiService().createPlaybackUrl({
    context,
    mediaObjectId,
    contentDisposition: body.contentDisposition ?? null,
  });

  return apiSuccess(requestContext, { signedUrl });
});
