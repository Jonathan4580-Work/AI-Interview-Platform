import { apiSuccess, withApiHandler } from "@/server/api";

import { createPasswordResetFromRequest, enforceAuthEndpointRateLimit } from "../../_shared";

export const POST = withApiHandler(async (request, { requestContext }) => {
  await enforceAuthEndpointRateLimit(request, "password-reset-request");
  await createPasswordResetFromRequest(request);

  return apiSuccess(requestContext, { accepted: true });
});
