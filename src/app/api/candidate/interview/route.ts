import { apiSuccess, withApiHandler } from "@/server/api";

import { createCandidateInterviewService, requireCandidateInterviewContext } from "./_shared";

export const GET = withApiHandler(async (request, context) => {
  const interviewContext = await requireCandidateInterviewContext(request, context);
  const state = await createCandidateInterviewService().getState(interviewContext);
  return apiSuccess(context.requestContext, state);
});
