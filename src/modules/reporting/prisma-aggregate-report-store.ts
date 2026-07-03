import {
  AggregateReportRunStatus as PrismaAggregateReportRunStatus,
  AggregateReportType as PrismaAggregateReportType,
  type Prisma,
  type AggregateReportRun as PrismaAggregateReportRun,
} from "@prisma/client";

import { prisma } from "@/infra/database";

import type { AnalyticsEventKey, AnalyticsProperties } from "./analytics-types";
import type {
  AggregateReportFilters,
  AggregateReportResult,
  AggregateReportRunRecord,
  AggregateReportRunStatus,
  AggregateReportStore,
  AggregateReportType,
  AggregateSourceEvent,
} from "./aggregate-types";

export class PrismaAggregateReportStore implements AggregateReportStore {
  public async findRunByIdempotencyKey(
    input: Parameters<AggregateReportStore["findRunByIdempotencyKey"]>[0],
  ): Promise<AggregateReportRunRecord | null> {
    const record = await prisma.aggregateReportRun.findUnique({
      where: {
        companyId_idempotencyKey: {
          companyId: input.companyId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });

    return record === null ? null : mapRun(record);
  }

  public async createRun(
    input: Parameters<AggregateReportStore["createRun"]>[0],
  ): Promise<AggregateReportRunRecord> {
    const record = await prisma.aggregateReportRun.create({
      data: {
        companyId: input.companyId,
        requestedByUserId: input.requestedByUserId,
        reportType: toPrismaReportType(input.reportType),
        dateRangeStart: input.dateRangeStart,
        dateRangeEnd: input.dateRangeEnd,
        filtersJson: input.filters as unknown as Prisma.InputJsonValue,
        dimensionsJson: input.dimensions as unknown as Prisma.InputJsonValue,
        idempotencyKey: input.idempotencyKey,
        expiresAt: input.expiresAt,
      },
    });

    return mapRun(record);
  }

  public async markReady(
    input: Parameters<AggregateReportStore["markReady"]>[0],
  ): Promise<AggregateReportRunRecord> {
    const record = await prisma.aggregateReportRun.update({
      where: {
        companyId_id: {
          companyId: input.companyId,
          id: input.runId,
        },
      },
      data: {
        status: PrismaAggregateReportRunStatus.READY,
        resultJson: input.result as unknown as Prisma.InputJsonValue,
        rowCount: input.rowCount,
        generatedAt: input.generatedAt,
      },
    });

    return mapRun(record);
  }

  public async listEvents(
    input: Parameters<AggregateReportStore["listEvents"]>[0],
  ): Promise<readonly AggregateSourceEvent[]> {
    const records = await prisma.analyticsEvent.findMany({
      where: {
        companyId: input.companyId,
        eventKey: { in: [...input.eventKeys] },
        occurredAt: {
          gte: input.dateRangeStart,
          lt: input.dateRangeEnd,
        },
        ...(input.filters.jobId === undefined
          ? {}
          : {
              propertiesJson: {
                path: "$.jobId",
                equals: input.filters.jobId,
              },
            }),
      },
      select: {
        eventKey: true,
        subjectType: true,
        subjectId: true,
        occurredAt: true,
        propertiesJson: true,
      },
      orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
      take: input.limit,
    });

    return records.map((record) => ({
      eventKey: record.eventKey as AnalyticsEventKey,
      subjectType: record.subjectType,
      subjectId: record.subjectId,
      occurredAt: record.occurredAt,
      properties: record.propertiesJson as AnalyticsProperties,
    }));
  }
}

function mapRun(record: PrismaAggregateReportRun): AggregateReportRunRecord {
  return {
    id: record.id as AggregateReportRunRecord["id"],
    companyId: record.companyId as AggregateReportRunRecord["companyId"],
    requestedByUserId: record.requestedByUserId,
    reportType: fromPrismaReportType(record.reportType),
    status: fromPrismaRunStatus(record.status),
    idempotencyKey: record.idempotencyKey,
    dateRangeStart: record.dateRangeStart,
    dateRangeEnd: record.dateRangeEnd,
    filters: record.filtersJson as AggregateReportFilters,
    dimensions: record.dimensionsJson as AggregateReportRunRecord["dimensions"],
    result: record.resultJson as AggregateReportResult | null,
    rowCount: record.rowCount,
    generatedAt: record.generatedAt,
    expiresAt: record.expiresAt,
    failureReason: record.failureReason,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function toPrismaReportType(type: AggregateReportType): PrismaAggregateReportType {
  return PrismaAggregateReportType[toEnumKey(type)];
}

function fromPrismaReportType(type: PrismaAggregateReportType): AggregateReportType {
  return type.toLocaleLowerCase() as AggregateReportType;
}

function fromPrismaRunStatus(status: PrismaAggregateReportRunStatus): AggregateReportRunStatus {
  return status.toLocaleLowerCase() as AggregateReportRunStatus;
}

function toEnumKey(value: string): keyof typeof PrismaAggregateReportType {
  return value.toUpperCase() as keyof typeof PrismaAggregateReportType;
}
