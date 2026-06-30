import { apiSuccess, notFound, parseSearchParams, withApiHandler } from "@/server/api";
import { prisma } from "@/infra/database";

import {
  createInternalTranscriptionService,
  phase9IdSchema,
  requirePhase9Context,
} from "../../../phase9/_shared";

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
    const segments = await createInternalTranscriptionService().listSegments({
      context: phase9Context,
      transcriptVersionId: transcript.activeVersionId as never,
      limit: query.limit,
      cursor: query.cursor ?? null,
    });
    return apiSuccess(apiContext.requestContext, { segments });
  })(request);
}
