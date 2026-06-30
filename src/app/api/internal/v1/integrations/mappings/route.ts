import { z } from "zod";

import {
  createIntegrationMapping,
  integrationConflictPolicies,
  integrationMappingTypes,
} from "@/modules/integrations";
import { apiSuccess, parseJsonBody, withApiHandler } from "@/server/api";

import { phase12Status, requirePhase12Tenant } from "../../phase12/_shared";

const integrationMappingSchema = z.object({
  connectionId: z.string().trim().min(1).max(128),
  mappingType: z.enum(integrationMappingTypes),
  externalId: z.string().trim().min(1).max(240),
  aptlyResourceType: z.string().trim().min(1).max(80),
  aptlyResourceId: z.string().trim().min(1).max(128),
  conflictPolicy: z.enum(integrationConflictPolicies).default("manual_review"),
});

export const GET = withApiHandler(async (request, { requestContext }) => {
  const tenant = await requirePhase12Tenant(request, "integrations:read");

  return apiSuccess(requestContext, {
    ...phase12Status("integration_mappings", tenant.companyId),
    mappingTypes: integrationMappingTypes,
    conflictPolicies: integrationConflictPolicies,
    protectedResourceTypes: ["evaluation", "interview_plan", "human_decision", "audit_event"],
  });
});

export const POST = withApiHandler(async (request, { requestContext }) => {
  const tenant = await requirePhase12Tenant(request, "integrations:manage", true);
  const body = await parseJsonBody(request, integrationMappingSchema);
  const mapping = createIntegrationMapping({
    companyId: tenant.companyId,
    integrationConnectionId: body.connectionId as never,
    mappingType: body.mappingType,
    externalId: body.externalId,
    aptlyResourceType: body.aptlyResourceType,
    aptlyResourceId: body.aptlyResourceId,
    conflictPolicy: body.conflictPolicy,
  });

  return apiSuccess(
    requestContext,
    {
      ...phase12Status("integration_mapping_validation", tenant.companyId),
      mapping,
    },
    { status: 202 },
  );
});
