import { apiSuccess, parseJsonBody, withApiHandler } from "@/server/api";

import {
  authService,
  emailVerificationConfirmSchema,
  enforceAuthEndpointRateLimit,
} from "../../_shared";

export const POST = withApiHandler(async (request, { requestContext }) => {
  await enforceAuthEndpointRateLimit(request, "email-verification-confirm");
  const body = await parseJsonBody(request, emailVerificationConfirmSchema);
  await authService.verifyEmail(body.token);

  return apiSuccess(requestContext, { completed: true });
});
