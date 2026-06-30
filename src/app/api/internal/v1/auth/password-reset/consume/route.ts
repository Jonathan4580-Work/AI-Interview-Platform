import { apiSuccess, parseJsonBody, withApiHandler } from "@/server/api";

import {
  authService,
  enforceAuthEndpointRateLimit,
  passwordResetConsumeSchema,
} from "../../_shared";

export const POST = withApiHandler(async (request, { requestContext }) => {
  await enforceAuthEndpointRateLimit(request, "password-reset-consume");
  const body = await parseJsonBody(request, passwordResetConsumeSchema);
  await authService.resetPassword(body);

  return apiSuccess(requestContext, { completed: true });
});
