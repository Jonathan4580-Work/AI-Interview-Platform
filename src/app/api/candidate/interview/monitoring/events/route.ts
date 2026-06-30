import { apiSuccess, parseJsonBody, withApiHandler } from "@/server/api";

import {
  createCandidateMonitoringService,
  monitoringBatchSchema,
  requireCandidateMonitoringContext,
} from "../_shared";

export const POST = withApiHandler(async (request, context) => {
  const monitoringContext = await requireCandidateMonitoringContext(request, context, true);
  const body = await parseJsonBody(request, monitoringBatchSchema);
  const result = await createCandidateMonitoringService().ingestCandidateBatch(
    monitoringContext,
    body,
  );
  return apiSuccess(context.requestContext, result, { status: 202 });
});
