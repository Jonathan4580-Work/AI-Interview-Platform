import { apiSuccess, withApiHandler } from "@/server/api";

import { createCandidateInterviewService, requireCandidateInterviewContext } from "../_shared";

export const POST = withApiHandler(async (request, context) => {
  const interviewContext = await requireCandidateInterviewContext(request, context, true);
  const result = await createCandidateInterviewService().startInterview(interviewContext);
  return apiSuccess(context.requestContext, result, { status: result.created ? 201 : 200 });
});
