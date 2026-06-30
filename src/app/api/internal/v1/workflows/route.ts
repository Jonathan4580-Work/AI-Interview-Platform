import { PrismaWorkflowRepository } from "@/modules/workflows";
import { apiSuccess, parseSearchParams, withApiHandler } from "@/server/api";

import { requireWorkflowContext, workflowStatusSchema } from "./_shared";

import { z } from "zod";

const querySchema = z.object({
  status: workflowStatusSchema,
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().min(1).max(128).optional(),
});

export const GET = withApiHandler(async (request, { requestContext }) => {
  const context = await requireWorkflowContext(request, requestContext, "workflows:read");
  const query = parseSearchParams(request, querySchema);
  const workflows = await new PrismaWorkflowRepository().listWorkflows({
    tenant: context.tenant,
    status: query.status,
    limit: query.limit,
    cursor: query.cursor,
  });

  return apiSuccess(requestContext, { workflows });
});
