import { prisma } from "@/infra/database";
import { apiSuccess, notFound, withApiHandler } from "@/server/api";

import { phase9IdSchema, requirePhase9Context } from "../../phase9/_shared";

import type { NextRequest } from "next/server";

export async function GET(
  request: NextRequest,
  context: { readonly params: Promise<{ readonly interviewSessionId: string }> },
) {
  return withApiHandler(async (innerRequest, apiContext) => {
    const phase9Context = await requirePhase9Context(innerRequest, apiContext, "reports:read");
    const { interviewSessionId } = await context.params;
    const report = await prisma.hrReport.findUnique({
      where: {
        companyId_interviewSessionId: {
          companyId: phase9Context.tenant.companyId,
          interviewSessionId: phase9IdSchema.parse(interviewSessionId),
        },
      },
      include: { activeVersion: true },
    });
    if (report?.activeVersion === null || report?.activeVersion === undefined) {
      throw notFound("Report was not found.");
    }
    return apiSuccess(apiContext.requestContext, { report: report.activeVersion });
  })(request);
}
