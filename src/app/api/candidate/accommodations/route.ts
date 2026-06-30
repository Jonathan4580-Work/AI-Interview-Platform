import { z } from "zod";

import { CandidatePortalService } from "@/modules/candidate-portal";
import { apiSuccess, parseJsonBody, withApiHandler } from "@/server/api";

import {
  contactEmailSchema,
  createCandidateRequestContext,
  enforceCandidateRateLimit,
  requireCandidateSession,
} from "../_shared";

const accommodationSchema = z.object({
  type: z.enum(["WEBCAM_ALTERNATIVE", "TIME_EXTENSION", "ACCESSIBILITY_SUPPORT", "OTHER"]),
  contactEmail: contactEmailSchema,
  message: z.string().trim().min(1).max(2_000),
});

export const POST = withApiHandler(async (request, context) => {
  await enforceCandidateRateLimit(request, "accommodation", 10);
  const session = await requireCandidateSession(request, context, true);
  const body = await parseJsonBody(request, accommodationSchema);
  await new CandidatePortalService().createAccommodationRequest({
    session,
    request: createCandidateRequestContext(request, context),
    ...body,
  });
  return apiSuccess(context.requestContext, { submitted: true }, { status: 201 });
});
