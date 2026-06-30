import { z } from "zod";

import { CandidatePortalService } from "@/modules/candidate-portal";
import { apiSuccess, parseJsonBody, withApiHandler } from "@/server/api";

import {
  createCandidateRequestContext,
  enforceCandidateRateLimit,
  requireCandidateSession,
} from "../_shared";

const readinessSchema = z.object({
  checks: z
    .array(
      z.object({
        type: z.enum([
          "CAMERA",
          "MICROPHONE",
          "BROWSER",
          "SECURE_CONTEXT",
          "MEDIA_DEVICES",
          "NETWORK",
          "DEVICE",
          "SCREEN_SIZE",
          "AUDIO_OUTPUT",
        ]),
        status: z.enum(["PASS", "WARNING", "FAIL"]),
        details: z.record(z.unknown()).default({}),
      }),
    )
    .min(1)
    .max(20),
});

export const POST = withApiHandler(async (request, context) => {
  await enforceCandidateRateLimit(request, "readiness", 30);
  const session = await requireCandidateSession(request, context, true);
  const body = await parseJsonBody(request, readinessSchema);
  await new CandidatePortalService().submitReadiness({
    session,
    request: createCandidateRequestContext(request, context),
    checks: body.checks,
  });
  return apiSuccess(context.requestContext, { saved: true });
});
