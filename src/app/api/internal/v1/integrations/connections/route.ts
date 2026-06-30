import { z } from "zod";

import {
  DevelopmentAtsAdapter,
  integrationConflictPolicies,
  integrationMappingTypes,
  integrationProviders,
} from "@/modules/integrations";
import { apiSuccess, parseJsonBody, withApiHandler } from "@/server/api";

import {
  phase12Status,
  providerNameSchema,
  requirePhase12Tenant,
  secretReferenceSchema,
} from "../../phase12/_shared";

const integrationValidationSchema = z.object({
  provider: z.enum(integrationProviders),
  name: providerNameSchema,
  secretRef: secretReferenceSchema.nullable().optional(),
  conflictPolicy: z.enum(integrationConflictPolicies).default("manual_review"),
  syncMode: z.enum(["polling", "webhook", "manual"]).default("manual"),
});

export const GET = withApiHandler(async (request, { requestContext }) => {
  const tenant = await requirePhase12Tenant(request, "integrations:read");

  return apiSuccess(requestContext, {
    ...phase12Status("integration_connections", tenant.companyId),
    providers: integrationProviders,
    mappingTypes: integrationMappingTypes,
    conflictPolicies: integrationConflictPolicies,
    productionProvidersConfigured: false,
  });
});

export const POST = withApiHandler(async (request, { requestContext }) => {
  const tenant = await requirePhase12Tenant(request, "integrations:manage", true);
  const body = await parseJsonBody(request, integrationValidationSchema);
  const adapter = new DevelopmentAtsAdapter([
    {
      externalId: "dev_job_1",
      resourceType: "job",
      updatedAt: new Date("2026-07-01T00:00:00.000Z"),
      safeFields: { title: "Development Role" },
    },
    {
      externalId: "dev_candidate_1",
      resourceType: "candidate",
      updatedAt: new Date("2026-07-01T00:00:00.000Z"),
      safeFields: { source: "development_fixture" },
    },
  ]);
  const preview = await adapter.fetchPage({
    cursor: {},
    pageNumber: 0,
    recordsProcessed: 0,
    providerRateLimitedUntil: null,
  });

  return apiSuccess(
    requestContext,
    {
      ...phase12Status("integration_connection_validation", tenant.companyId),
      provider: body.provider,
      name: body.name,
      syncMode: body.syncMode,
      conflictPolicy: body.conflictPolicy,
      secretRef: body.secretRef === null || body.secretRef === undefined ? null : "[redacted]",
      developmentPreview: {
        provider: adapter.provider,
        records: preview.records.map((record) => ({
          externalId: record.externalId,
          resourceType: record.resourceType,
          updatedAt: record.updatedAt,
        })),
        nextCursor: preview.nextCursor,
      },
    },
    { status: 202 },
  );
});
