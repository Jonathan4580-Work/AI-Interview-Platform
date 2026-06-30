import { z } from "zod";

import { apiSuccess, parseJsonBody, withApiHandler } from "@/server/api";

import { phase12Status, requirePhase12Tenant } from "../../phase12/_shared";

const domainMappingSchema = z.object({
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^(?=.{1,253}$)(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/u),
  ssoConfigurationId: z.string().trim().min(1).max(128),
});

export const GET = withApiHandler(async (request, { requestContext }) => {
  const tenant = await requirePhase12Tenant(request, "sso:read");

  return apiSuccess(requestContext, {
    ...phase12Status("sso_domain_mappings", tenant.companyId),
    verifiedDomainRequired: true,
    tenantDiscoveryUsesVerifiedDomains: true,
  });
});

export const POST = withApiHandler(async (request, { requestContext }) => {
  const tenant = await requirePhase12Tenant(request, "sso:manage", true);
  const body = await parseJsonBody(request, domainMappingSchema);

  return apiSuccess(
    requestContext,
    {
      ...phase12Status("sso_domain_mapping_validation", tenant.companyId),
      accepted: true,
      domain: body.domain,
      ssoConfigurationId: body.ssoConfigurationId,
      verificationRequired: true,
    },
    { status: 202 },
  );
});
