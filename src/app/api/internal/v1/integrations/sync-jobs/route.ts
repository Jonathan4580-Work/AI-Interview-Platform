import { z } from "zod";

import {
  advanceSyncCheckpoint,
  assertSafeIntegrationSyncPayload,
  createInitialSyncCheckpoint,
} from "@/modules/integrations";
import { apiSuccess, parseJsonBody, withApiHandler } from "@/server/api";

import { phase12Status, requirePhase12Tenant } from "../../phase12/_shared";

const syncJobValidationSchema = z.object({
  connectionId: z.string().trim().min(1).max(128),
  syncJobId: z.string().trim().min(1).max(128),
  operation: z.enum(["sync_page", "replay", "cancel"]),
  idempotencyKey: z.string().trim().min(8).max(160),
});

export const GET = withApiHandler(async (request, { requestContext }) => {
  const tenant = await requirePhase12Tenant(request, "integration_syncs:read");

  return apiSuccess(requestContext, {
    ...phase12Status("integration_sync_jobs", tenant.companyId),
    supportedOperations: ["sync_page", "replay", "cancel"],
    workflowBacked: true,
    queuePayloadsContainIdsOnly: true,
  });
});

export const POST = withApiHandler(async (request, { requestContext }) => {
  const tenant = await requirePhase12Tenant(request, "integration_syncs:manage", true);
  const body = await parseJsonBody(request, syncJobValidationSchema);
  const checkpoint = advanceSyncCheckpoint({
    checkpoint: createInitialSyncCheckpoint(),
    nextCursor: { page: 2 },
    recordsProcessed: 2,
    providerRateLimitedUntil: null,
  });

  assertSafeIntegrationSyncPayload({
    companyId: tenant.companyId,
    requestId: requestContext.requestId,
    correlationId: requestContext.correlationId,
    integrationConnectionId: body.connectionId as never,
    syncJobId: body.syncJobId,
  });

  return apiSuccess(
    requestContext,
    {
      ...phase12Status("integration_sync_job_validation", tenant.companyId),
      accepted: true,
      idempotencyKey: body.idempotencyKey,
      checkpoint,
    },
    { status: 202 },
  );
});
