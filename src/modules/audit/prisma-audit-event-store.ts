import { prisma } from "@/infra/database";

import { toPrismaAuditActorType, toPrismaAuditRiskLevel } from "./mappers";

import type { AuditEventStore, PersistedAuditEventInput } from "./types";
import type { Prisma } from "@prisma/client";

export class PrismaAuditEventStore implements AuditEventStore {
  public async append(event: PersistedAuditEventInput): Promise<void> {
    await prisma.auditEvent.create({
      data: {
        companyId: event.companyId,
        actorType: toPrismaAuditActorType(event.actorType),
        actorId: event.actorId,
        requestId: event.requestId,
        correlationId: event.correlationId,
        sessionId: event.sessionId,
        action: event.action,
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        reason: event.reason,
        riskLevel: toPrismaAuditRiskLevel(event.riskLevel),
        beforeJson: event.before as Prisma.InputJsonValue,
        afterJson: event.after as Prisma.InputJsonValue,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        metadataJson: event.metadata as Prisma.InputJsonValue,
      },
    });
  }
}
