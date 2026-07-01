import { z } from "zod";

import { prisma } from "@/infra/database";
import { apiSuccess, parseJsonBody, withApiHandler } from "@/server/api";

import {
  assertTenantEmailEnabled,
  createEmailApiService,
  emailActorFromAuth,
  emailAddressSchema,
  emailTemplateKeySchema,
  requireEmailTenant,
} from "../_shared";

const deliveryCreateSchema = z.object({
  templateKey: emailTemplateKeySchema,
  templateVariables: z.record(z.union([z.string(), z.number(), z.null()])),
  recipientEmail: emailAddressSchema,
  recipientName: z.string().trim().max(160).nullable().optional(),
  notificationIntentId: z.string().trim().min(1).max(128).nullable().optional(),
  smtpProfileId: z.string().trim().min(1).max(128).nullable().optional(),
  provider: z.enum(["smtp", "preview"]).default("preview"),
  idempotencyKey: z.string().trim().max(160).nullable().optional(),
  queue: z.boolean().default(false),
});

export const GET = withApiHandler(async (request, { requestContext }) => {
  const { tenant } = await requireEmailTenant(request, "email_deliveries:read");
  const deliveries = await prisma.emailDelivery.findMany({
    where: { companyId: tenant.companyId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return apiSuccess(requestContext, { deliveries });
});

export const POST = withApiHandler(async (request, { requestContext }) => {
  const { auth, tenant } = await requireEmailTenant(request, "email_deliveries:manage", true);
  await assertTenantEmailEnabled(tenant.companyId);
  const body = await parseJsonBody(request, deliveryCreateSchema);
  const service = createEmailApiService();
  const delivery = await service.createDelivery({
    context: {
      tenant,
      actor: emailActorFromAuth(auth),
      request: {
        requestId: requestContext.requestId,
        correlationId: requestContext.correlationId,
        sessionId: auth.session.id,
        ipAddress: request.headers.get("x-forwarded-for"),
        userAgent: request.headers.get("user-agent"),
      },
    },
    templateKey: body.templateKey.toLowerCase() as never,
    templateVariables: body.templateVariables,
    recipientEmail: body.recipientEmail,
    recipientName: body.recipientName ?? null,
    notificationIntentId: body.notificationIntentId ?? null,
    smtpProfileId: body.smtpProfileId ?? null,
    provider: body.provider,
    idempotencyKey: body.idempotencyKey ?? null,
  });
  const queued = body.queue
    ? await service.enqueueDelivery({
        context: {
          tenant,
          actor: emailActorFromAuth(auth),
          request: {
            requestId: requestContext.requestId,
            correlationId: requestContext.correlationId,
            sessionId: auth.session.id,
            ipAddress: request.headers.get("x-forwarded-for"),
            userAgent: request.headers.get("user-agent"),
          },
        },
        deliveryId: delivery.id,
      })
    : delivery;

  return apiSuccess(requestContext, { delivery: queued }, { status: 201 });
});
