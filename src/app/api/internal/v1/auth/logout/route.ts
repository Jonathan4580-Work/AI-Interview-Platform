import { apiSuccess, withApiHandler } from "@/server/api";
import { clearAuthCookies } from "@/server/auth";

import {
  assertCsrfForAuthenticatedMutation,
  authService,
  enforceAuthEndpointRateLimit,
  requireSessionToken,
} from "../_shared";

export const POST = withApiHandler(async (request, { requestContext }) => {
  await enforceAuthEndpointRateLimit(request, "logout");
  assertCsrfForAuthenticatedMutation(request);
  await authService.revokeSession(requireSessionToken(request));

  const response = apiSuccess(requestContext, { revoked: true });
  clearAuthCookies(response);
  return response;
});
