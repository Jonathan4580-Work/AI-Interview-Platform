import { type MediaObjectId } from "@/modules/media";
import { apiSuccess, withApiHandler } from "@/server/api";

import { createMediaApiService, requireMediaContext } from "../../_shared";

export const POST = withApiHandler(async (request, { requestContext }) => {
  const context = await requireMediaContext(request, requestContext, "media:delete", true);
  const mediaObjectId = request.nextUrl.pathname.split("/").at(-2) as MediaObjectId;
  const media = await createMediaApiService().requestDeletion({
    context,
    mediaObjectId,
  });

  return apiSuccess(requestContext, { media });
});
