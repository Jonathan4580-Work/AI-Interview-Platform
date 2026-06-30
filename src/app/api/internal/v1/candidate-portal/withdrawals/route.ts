import { apiSuccess, withApiHandler } from "@/server/api";

import { pageArgs, prisma, readCandidatePortalListContext } from "../_shared";

export const GET = withApiHandler(async (request, { requestContext }) => {
  const { tenant, query } = await readCandidatePortalListContext(
    request,
    "candidate_sessions:read",
  );
  const withdrawals = await prisma.candidateWithdrawal.findMany({
    where: { companyId: tenant.companyId },
    orderBy: { createdAt: query.direction },
    ...pageArgs(query),
  });
  return apiSuccess(requestContext, { withdrawals });
});
