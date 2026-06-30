import { apiSuccess, withApiHandler } from "@/server/api";
import { setAuthCookies } from "@/server/auth";

import {
  assertCsrfForAuthenticatedMutation,
  authService,
  enforceAuthEndpointRateLimit,
  getRequestSecurityContext,
  publicSubject,
  requireRefreshToken,
} from "../_shared";

export const POST = withApiHandler(async (request, { requestContext }) => {
  await enforceAuthEndpointRateLimit(request, "refresh");
  assertCsrfForAuthenticatedMutation(request);
  const issued = await authService.refreshSession({
    refreshToken: requireRefreshToken(request),
    security: getRequestSecurityContext(request),
  });

  const response = apiSuccess(requestContext, {
    subject: publicSubject(issued.session.subject),
    sessionId: issued.session.id,
    expiresAt: issued.session.expiresAt.toISOString(),
  });
  setAuthCookies(response, issued);
  return response;
});
