import { prisma } from "@/infra/database";
import { apiSuccess, notFound, parseSearchParams, withApiHandler } from "@/server/api";

import { phase9IdSchema, requirePhase9Context } from "../../../phase9/_shared";

import { z } from "zod";
import type { NextRequest } from "next/server";

const segmentQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().min(1).max(256).optional(),
});

export async function GET(
  request: NextRequest,
  context: { readonly params: Promise<{ readonly interviewSessionId: string }> },
) {
  return withApiHandler(async (innerRequest, apiContext) => {
    const phase9Context = await requirePhase9Context(innerRequest, apiContext, "transcripts:read");
    const query = parseSearchParams(innerRequest, segmentQuerySchema);
    const { interviewSessionId } = await context.params;
    const transcript = await prisma.transcript.findUnique({
      where: {
        companyId_interviewSessionId: {
          companyId: phase9Context.tenant.companyId,
          interviewSessionId: phase9IdSchema.parse(interviewSessionId),
        },
      },
      select: { activeVersionId: true },
    });
    if (transcript?.activeVersionId === undefined || transcript.activeVersionId === null) {
      throw notFound("Transcript was not found.");
    }
    const segments = await prisma.transcriptSegment.findMany({
      where: {
        companyId: phase9Context.tenant.companyId,
        transcriptVersionId: transcript.activeVersionId,
      },
      orderBy: { sequence: "asc" },
      take: query.limit,
      ...(query.cursor === undefined
        ? {}
        : {
            cursor: {
              companyId_id: { companyId: phase9Context.tenant.companyId, id: query.cursor },
            },
            skip: 1,
          }),
      select: {
        id: true,
        transcriptVersionId: true,
        interviewTurnId: true,
        sequence: true,
        speaker: true,
        startMs: true,
        endMs: true,
        text: true,
        confidence: true,
        language: true,
      },
    });
    return apiSuccess(apiContext.requestContext, { segments });
  })(request);
}
