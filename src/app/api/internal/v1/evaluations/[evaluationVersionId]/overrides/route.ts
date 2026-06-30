import { z } from "zod";

import { apiSuccess, parseJsonBody, withApiHandler } from "@/server/api";

import {
  createInternalEvaluationService,
  phase9IdSchema,
  requirePhase9Context,
} from "../../../phase9/_shared";

import type { NextRequest } from "next/server";

const overrideSchema = z.object({
  target: z.enum(["overall", "competency"]),
  competencyScoreId: z.string().trim().min(1).max(128).nullable().optional(),
  newScore: z.number().min(1).max(5),
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
    const body = await parseJsonBody(innerRequest, overrideSchema);
    const override = await createInternalEvaluationService().createOverride({
      context: phase9Context,
      evaluationVersionId: phase9IdSchema.parse(evaluationVersionId) as never,
      target: body.target,
      competencyScoreId:
        body.competencyScoreId === null || body.competencyScoreId === undefined
          ? null
          : (phase9IdSchema.parse(body.competencyScoreId) as never),
      newScore: body.newScore,
      reason: body.reason,
    });
    return apiSuccess(apiContext.requestContext, { override }, { status: 201 });
  })(request);
}
