import { apiSuccess, withApiHandler } from "@/server/api";

import {
  createCandidateInterviewService,
  requireCandidateInterviewContext,
  sequenceSchema,
} from "../../../_shared";

import type { NextRequest } from "next/server";

export async function POST(
  request: NextRequest,
  routeContext: { readonly params: Promise<{ readonly sequence: string }> },
) {
  return withApiHandler(async (innerRequest, context) => {
    const interviewContext = await requireCandidateInterviewContext(innerRequest, context, true);
    const { sequence } = await routeContext.params;
    const question = await createCandidateInterviewService().startQuestion(
      interviewContext,
      sequenceSchema.parse(sequence),
    );
    return apiSuccess(context.requestContext, question);
  })(request);
}
