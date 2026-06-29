import { AuditActorType as PrismaAuditActorType, AuditRiskLevel as PrismaAuditRiskLevel } from "@prisma/client";

import type { AuditActorType, AuditRiskLevel } from "./types";

export function toPrismaAuditActorType(actorType: AuditActorType): PrismaAuditActorType {
  switch (actorType) {
    case "platform_user":
      return PrismaAuditActorType.PLATFORM_USER;
    case "user":
      return PrismaAuditActorType.USER;
    case "system":
      return PrismaAuditActorType.SYSTEM;
  }
}

export function toPrismaAuditRiskLevel(riskLevel: AuditRiskLevel): PrismaAuditRiskLevel {
  switch (riskLevel) {
    case "low":
      return PrismaAuditRiskLevel.LOW;
    case "medium":
      return PrismaAuditRiskLevel.MEDIUM;
    case "high":
      return PrismaAuditRiskLevel.HIGH;
    case "critical":
      return PrismaAuditRiskLevel.CRITICAL;
  }
}
