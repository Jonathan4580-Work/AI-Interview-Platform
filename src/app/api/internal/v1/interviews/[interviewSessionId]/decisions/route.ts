import { z } from "zod";

import { apiSuccess, parseJsonBody, withApiHandler } from "@/server/api";

import {
  createInternalEvaluationService,
  phase9IdSchema,
  requirePhase9Context,
} from "../../../phase9/_shared";

import type { NextRequest } from "next/server";

const decisionSchema = z.object({
  decision: z.enum(["advance", "hold", "reject", "undecided"]),
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
      "candidate_decisions:manage",
      { mutation: true },
    );
    const { interviewSessionId } = await context.params;
    const body = await parseJsonBody(innerRequest, decisionSchema);
    const decision = await createInternalEvaluationService().recordHumanDecision({
      context: phase9Context,
      interviewSessionId: phase9IdSchema.parse(interviewSessionId) as never,
      decision: body.decision,
      reason: body.reason,
    });
    return apiSuccess(apiContext.requestContext, { decision }, { status: 201 });
  })(request);
}
