import { prisma } from "@/infra/database";
import { apiSuccess, withApiHandler } from "@/server/api";

import { interviewSessionIdSchema, requireInterviewReadContext } from "../../_shared";

import type { NextRequest } from "next/server";

export async function GET(
  request: NextRequest,
  routeContext: { readonly params: Promise<{ readonly interviewSessionId: string }> },
) {
  return withApiHandler(async (innerRequest, context) => {
    const interviewContext = await requireInterviewReadContext(innerRequest, context);
    const { interviewSessionId } = await routeContext.params;
    const parsedId = interviewSessionIdSchema.parse(interviewSessionId);
    const events = await prisma.interviewActivityEvent.findMany({
      where: { companyId: interviewContext.tenant.companyId, interviewSessionId: parsedId },
      orderBy: { occurredAt: "desc" },
      take: 100,
      select: {
        id: true,
        type: true,
        occurredAt: true,
        metadataJson: true,
        createdAt: true,
      },
    });
    return apiSuccess(context.requestContext, { events });
  })(request);
}
