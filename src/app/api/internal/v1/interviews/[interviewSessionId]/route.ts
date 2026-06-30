import { apiSuccess, withApiHandler } from "@/server/api";

import {
  createInternalInterviewService,
  interviewSessionIdSchema,
  requireInterviewReadContext,
} from "../_shared";

import type { InterviewSessionId } from "@/modules/invitations";
import type { NextRequest } from "next/server";

export async function GET(
  request: NextRequest,
  routeContext: { readonly params: Promise<{ readonly interviewSessionId: string }> },
) {
  return withApiHandler(async (innerRequest, context) => {
    const interviewContext = await requireInterviewReadContext(innerRequest, context);
    const { interviewSessionId } = await routeContext.params;
    const state = await createInternalInterviewService().inspectInterview(
      interviewContext,
      interviewSessionIdSchema.parse(interviewSessionId) as InterviewSessionId,
    );
    return apiSuccess(context.requestContext, state);
  })(request);
}
