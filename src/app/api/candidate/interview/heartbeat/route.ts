import { z } from "zod";

import { apiSuccess, parseJsonBody, withApiHandler } from "@/server/api";

import { createCandidateInterviewService, requireCandidateInterviewContext } from "../_shared";

const heartbeatSchema = z.object({
  connectionState: z.enum(["ok", "degraded", "lost"]).default("ok"),
});

export const POST = withApiHandler(async (request, context) => {
  const interviewContext = await requireCandidateInterviewContext(request, context, true);
  const body = await parseJsonBody(request, heartbeatSchema);
  const session = await createCandidateInterviewService().heartbeat({
    context: interviewContext,
    connectionState: body.connectionState,
  });
  return apiSuccess(context.requestContext, { session });
});
