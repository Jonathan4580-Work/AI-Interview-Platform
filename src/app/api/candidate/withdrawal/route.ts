import { z } from "zod";

import { clearCandidateCookies, CandidatePortalService } from "@/modules/candidate-portal";
import { apiSuccess, parseJsonBody, withApiHandler } from "@/server/api";

import {
  createCandidateRequestContext,
  enforceCandidateRateLimit,
  requireCandidateSession,
} from "../_shared";

const withdrawalSchema = z.object({
  reason: z.string().trim().max(1_000).optional().nullable(),
});

export const POST = withApiHandler(async (request, context) => {
  await enforceCandidateRateLimit(request, "withdrawal", 5);
  const session = await requireCandidateSession(request, context, true);
  const body = await parseJsonBody(request, withdrawalSchema);
  await new CandidatePortalService().withdraw({
    session,
    request: createCandidateRequestContext(request, context),
    reason: body.reason ?? null,
  });
  const response = apiSuccess(context.requestContext, { withdrawn: true });
  clearCandidateCookies(response);
  return response;
});
