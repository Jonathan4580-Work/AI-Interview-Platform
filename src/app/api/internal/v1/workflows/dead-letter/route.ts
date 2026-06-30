import { z } from "zod";

import { prisma } from "@/infra/database";
import { apiSuccess, parseSearchParams, withApiHandler } from "@/server/api";

import { requireWorkflowContext } from "../_shared";

const querySchema = z.object({
  status: z.enum(["OPEN", "REPLAYED", "CANCELLED", "RESOLVED"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const GET = withApiHandler(async (request, { requestContext }) => {
  const context = await requireWorkflowContext(request, requestContext, "queues:read");
  const query = parseSearchParams(request, querySchema);
  const deadLetterJobs = await prisma.workflowDeadLetterJob.findMany({
    where: {
      companyId: context.tenant.companyId,
      ...(query.status === undefined ? {} : { status: query.status }),
    },
    orderBy: { createdAt: "desc" },
    take: query.limit,
    select: {
      id: true,
      queueName: true,
      jobName: true,
      bullJobId: true,
      workflowId: true,
      stepId: true,
      status: true,
      failureKind: true,
      errorCode: true,
      errorMessage: true,
      payloadSummaryJson: true,
      requestId: true,
      correlationId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return apiSuccess(requestContext, { deadLetterJobs });
});
