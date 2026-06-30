import { z } from "zod";

import { type MediaObjectId, type MediaUploadSessionId } from "@/modules/media";
import { apiSuccess, parseJsonBody, withApiHandler } from "@/server/api";

import { createMediaApiService, requireMediaContext } from "../../_shared";

const abortSchema = z.object({
  uploadSessionId: z.string().trim().min(1).max(128),
});

export const POST = withApiHandler(async (request, { requestContext }) => {
  const context = await requireMediaContext(request, requestContext, "media:manage", true);
  const mediaObjectId = request.nextUrl.pathname.split("/").at(-2) as MediaObjectId;
  const body = await parseJsonBody(request, abortSchema);
  const uploadSession = await createMediaApiService().abortUpload({
    context,
    mediaObjectId,
    uploadSessionId: body.uploadSessionId as MediaUploadSessionId,
  });

  return apiSuccess(requestContext, { uploadSession });
});
