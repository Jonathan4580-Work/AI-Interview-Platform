import { z } from "zod";

import { apiSuccess, parseJsonBody, withApiHandler } from "@/server/api";

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
  context: { readonly params: Promise<{ readonly interviewSessionId: string }> },
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
    const { interviewSessionId } = await context.params;
    const body = await parseJsonBody(innerRequest, reprocessSchema);
    const evaluation = await createInternalEvaluationService().reprocessInterview({
      context: phase9Context,
      interviewSessionId: phase9IdSchema.parse(interviewSessionId) as never,
      reason: body.reason,
    });
    return apiSuccess(apiContext.requestContext, { evaluation }, { status: 201 });
  })(request);
}
