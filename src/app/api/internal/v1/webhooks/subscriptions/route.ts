import { z } from "zod";

import { externallyDeliverableEventKeys, validateWebhookEndpoint } from "@/modules/webhooks";
import { apiSuccess, parseJsonBody, withApiHandler } from "@/server/api";

import { phase12Status, requirePhase12Tenant, secretReferenceSchema } from "../../phase12/_shared";

const webhookValidationSchema = z.object({
  endpointUrl: z.string().trim().url().max(2_048),
  signingSecretRef: secretReferenceSchema,
  productionMode: z.boolean().default(false),
  subscribedEventKeys: z.array(z.enum(externallyDeliverableEventKeys)).min(1).max(20),
});

export const GET = withApiHandler(async (request, { requestContext }) => {
  const tenant = await requirePhase12Tenant(request, "webhooks:read");

  return apiSuccess(requestContext, {
    ...phase12Status("webhook_subscriptions", tenant.companyId),
    supportedEventKeys: externallyDeliverableEventKeys,
    requirements: {
      hmacSignature: true,
      timestampReplayProtection: true,
      endpointVerification: true,
      arbitraryPayloadForwarding: false,
    },
  });
});

export const POST = withApiHandler(async (request, { requestContext }) => {
  const tenant = await requirePhase12Tenant(request, "webhooks:manage", true);
  const body = await parseJsonBody(request, webhookValidationSchema);

  validateWebhookEndpoint(body.endpointUrl, { production: body.productionMode });

  return apiSuccess(
    requestContext,
    {
      ...phase12Status("webhook_subscription_validation", tenant.companyId),
      accepted: true,
      subscribedEventKeys: body.subscribedEventKeys,
      signingSecretRef: "[redacted]",
    },
    { status: 202 },
  );
});
