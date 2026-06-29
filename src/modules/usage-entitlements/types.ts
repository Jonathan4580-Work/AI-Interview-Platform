import type { TenantContext, TenantId } from "@/modules/tenant";
import type { Brand } from "@/shared";

export type EntitlementId = Brand<string, "EntitlementId">;
export type UsageCounterId = Brand<string, "UsageCounterId">;

export interface Entitlement {
  readonly id: EntitlementId;
  readonly companyId: TenantId;
  readonly planKey: string;
  readonly featureKey: string;
  readonly limitValue: number | null;
  readonly enabled: boolean;
  readonly overrideReason: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface UsageCounter {
  readonly id: UsageCounterId;
  readonly companyId: TenantId;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly metricKey: string;
  readonly count: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface FeatureFlag {
  readonly key: string;
  readonly enabled: boolean;
}

export interface EntitlementDecision {
  readonly allowed: boolean;
  readonly featureKey: string;
  readonly reason: "enabled" | "feature_disabled" | "missing_entitlement" | "limit_exceeded";
  readonly limitValue: number | null;
  readonly usageCount: number | null;
  readonly overrideReason: string | null;
}

export interface EntitlementStore {
  findEntitlement(
    tenant: TenantContext,
    featureKey: string,
  ): Promise<Entitlement | null>;

  findCurrentUsage(
    tenant: TenantContext,
    metricKey: string,
    at: Date,
  ): Promise<UsageCounter | null>;

  findFeatureFlag(tenant: TenantContext, featureKey: string): Promise<FeatureFlag | null>;
}
