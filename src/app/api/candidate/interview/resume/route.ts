import { apiSuccess, withApiHandler } from "@/server/api";

import { createCandidateInterviewService, requireCandidateInterviewContext } from "../_shared";

export const POST = withApiHandler(async (request, context) => {
  const interviewContext = await requireCandidateInterviewContext(request, context, true);
  const state = await createCandidateInterviewService().resumeInterview(interviewContext);
  return apiSuccess(context.requestContext, state);
});
