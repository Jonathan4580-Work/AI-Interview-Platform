import { CandidatePortalService } from "@/modules/candidate-portal";
import { apiSuccess, withApiHandler } from "@/server/api";

import {
  createCandidateRequestContext,
  enforceCandidateRateLimit,
  requireCandidateSession,
} from "../_shared";

export const POST = withApiHandler(async (request, context) => {
  await enforceCandidateRateLimit(request, "ready", 15);
  const session = await requireCandidateSession(request, context, true);
  await new CandidatePortalService().markReadyToStart({
    session,
    request: createCandidateRequestContext(request, context),
  });
  return apiSuccess(context.requestContext, { ready: true });
});
