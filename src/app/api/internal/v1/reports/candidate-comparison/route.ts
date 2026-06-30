import { z } from "zod";

import {
  CandidateComparisonService,
  PrismaCandidateComparisonRepository,
} from "@/modules/reporting";
import { apiSuccess, parseJsonBody, withApiHandler } from "@/server/api";

import { requireTenantMutationPermission } from "../../_shared";

const comparisonSchema = z.object({
  jobId: z.string().trim().min(1).max(128),
  candidateIds: z.array(z.string().trim().min(1).max(128)).max(25).optional(),
  limit: z.number().int().min(1).max(25).optional(),
});

export const POST = withApiHandler(async (request, { requestContext }) => {
  const tenant = await requireTenantMutationPermission(request, "reports:comparison_read");
  const body = await parseJsonBody(request, comparisonSchema);
  const service = new CandidateComparisonService(new PrismaCandidateComparisonRepository());
  const comparison = await service.compare({
    tenant,
    jobId: body.jobId,
    candidateIds: body.candidateIds,
    limit: body.limit,
  });

  return apiSuccess(requestContext, { comparison });
});
