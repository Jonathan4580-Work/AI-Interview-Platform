import { z } from "zod";

import { CandidatePortalService, setCandidateCookies } from "@/modules/candidate-portal";
import { apiSuccess, parseJsonBody, withApiHandler } from "@/server/api";

import { createCandidateRequestContext, enforceCandidateRateLimit } from "../_shared";

const resumeSchema = z.object({
  resumeToken: z.string().trim().min(1).max(240),
});

export const POST = withApiHandler(async (request, context) => {
  await enforceCandidateRateLimit(request, "session_resume_exchange", 8);
  const body = await parseJsonBody(request, resumeSchema);
  const result = await new CandidatePortalService().exchangeResumeToken({
    resumeToken: body.resumeToken,
    request: createCandidateRequestContext(request, context),
  });

  if (!result.ok) {
    return apiSuccess(
      context.requestContext,
      { accepted: false },
      {
        status: 200,
        headers: {
          "cache-control": "no-store",
          "referrer-policy": "no-referrer",
        },
      },
    );
  }

  const response = apiSuccess(
    context.requestContext,
    {
      accepted: true,
      nextPath: result.nextPath,
      expiresAt: result.expiresAt,
    },
    {
      headers: {
        "cache-control": "no-store",
        "referrer-policy": "no-referrer",
      },
    },
  );
  setCandidateCookies(response, {
    sessionToken: result.sessionToken,
    csrfToken: result.csrfToken,
    maxAgeSeconds: Math.max(1, Math.floor((result.expiresAt.getTime() - Date.now()) / 1000)),
  });
  return response;
});
