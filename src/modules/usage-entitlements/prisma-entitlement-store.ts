import {
  type Entitlement as PrismaEntitlement,
  type UsageCounter as PrismaUsageCounter,
  Prisma,
} from "@prisma/client";

import { prisma } from "@/infra/database";
import { assertTenantRecord } from "@/shared/repositories";

import type { TenantContext } from "@/modules/tenant";
import type {
  Entitlement,
  EntitlementStore,
  FeatureFlag,
  UsageCounter,
} from "./types";

export class PrismaEntitlementStore implements EntitlementStore {
  public async findEntitlement(
    tenant: TenantContext,
    featureKey: string,
  ): Promise<Entitlement | null> {
    const record = await prisma.entitlement.findUnique({
      where: {
        companyId_featureKey: {
          companyId: tenant.companyId,
          featureKey,
        },
      },
    });

    if (record === null) {
      return null;
    }

    const tenantRecord = assertTenantRecord(tenant, record);
    return tenantRecord === null ? null : mapEntitlement(tenantRecord);
  }

  public async findCurrentUsage(
    tenant: TenantContext,
    metricKey: string,
    at: Date,
  ): Promise<UsageCounter | null> {
    const record = await prisma.usageCounter.findFirst({
      where: {
        companyId: tenant.companyId,
        metricKey,
        periodStart: {
          lte: at,
        },
        periodEnd: {
          gt: at,
        },
      },
      orderBy: {
        periodStart: "desc",
      },
    });

    if (record === null) {
      return null;
    }

    const tenantRecord = assertTenantRecord(tenant, record);
    return tenantRecord === null ? null : mapUsageCounter(tenantRecord);
  }

  public async findFeatureFlag(
    tenant: TenantContext,
    featureKey: string,
  ): Promise<FeatureFlag | null> {
    const settings = await prisma.companySettings.findUnique({
      where: {
        companyId: tenant.companyId,
      },
      select: {
        companyId: true,
        featureFlagsJson: true,
      },
    });

    const tenantSettings = assertTenantRecord(tenant, settings);
    if (tenantSettings === null) {
      return null;
    }

    return readFeatureFlag(tenantSettings.featureFlagsJson, featureKey);
  }
}

function mapEntitlement(record: PrismaEntitlement): Entitlement {
  return {
    id: record.id as Entitlement["id"],
    companyId: record.companyId as Entitlement["companyId"],
    planKey: record.planKey,
    featureKey: record.featureKey,
    limitValue: record.limitValue,
    enabled: record.enabled,
    overrideReason: record.overrideReason,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function mapUsageCounter(record: PrismaUsageCounter): UsageCounter {
  return {
    id: record.id as UsageCounter["id"],
    companyId: record.companyId as UsageCounter["companyId"],
    periodStart: record.periodStart,
    periodEnd: record.periodEnd,
    metricKey: record.metricKey,
    count: record.count,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function readFeatureFlag(value: Prisma.JsonValue, featureKey: string): FeatureFlag | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const flags = value.flags;
  if (typeof flags === "object" && flags !== null && !Array.isArray(flags)) {
    const enabled = flags[featureKey];
    return typeof enabled === "boolean" ? { key: featureKey, enabled } : null;
  }

  const directEnabled = value[featureKey];
  return typeof directEnabled === "boolean" ? { key: featureKey, enabled: directEnabled } : null;
}
