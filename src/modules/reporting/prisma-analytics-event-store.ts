import { prisma } from "@/infra/database";

import type {
  AnalyticsEventRecord,
  AnalyticsEventStore,
  AnalyticsProperties,
} from "./analytics-types";

type PrismaAnalyticsEventRecord = NonNullable<
  Awaited<ReturnType<typeof prisma.analyticsEvent.findFirst>>
>;

export class PrismaAnalyticsEventStore implements AnalyticsEventStore {
  public async findByIdempotencyKey(
    input: Parameters<AnalyticsEventStore["findByIdempotencyKey"]>[0],
  ): Promise<AnalyticsEventRecord | null> {
    const record = await prisma.analyticsEvent.findUnique({
      where: {
        companyId_idempotencyKey: {
          companyId: input.companyId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });

    return record === null ? null : mapAnalyticsEvent(record);
  }

  public async create(
    input: Parameters<AnalyticsEventStore["create"]>[0],
  ): Promise<AnalyticsEventRecord> {
    const record = await prisma.analyticsEvent.create({
      data: {
        companyId: input.companyId,
        eventKey: input.eventKey,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        idempotencyKey: input.idempotencyKey,
        schemaVersion: input.schemaVersion,
        occurredAt: input.occurredAt,
        propertiesJson: input.properties,
      },
    });

    return mapAnalyticsEvent(record);
  }
}

function mapAnalyticsEvent(record: PrismaAnalyticsEventRecord): AnalyticsEventRecord {
  return {
    id: record.id as AnalyticsEventRecord["id"],
    companyId: record.companyId as AnalyticsEventRecord["companyId"],
    eventKey: record.eventKey as AnalyticsEventRecord["eventKey"],
    subjectType: record.subjectType as AnalyticsEventRecord["subjectType"],
    subjectId: record.subjectId,
    idempotencyKey: record.idempotencyKey,
    schemaVersion: record.schemaVersion,
    occurredAt: record.occurredAt,
    properties: record.propertiesJson as AnalyticsProperties,
    createdAt: record.createdAt,
  };
}
