import { z } from "zod";

import { CandidatePortalService, setCandidateCookies } from "@/modules/candidate-portal";
import { apiSuccess, parseJsonBody, withApiHandler } from "@/server/api";

import { createCandidateRequestContext, enforceCandidateRateLimit } from "../_shared";

const exchangeSchema = z.object({
  token: z.string().trim().min(1).max(240),
});

export const POST = withApiHandler(async (request, context) => {
  await enforceCandidateRateLimit(request, "token_exchange", 8);
  const body = await parseJsonBody(request, exchangeSchema);
  const result = await new CandidatePortalService().exchangeToken({
    token: body.token,
    request: createCandidateRequestContext(request, context),
  });

  if (!result.ok) {
    return apiSuccess(
      context.requestContext,
      { accepted: false, reason: result.reason },
      { status: 200, headers: candidateNoStoreHeaders() },
    );
  }

  const response = apiSuccess(
    context.requestContext,
    {
      accepted: true,
      nextPath: result.nextPath,
      expiresAt: result.expiresAt,
    },
    { headers: candidateNoStoreHeaders() },
  );
  setCandidateCookies(response, {
    sessionToken: result.sessionToken,
    csrfToken: result.csrfToken,
    maxAgeSeconds: Math.max(1, Math.floor((result.expiresAt.getTime() - Date.now()) / 1000)),
  });
  return response;
});

function candidateNoStoreHeaders(): HeadersInit {
  return {
    "cache-control": "no-store",
    "referrer-policy": "no-referrer",
  };
}
