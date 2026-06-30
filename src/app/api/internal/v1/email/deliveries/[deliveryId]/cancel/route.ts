import { apiSuccess, withApiHandler } from "@/server/api";

import { emailActorFromAuth, requireEmailTenant } from "../../../_shared";
import { createEmailApiService } from "../../route";

export const POST = withApiHandler(async (request, { requestContext }) => {
  const { auth, tenant } = await requireEmailTenant(request, "email_deliveries:manage", true);
  const deliveryId = request.nextUrl.pathname.split("/").at(-2);
  const delivery = await createEmailApiService().cancelDelivery({
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
    deliveryId: deliveryId as never,
  });

  return apiSuccess(requestContext, { delivery });
});
