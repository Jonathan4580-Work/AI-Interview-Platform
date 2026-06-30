import { z } from "zod";

import { CandidatePortalService } from "@/modules/candidate-portal";
import { apiSuccess, parseJsonBody, withApiHandler } from "@/server/api";

import {
  createCandidateRequestContext,
  enforceCandidateRateLimit,
  requireCandidateSession,
} from "../_shared";

const consentSchema = z.object({
  consents: z
    .array(
      z.object({
        type: z.enum([
          "INTERVIEW_PARTICIPATION",
          "CAMERA_USE",
          "MICROPHONE_USE",
          "WEBCAM_SNAPSHOT",
          "FUTURE_AUDIO_VIDEO_RECORDING",
          "FUTURE_BROWSER_MONITORING",
          "PRIVACY_NOTICE",
          "DATA_PROCESSING_RETENTION",
        ]),
        accepted: z.boolean(),
      }),
    )
    .min(1)
    .max(16),
});

export const POST = withApiHandler(async (request, context) => {
  await enforceCandidateRateLimit(request, "consent", 20);
  const session = await requireCandidateSession(request, context, true);
  const body = await parseJsonBody(request, consentSchema);
  await new CandidatePortalService().submitConsents({
    session,
    request: createCandidateRequestContext(request, context),
    consents: body.consents,
  });
  return apiSuccess(context.requestContext, { accepted: true });
});
