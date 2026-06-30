import { z } from "zod";

import { type MediaObjectId, type MediaUploadSessionId } from "@/modules/media";
import { apiSuccess, parseJsonBody, withApiHandler } from "@/server/api";

import {
  assertCandidateOwnsMedia,
  createCandidateMediaService,
  requireCandidateMediaContext,
} from "../../_shared";

const abortSchema = z.object({
  uploadSessionId: z.string().trim().min(1).max(128),
});

export const POST = withApiHandler(async (request, apiContext) => {
  const context = await requireCandidateMediaContext(request, apiContext);
  const mediaObjectId = request.nextUrl.pathname.split("/").at(-2) as MediaObjectId;
  await assertCandidateOwnsMedia({ context, mediaObjectId });
  const body = await parseJsonBody(request, abortSchema);
  const uploadSession = await createCandidateMediaService().abortUpload({
    context,
    mediaObjectId,
    uploadSessionId: body.uploadSessionId as MediaUploadSessionId,
  });

  return apiSuccess(apiContext.requestContext, { uploadSession });
});
