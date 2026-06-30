import { z } from "zod";

import {
  assertRegionTransferAllowed,
  createDefaultResidencyPolicy,
  createMigrationPlanningMetadata,
  getRegionStorageConfiguration,
} from "@/modules/data-residency";
import { apiSuccess, parseJsonBody, withApiHandler } from "@/server/api";

import { phase12Status, requirePhase12Tenant } from "../../phase12/_shared";

const regionSchema = z.enum(["US", "EU", "APAC"]);

const transferValidationSchema = z.object({
  primaryRegion: regionSchema.default("US"),
  targetRegion: regionSchema,
  crossRegionTransfersAllowed: z.boolean().default(false),
  purpose: z.enum(["storage", "processing", "support_access", "migration_planning"]),
});

export const GET = withApiHandler(async (request, { requestContext }) => {
  const tenant = await requirePhase12Tenant(request, "data_residency:read");

  return apiSuccess(requestContext, {
    ...phase12Status("data_residency_settings", tenant.companyId),
    supportedRegions: ["US", "EU", "APAC"],
    storageConfigurations: ["US", "EU", "APAC"].map((region) =>
      getRegionStorageConfiguration(region as "US" | "EU" | "APAC"),
    ),
    automaticDataMovementAllowed: false,
  });
});

export const POST = withApiHandler(async (request, { requestContext }) => {
  const tenant = await requirePhase12Tenant(request, "data_residency:manage", true);
  const body = await parseJsonBody(request, transferValidationSchema);
  const policy = {
    ...createDefaultResidencyPolicy(tenant.companyId, body.primaryRegion),
    crossRegionTransfersAllowed: body.crossRegionTransfersAllowed,
  };

  assertRegionTransferAllowed(policy, {
    companyId: tenant.companyId,
    sourceRegion: body.primaryRegion,
    targetRegion: body.targetRegion,
    purpose: body.purpose,
  });

  return apiSuccess(
    requestContext,
    {
      ...phase12Status("data_residency_transfer_validation", tenant.companyId),
      accepted: true,
      migrationPlan: createMigrationPlanningMetadata(policy, body.targetRegion),
    },
    { status: 202 },
  );
});
