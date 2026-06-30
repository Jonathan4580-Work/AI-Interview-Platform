import { prisma } from "@/infra/database";
import { apiSuccess, notFound, withApiHandler } from "@/server/api";

import { phase9IdSchema, requirePhase9Context } from "../../phase9/_shared";

import type { NextRequest } from "next/server";

export async function GET(
  request: NextRequest,
  context: { readonly params: Promise<{ readonly interviewSessionId: string }> },
) {
  return withApiHandler(async (innerRequest, apiContext) => {
    const phase9Context = await requirePhase9Context(innerRequest, apiContext, "transcripts:read");
    const { interviewSessionId } = await context.params;
    const transcript = await prisma.transcript.findUnique({
      where: {
        companyId_interviewSessionId: {
          companyId: phase9Context.tenant.companyId,
          interviewSessionId: phase9IdSchema.parse(interviewSessionId),
        },
      },
      select: {
        id: true,
        interviewSessionId: true,
        status: true,
        activeVersionId: true,
        language: true,
        provider: true,
        providerModel: true,
        providerVersion: true,
        transcriptQuality: true,
        reviewedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (transcript === null) {
      throw notFound("Transcript was not found.");
    }
    return apiSuccess(apiContext.requestContext, { transcript });
  })(request);
}
