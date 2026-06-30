import { z } from "zod";

import {
  createOAuthTransientState,
  ssoLoginPolicies,
  ssoProviders,
  validateRedirectUri,
} from "@/modules/sso";
import { apiSuccess, parseJsonBody, withApiHandler } from "@/server/api";

import { phase12Status, requirePhase12Tenant, secretReferenceSchema } from "../../phase12/_shared";

const ssoValidationSchema = z.object({
  provider: z.enum(ssoProviders),
  loginPolicy: z.enum(ssoLoginPolicies),
  issuerUrl: z.string().trim().url().max(2_048),
  clientId: z.string().trim().min(1).max(240),
  clientSecretRef: secretReferenceSchema,
  redirectUri: z.string().trim().url().max(2_048),
  allowedRedirectOrigins: z.array(z.string().trim().url().max(2_048)).min(1).max(10),
});

export const GET = withApiHandler(async (request, { requestContext }) => {
  const tenant = await requirePhase12Tenant(request, "sso:read");

  return apiSuccess(requestContext, {
    ...phase12Status("sso_configuration", tenant.companyId),
    providers: ssoProviders,
    loginPolicies: ssoLoginPolicies,
    supportedProtections: {
      state: true,
      nonce: true,
      pkce: true,
      breakGlassCompanyAdmin: true,
      samlAdapterPlaceholder: true,
    },
  });
});

export const POST = withApiHandler(async (request, { requestContext }) => {
  const tenant = await requirePhase12Tenant(request, "sso:manage", true);
  const body = await parseJsonBody(request, ssoValidationSchema);

  validateRedirectUri({
    redirectUri: body.redirectUri,
    allowedOrigins: body.allowedRedirectOrigins.map((origin) => new URL(origin).origin),
  });
  const transientState = createOAuthTransientState();

  return apiSuccess(
    requestContext,
    {
      ...phase12Status("sso_configuration_validation", tenant.companyId),
      provider: body.provider,
      loginPolicy: body.loginPolicy,
      clientSecretRef: "[redacted]",
      pkceChallengeMethod: "S256",
      stateLength: transientState.state.length,
      nonceLength: transientState.nonce.length,
      codeVerifierLength: transientState.codeVerifier.length,
    },
    { status: 202 },
  );
});
