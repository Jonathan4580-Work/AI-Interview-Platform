import { type ProcessingWorkflowStepId } from "@/modules/workflows";
import { apiSuccess, parseJsonBody, withApiHandler } from "@/server/api";

import { createWorkflowApiService, replaySchema, requireWorkflowContext } from "../../../_shared";

export const POST = withApiHandler(async (request, { requestContext }) => {
  const context = await requireWorkflowContext(request, requestContext, "workflows:manage", true);
  const stepId = request.nextUrl.pathname.split("/").at(-2) as ProcessingWorkflowStepId;
  const body = await parseJsonBody(request, replaySchema);
  const step = await createWorkflowApiService().replayStep({
    context,
    stepId,
    reason: body.reason,
  });

  return apiSuccess(requestContext, { step });
});
