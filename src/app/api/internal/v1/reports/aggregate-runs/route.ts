import { z } from "zod";

import { AggregateReportService, PrismaAggregateReportStore } from "@/modules/reporting";
import { apiSuccess, parseJsonBody, withApiHandler } from "@/server/api";

import { requireTenantMutationPermission } from "../../_shared";

const aggregateRunSchema = z.object({
  reportType: z.string().trim().min(1).max(80),
  dateRangeStart: z.coerce.date(),
  dateRangeEnd: z.coerce.date(),
  idempotencyKey: z.string().trim().min(8).max(160).nullable().optional(),
  requestedByUserId: z.string().trim().min(1).max(128).nullable().optional(),
  filters: z
    .object({
      jobId: z.string().trim().min(1).max(128).optional(),
      eventKeys: z.array(z.string().trim().min(1).max(120)).max(12).optional(),
    })
    .strict()
    .optional(),
  dimensions: z
    .object({
      groupBy: z
        .array(z.enum(["eventKey", "status", "confidence", "warningType", "severity"]))
        .max(4)
        .optional(),
    })
    .strict()
    .optional(),
});

export const POST = withApiHandler(async (request, { requestContext }) => {
  const tenant = await requireTenantMutationPermission(request, "reports:aggregate_read");
  const body = await parseJsonBody(request, aggregateRunSchema);
  const service = new AggregateReportService(new PrismaAggregateReportStore());
  const run = await service.request({
    tenant,
    requestedByUserId: body.requestedByUserId ?? null,
    reportType: body.reportType as never,
    dateRangeStart: body.dateRangeStart,
    dateRangeEnd: body.dateRangeEnd,
    filters: body.filters as never,
    dimensions: body.dimensions,
    idempotencyKey: body.idempotencyKey ?? null,
  });

  return apiSuccess(requestContext, { run }, { status: 201 });
});
