import { apiSuccess, withApiHandler } from "@/server/api";

import { createCandidateMonitoringService, requireCandidateMonitoringContext } from "../_shared";

export const GET = withApiHandler(async (request, context) => {
  const monitoringContext = await requireCandidateMonitoringContext(request, context);
  const config =
    await createCandidateMonitoringService().getCandidateConfiguration(monitoringContext);
  return apiSuccess(context.requestContext, config);
});
