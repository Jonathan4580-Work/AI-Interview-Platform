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
    const recordings = await prisma.interviewTurnMedia.findMany({
      where: { companyId: interviewContext.tenant.companyId, interviewSessionId: parsedId },
      orderBy: [{ interviewTurnId: "asc" }, { chunkSequence: "asc" }],
      include: {
        mediaObject: {
          select: {
            id: true,
            purpose: true,
            mimeType: true,
            sizeBytes: true,
            uploadStatus: true,
            processingStatus: true,
            completedAt: true,
            retentionDeleteAt: true,
          },
        },
      },
    });
    return apiSuccess(context.requestContext, { recordings });
  })(request);
}
