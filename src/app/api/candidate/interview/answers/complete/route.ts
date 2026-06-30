import { z } from "zod";

import { apiSuccess, parseJsonBody, withApiHandler } from "@/server/api";

import {
  createCandidateInterviewService,
  idempotencyKeySchema,
  interviewTurnIdSchema,
  mediaObjectIdsSchema,
  requireCandidateInterviewContext,
  toMediaObjectIds,
  toTurnId,
} from "../../_shared";

const completeAnswerSchema = z.object({
  turnId: interviewTurnIdSchema,
  content: z.string().trim().max(10_000).nullable().optional(),
  mediaObjectIds: mediaObjectIdsSchema,
  idempotencyKey: idempotencyKeySchema,
});

export const POST = withApiHandler(async (request, context) => {
  const interviewContext = await requireCandidateInterviewContext(request, context, true);
  const body = await parseJsonBody(request, completeAnswerSchema);
  const turn = await createCandidateInterviewService().completeAnswer({
    context: interviewContext,
    turnId: toTurnId(body.turnId),
    content: body.content ?? null,
    mediaObjectIds: toMediaObjectIds(body.mediaObjectIds),
    idempotencyKey: body.idempotencyKey,
  });
  return apiSuccess(context.requestContext, turn);
});
