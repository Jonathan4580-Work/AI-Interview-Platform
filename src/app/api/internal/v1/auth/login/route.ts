import { apiSuccess, parseJsonBody, withApiHandler } from "@/server/api";
import { setAuthCookies } from "@/server/auth";

import type { TenantId } from "@/modules/tenant";

import {
  authService,
  enforceAuthEndpointRateLimit,
  getRequestSecurityContext,
  loginSchema,
  publicSubject,
} from "../_shared";

export const POST = withApiHandler(async (request, { requestContext }) => {
  await enforceAuthEndpointRateLimit(request, "login");
  const body = await parseJsonBody(request, loginSchema);
  const issued =
    body.type === "company"
      ? await authService.authenticateCompanyUser({
          companyId: body.companyId as TenantId,
          email: body.email,
          password: body.password,
          security: getRequestSecurityContext(request),
        })
      : await authService.authenticatePlatformUser({
          email: body.email,
          password: body.password,
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
