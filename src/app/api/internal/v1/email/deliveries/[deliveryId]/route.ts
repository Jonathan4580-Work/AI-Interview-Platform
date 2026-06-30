import { prisma } from "@/infra/database";
import { apiSuccess, withApiHandler } from "@/server/api";

import { requireEmailTenant } from "../../_shared";

export const GET = withApiHandler(async (request, { requestContext }) => {
  const { tenant } = await requireEmailTenant(request, "email_deliveries:read");
  const deliveryId = request.nextUrl.pathname.split("/").at(-1);
  const delivery = await prisma.emailDelivery.findFirstOrThrow({
    where: { companyId: tenant.companyId, id: deliveryId },
    include: {
      attempts: {
        orderBy: { attemptNumber: "asc" },
      },
      events: {
        orderBy: { occurredAt: "desc" },
      },
    },
  });

  return apiSuccess(requestContext, { delivery });
});
