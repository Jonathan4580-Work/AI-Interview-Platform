import { type ProcessingWorkflowId } from "@/modules/workflows";
import { apiSuccess, parseJsonBody, withApiHandler } from "@/server/api";

import { createWorkflowApiService, replaySchema, requireWorkflowContext } from "../../_shared";

export const POST = withApiHandler(async (request, { requestContext }) => {
  const context = await requireWorkflowContext(request, requestContext, "workflows:manage", true);
  const workflowId = request.nextUrl.pathname.split("/").at(-2) as ProcessingWorkflowId;
  const body = await parseJsonBody(request, replaySchema);
  const workflow = await createWorkflowApiService().cancelWorkflow({
    context,
    workflowId,
    reason: body.reason,
  });

  return apiSuccess(requestContext, { workflow });
});
