import { z } from "zod";

import { nextWebhookAttemptAt } from "@/modules/webhooks";
import { apiSuccess, parseJsonBody, withApiHandler } from "@/server/api";

import { phase12Status, requirePhase12Tenant } from "../../phase12/_shared";

const deliveryRetrySchema = z.object({
  deliveryId: z.string().trim().min(1).max(128),
  reason: z.string().trim().min(8).max(500),
  attemptCount: z.number().int().min(0).max(20).default(0),
});

export const GET = withApiHandler(async (request, { requestContext }) => {
  const tenant = await requirePhase12Tenant(request, "webhooks:read");

  return apiSuccess(requestContext, {
    ...phase12Status("webhook_deliveries", tenant.companyId),
    statuses: ["pending", "queued", "sending", "succeeded", "retry_scheduled", "failed"],
    payloadProjection: "allowlisted_event_schema_only",
    signedBodiesLogged: false,
  });
});

export const POST = withApiHandler(async (request, { requestContext }) => {
  const tenant = await requirePhase12Tenant(request, "webhooks:manage", true);
  const body = await parseJsonBody(request, deliveryRetrySchema);

  return apiSuccess(
    requestContext,
    {
      ...phase12Status("webhook_delivery_retry", tenant.companyId),
      deliveryId: body.deliveryId,
      retryAccepted: true,
      reasonRecorded: true,
      nextAttemptAt: nextWebhookAttemptAt({ attemptCount: body.attemptCount }),
    },
    { status: 202 },
  );
});
