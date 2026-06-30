import { apiSuccess, withApiHandler } from "@/server/api";

import { enforceCandidateRateLimit, requireCandidateSession } from "../_shared";
import { CandidatePortalService } from "@/modules/candidate-portal";

export const GET = withApiHandler(async (request, context) => {
  await enforceCandidateRateLimit(request, "session_status", 60);
  const session = await requireCandidateSession(request, context);
  const status = await new CandidatePortalService().getStatus(session);
  return apiSuccess(
    context.requestContext,
    { status },
    { headers: { "cache-control": "no-store" } },
  );
});

export const POST = withApiHandler(async (request, context) => {
  await enforceCandidateRateLimit(request, "session_resume", 20);
  const session = await requireCandidateSession(request, context, true);
  const resume = await new CandidatePortalService().createResumeToken(session);
  return apiSuccess(
    context.requestContext,
    { resume },
    { headers: { "cache-control": "no-store" } },
  );
});
