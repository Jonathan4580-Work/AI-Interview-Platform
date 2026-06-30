import { apiSuccess, withApiHandler } from "@/server/api";

import { createCandidateInterviewService, requireCandidateInterviewContext } from "../_shared";

export const POST = withApiHandler(async (request, context) => {
  const interviewContext = await requireCandidateInterviewContext(request, context, true);
  const session = await createCandidateInterviewService().completeInterview(interviewContext);
  return apiSuccess(context.requestContext, { session });
});
