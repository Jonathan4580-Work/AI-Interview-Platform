import { prisma } from "@/infra/database";
import { apiSuccess, withApiHandler } from "@/server/api";

import { requireInterviewReadContext } from "./_shared";

export const GET = withApiHandler(async (request, context) => {
  const interviewContext = await requireInterviewReadContext(request, context);
  const records = await prisma.interviewSession.findMany({
    where: { companyId: interviewContext.tenant.companyId },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      id: true,
      candidateId: true,
      invitationId: true,
      applicationId: true,
      interviewPlanVersionId: true,
      status: true,
      startedAt: true,
      interruptedAt: true,
      completedAt: true,
      lastActivityAt: true,
      currentQuestionSequence: true,
      processingWorkflowId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return apiSuccess(context.requestContext, { interviews: records });
});
