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
    const checkpoints = await prisma.interviewRecoveryCheckpoint.findMany({
      where: {
        companyId: interviewContext.tenant.companyId,
        interviewSessionId: parsedId,
        type: "UPLOAD",
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        checkpointJson: true,
        expiresAt: true,
        resolvedAt: true,
        createdAt: true,
      },
    });
    return apiSuccess(context.requestContext, { checkpoints });
  })(request);
}
