import { z } from "zod";

import { apiSuccess, parseJsonBody, withApiHandler } from "@/server/api";

import {
  createCandidateInterviewService,
  idempotencyKeySchema,
  requireCandidateInterviewContext,
  sequenceSchema,
} from "../../_shared";

const startAnswerSchema = z.object({
  sequence: sequenceSchema,
  idempotencyKey: idempotencyKeySchema,
});

export const POST = withApiHandler(async (request, context) => {
  const interviewContext = await requireCandidateInterviewContext(request, context, true);
  const body = await parseJsonBody(request, startAnswerSchema);
  const turn = await createCandidateInterviewService().startAnswer({
    context: interviewContext,
    sequence: body.sequence,
    idempotencyKey: body.idempotencyKey,
  });
  return apiSuccess(context.requestContext, turn, { status: 201 });
});
