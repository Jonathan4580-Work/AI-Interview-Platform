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
    const turns = await prisma.interviewTurn.findMany({
      where: { companyId: interviewContext.tenant.companyId, interviewSessionId: parsedId },
      orderBy: [{ sequence: "asc" }, { attemptNumber: "asc" }],
      select: {
        id: true,
        questionStateId: true,
        sequence: true,
        attemptNumber: true,
        speaker: true,
        status: true,
        content: true,
        startedAt: true,
        endedAt: true,
        confirmedAt: true,
        createdAt: true,
      },
    });
    return apiSuccess(context.requestContext, { turns });
  })(request);
}
