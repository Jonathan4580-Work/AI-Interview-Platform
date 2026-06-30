import { apiSuccess, withApiHandler } from "@/server/api";

import { pageArgs, prisma, readCandidatePortalListContext } from "../_shared";

export const GET = withApiHandler(async (request, { requestContext }) => {
  const { tenant, query } = await readCandidatePortalListContext(
    request,
    "candidate_readiness:read",
  );
  const readinessChecks = await prisma.readinessCheck.findMany({
    where: { companyId: tenant.companyId },
    orderBy: { checkedAt: query.direction },
    ...pageArgs(query),
  });
  return apiSuccess(requestContext, { readinessChecks });
});
