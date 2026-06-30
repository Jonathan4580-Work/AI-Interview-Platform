import { z } from "zod";

import { apiSuccess, parseJsonBody, withApiHandler } from "@/server/api";

import {
  createInternalEvaluationService,
  phase9IdSchema,
  requirePhase9Context,
} from "../../../phase9/_shared";

import type { NextRequest } from "next/server";

const reviewSchema = z.object({
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
    const body = await parseJsonBody(innerRequest, reviewSchema);
    const evaluation = await createInternalEvaluationService().markReviewed({
      context: phase9Context,
      evaluationVersionId: phase9IdSchema.parse(evaluationVersionId) as never,
      reason: body.reason,
    });
    return apiSuccess(apiContext.requestContext, { evaluation });
  })(request);
}
