import { PrismaMediaRepository, type MediaObjectId } from "@/modules/media";
import { apiSuccess, withApiHandler } from "@/server/api";

import { requireMediaContext } from "../_shared";

export const GET = withApiHandler(async (request, { requestContext }) => {
  const context = await requireMediaContext(request, requestContext, "media:read");
  const mediaObjectId = request.nextUrl.pathname.split("/").at(-1) as MediaObjectId;
  const media = await new PrismaMediaRepository().findMedia(context.tenant, mediaObjectId);

  return apiSuccess(requestContext, { media });
});
