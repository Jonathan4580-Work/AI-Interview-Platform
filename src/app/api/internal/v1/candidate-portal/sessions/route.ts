import { apiSuccess, withApiHandler } from "@/server/api";

import { pageArgs, prisma, readCandidatePortalListContext } from "../_shared";

export const GET = withApiHandler(async (request, { requestContext }) => {
  const { tenant, query } = await readCandidatePortalListContext(
    request,
    "candidate_sessions:read",
  );
  const sessions = await prisma.candidateSession.findMany({
    where: { companyId: tenant.companyId },
    orderBy: { createdAt: query.direction },
    ...pageArgs(query),
    include: {
      candidate: { select: { id: true, fullName: true, primaryEmail: true } },
      invitation: { select: { id: true, status: true, expiresAt: true } },
    },
  });
  return apiSuccess(requestContext, { sessions });
});
