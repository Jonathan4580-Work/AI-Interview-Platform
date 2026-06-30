import { apiSuccess, withApiHandler } from "@/server/api";

import { interviewSessionIdSchema } from "../../../_shared";
import { createInternalMonitoringService, requireMonitoringReadContext } from "../_shared";

import type { InterviewSessionId } from "@/modules/invitations";
import type { NextRequest } from "next/server";

export async function GET(
  request: NextRequest,
  routeContext: { readonly params: Promise<{ readonly interviewSessionId: string }> },
) {
  return withApiHandler(async (innerRequest, context) => {
    const monitoringContext = await requireMonitoringReadContext(innerRequest, context);
    const { interviewSessionId } = await routeContext.params;
    const summary = await createInternalMonitoringService().getSummary(
      monitoringContext,
      interviewSessionIdSchema.parse(interviewSessionId) as InterviewSessionId,
    );
    return apiSuccess(context.requestContext, summary);
  })(request);
}
