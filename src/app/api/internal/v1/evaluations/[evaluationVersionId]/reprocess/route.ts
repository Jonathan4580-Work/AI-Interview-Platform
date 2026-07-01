import { z } from "zod";

import { prisma } from "@/infra/database";
import { apiSuccess, notFound, parseJsonBody, withApiHandler } from "@/server/api";

import {
  createInternalEvaluationService,
  phase9IdSchema,
  requirePhase9Context,
} from "../../../phase9/_shared";

import type { NextRequest } from "next/server";

const reprocessSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export async function POST(
  request: NextRequest,
  context: { readonly params: Promise<{ readonly evaluationVersionId: string }> },
) {
  return withApiHandler(async (innerRequest, apiContext) => {
    const phase9Context = await requirePhase9Context(
      innerRequest,
      apiContext,
      "evaluations:manage",
      {
        mutation: true,
      },
    );
    const { evaluationVersionId } = await context.params;
    const parsedEvaluationVersionId = phase9IdSchema.parse(evaluationVersionId);
    const existingEvaluation = await prisma.evaluationVersion.findFirst({
      where: {
        companyId: phase9Context.tenant.companyId,
        id: parsedEvaluationVersionId,
      },
      select: { interviewSessionId: true },
    });
    if (existingEvaluation === null) {
      throw notFound("Evaluation was not found.");
    }

    const body = await parseJsonBody(innerRequest, reprocessSchema);
    const evaluation = await createInternalEvaluationService().reprocessInterview({
      context: phase9Context,
      interviewSessionId: phase9IdSchema.parse(existingEvaluation.interviewSessionId) as never,
      reason: body.reason,
    });
    return apiSuccess(apiContext.requestContext, { evaluation }, { status: 201 });
  })(request);
}
