import { z } from "zod";

import { createScimBearerToken, hashScimBearerToken, parseScimPagination } from "@/modules/scim";
import { apiSuccess, parseJsonBody, withApiHandler } from "@/server/api";

import { phase12Status, requirePhase12Tenant, secretReferenceSchema } from "../../phase12/_shared";

const scimValidationSchema = z.object({
  tokenSecretRef: secretReferenceSchema.optional(),
  externalTenantRef: z.string().trim().min(1).max(240).optional(),
  provisioningEnabled: z.boolean().default(false),
  deprovisionRevokesSessions: z.boolean().default(true),
  pagination: z
    .object({
      startIndex: z.number().int().min(1).max(10_000).optional(),
      count: z.number().int().min(1).max(500).optional(),
    })
    .strict()
    .optional(),
});

export const GET = withApiHandler(async (request, { requestContext }) => {
  const tenant = await requirePhase12Tenant(request, "scim:read");

  return apiSuccess(requestContext, {
    ...phase12Status("scim_configuration", tenant.companyId),
    scimVersion: "2.0",
    supportedResources: ["User", "Group"],
    tokenStorage: "hashed_or_secret_reference",
    platformAdminProvisioningAllowed: false,
  });
});

export const POST = withApiHandler(async (request, { requestContext }) => {
  const tenant = await requirePhase12Tenant(request, "scim:manage", true);
  const body = await parseJsonBody(request, scimValidationSchema);
  const generatedToken = createScimBearerToken();
  const tokenHash = hashScimBearerToken(generatedToken);
  const pagination = parseScimPagination(body.pagination ?? {});
  const [tokenHashAlgorithm] = tokenHash.split(":");

  return apiSuccess(
    requestContext,
    {
      ...phase12Status("scim_configuration_validation", tenant.companyId),
      accepted: true,
      tokenHashAlgorithm,
      tokenSecretRef: body.tokenSecretRef === undefined ? null : "[redacted]",
      provisioningEnabled: body.provisioningEnabled,
      deprovisionRevokesSessions: body.deprovisionRevokesSessions,
      pagination,
    },
    { status: 202 },
  );
});
