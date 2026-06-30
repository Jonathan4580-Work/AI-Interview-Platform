import { PrismaWorkflowRepository, type ProcessingWorkflowId } from "@/modules/workflows";
import { apiSuccess, withApiHandler } from "@/server/api";

import { requireWorkflowContext } from "../_shared";

interface RouteParams {
  readonly params: Promise<{ readonly workflowId: string }>;
}

export const GET = withApiHandler(async (request, { requestContext }) => {
  const context = await requireWorkflowContext(request, requestContext, "workflows:read");
  const workflowId = request.nextUrl.pathname.split("/").at(-1) as ProcessingWorkflowId;
  const repository = new PrismaWorkflowRepository();
  const workflow = await repository.findWorkflow(context.tenant, workflowId);
  const steps = workflow === null ? [] : await repository.listSteps(context.tenant, workflow.id);

  return apiSuccess(requestContext, { workflow, steps });
});

export type { RouteParams };
