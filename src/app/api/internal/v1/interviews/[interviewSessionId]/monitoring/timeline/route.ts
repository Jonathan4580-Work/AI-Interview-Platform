import { z } from "zod";

import { apiSuccess, parseSearchParams, withApiHandler } from "@/server/api";

import { interviewSessionIdSchema } from "../../../_shared";
import { createInternalMonitoringService, requireMonitoringReadContext } from "../_shared";

import type { InterviewSessionId } from "@/modules/invitations";
import type { NextRequest } from "next/server";

const timelineQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export async function GET(
  request: NextRequest,
  routeContext: { readonly params: Promise<{ readonly interviewSessionId: string }> },
) {
  return withApiHandler(async (innerRequest, context) => {
    const monitoringContext = await requireMonitoringReadContext(innerRequest, context);
    const query = parseSearchParams(innerRequest, timelineQuerySchema);
    const { interviewSessionId } = await routeContext.params;
    const timeline = await createInternalMonitoringService().getTimeline(
      monitoringContext,
      interviewSessionIdSchema.parse(interviewSessionId) as InterviewSessionId,
      query.limit,
    );
    return apiSuccess(context.requestContext, timeline);
  })(request);
}
