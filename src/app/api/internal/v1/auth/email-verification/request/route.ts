import { apiSuccess, withApiHandler } from "@/server/api";
import { getAuthenticatedContext } from "@/server/auth";

import {
  assertCsrfForAuthenticatedMutation,
  authService,
  enforceAuthEndpointRateLimit,
} from "../../_shared";

export const POST = withApiHandler(async (request, { requestContext }) => {
  await enforceAuthEndpointRateLimit(request, "email-verification-request");
  assertCsrfForAuthenticatedMutation(request);
  const auth = await getAuthenticatedContext(request);
  await authService.createEmailVerification({ subject: auth.subject });

  return apiSuccess(requestContext, { accepted: true });
});
