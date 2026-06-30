import { prisma } from "@/infra/database";
import { apiSuccess, notFound, withApiHandler } from "@/server/api";

import { phase9IdSchema, requirePhase9Context } from "../../phase9/_shared";

import type { NextRequest } from "next/server";

export async function GET(
  request: NextRequest,
  context: { readonly params: Promise<{ readonly interviewSessionId: string }> },
) {
  return withApiHandler(async (innerRequest, apiContext) => {
    const phase9Context = await requirePhase9Context(innerRequest, apiContext, "evaluations:read");
    const { interviewSessionId } = await context.params;
    const evaluation = await prisma.evaluationVersion.findFirst({
      where: {
        companyId: phase9Context.tenant.companyId,
        interviewSessionId: phase9IdSchema.parse(interviewSessionId),
        status: "READY",
      },
      orderBy: { versionNumber: "desc" },
      include: {
        scores: { include: { evidenceCitations: true }, orderBy: { competencyKey: "asc" } },
        observations: true,
        limitations: true,
      },
    });
    if (evaluation === null) {
      throw notFound("Evaluation was not found.");
    }
    return apiSuccess(apiContext.requestContext, { evaluation });
  })(request);
}
