import { apiSuccess, parseJsonBody, withApiHandler } from "@/server/api";

import { interviewSessionIdSchema } from "../../../../../_shared";
import {
  createInternalMonitoringService,
  monitoringEventIdSchema,
  monitoringReviewSchema,
  requireMonitoringReviewContext,
} from "../../../_shared";

import type { InterviewSessionId } from "@/modules/invitations";
import type { MonitoringEventId } from "@/modules/monitoring";
import type { NextRequest } from "next/server";

export async function POST(
  request: NextRequest,
  routeContext: {
    readonly params: Promise<{ readonly interviewSessionId: string; readonly eventId: string }>;
  },
) {
  return withApiHandler(async (innerRequest, context) => {
    const monitoringContext = await requireMonitoringReviewContext(innerRequest, context);
    const body = await parseJsonBody(innerRequest, monitoringReviewSchema);
    const { interviewSessionId, eventId } = await routeContext.params;
    const parsedInterviewSessionId = interviewSessionIdSchema.parse(
      interviewSessionId,
    ) as InterviewSessionId;
    const reviewed = await createInternalMonitoringService().reviewEvent({
      context: monitoringContext,
      interviewSessionId: parsedInterviewSessionId,
      eventId: monitoringEventIdSchema.parse(eventId) as MonitoringEventId,
      reviewState: body.reviewState,
      reason: body.reason,
    });
    return apiSuccess(context.requestContext, reviewed);
  })(request);
}
