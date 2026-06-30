import { apiSuccess, withApiHandler } from "@/server/api";

import { createCandidateInterviewService, requireCandidateInterviewContext } from "../_shared";

export const GET = withApiHandler(async (request, context) => {
  const interviewContext = await requireCandidateInterviewContext(request, context);
  const recovery = await createCandidateInterviewService().getUploadRecovery(interviewContext);
  return apiSuccess(context.requestContext, recovery);
});
