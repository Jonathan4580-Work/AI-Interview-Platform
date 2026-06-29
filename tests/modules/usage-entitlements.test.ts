import { describe, expect, it } from "vitest";

import { EntitlementError, EntitlementService } from "@/modules/usage-entitlements";
import { createTenantContext } from "@/modules/tenant";

import type { TenantContext, TenantId } from "@/modules/tenant";
import type {
  Entitlement,
  EntitlementId,
  EntitlementStore,
  FeatureFlag,
  UsageCounter,
  UsageCounterId,
} from "@/modules/usage-entitlements";

class MemoryEntitlementStore implements EntitlementStore {
  public readonly entitlements = new Map<string, Entitlement>();
  public readonly usageCounters = new Map<string, UsageCounter>();
  public readonly featureFlags = new Map<string, FeatureFlag>();

  public findEntitlement(
    tenant: TenantContext,
    featureKey: string,
  ): Promise<Entitlement | null> {
    return Promise.resolve(this.entitlements.get(key(tenant.companyId, featureKey)) ?? null);
  }

  public findCurrentUsage(
    tenant: TenantContext,
    metricKey: string,
  ): Promise<UsageCounter | null> {
    return Promise.resolve(this.usageCounters.get(key(tenant.companyId, metricKey)) ?? null);
  }

  public findFeatureFlag(
    tenant: TenantContext,
    featureKey: string,
  ): Promise<FeatureFlag | null> {
    return Promise.resolve(this.featureFlags.get(key(tenant.companyId, featureKey)) ?? null);
  }

  public setEntitlement(input: {
    readonly tenant: TenantContext;
    readonly featureKey: string;
    readonly enabled: boolean;
    readonly limitValue?: number | null;
    readonly overrideReason?: string | null;
  }): void {
    const now = new Date("2026-06-30T00:00:00.000Z");
    this.entitlements.set(key(input.tenant.companyId, input.featureKey), {
      id: `ent-${input.featureKey}` as EntitlementId,
      companyId: input.tenant.companyId,
      planKey: "enterprise",
      featureKey: input.featureKey,
      limitValue: input.limitValue ?? null,
      enabled: input.enabled,
      overrideReason: input.overrideReason ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  public setUsage(input: {
    readonly tenant: TenantContext;
    readonly metricKey: string;
    readonly count: number;
  }): void {
    const now = new Date("2026-06-30T00:00:00.000Z");
    this.usageCounters.set(key(input.tenant.companyId, input.metricKey), {
      id: `usage-${input.metricKey}` as UsageCounterId,
      companyId: input.tenant.companyId,
      metricKey: input.metricKey,
      count: input.count,
      periodStart: now,
      periodEnd: new Date("2026-07-30T00:00:00.000Z"),
      createdAt: now,
      updatedAt: now,
    });
  }

  public setFlag(tenant: TenantContext, featureKey: string, enabled: boolean): void {
    this.featureFlags.set(key(tenant.companyId, featureKey), {
      key: featureKey,
      enabled,
    });
  }
}

describe("usage and entitlements module", () => {
  it("denies missing entitlements by default", async () => {
    const tenant = createTenantContext("cm0tenant001");
    const service = new EntitlementService(new MemoryEntitlementStore());

    await expect(service.checkFeature(tenant, "exports")).resolves.toMatchObject({
      allowed: false,
      reason: "missing_entitlement",
    });
  });

  it("allows enabled entitlements and preserves plan override reason", async () => {
    const tenant = createTenantContext("cm0tenant001");
    const store = new MemoryEntitlementStore();
    const service = new EntitlementService(store);

    store.setEntitlement({
      tenant,
      featureKey: "support_access_history",
      enabled: true,
      overrideReason: "Enterprise contract override",
    });

    await expect(service.checkFeature(tenant, "support_access_history")).resolves.toMatchObject({
      allowed: true,
      reason: "enabled",
      overrideReason: "Enterprise contract override",
    });
  });

  it("blocks operations when a feature flag disables an entitlement", async () => {
    const tenant = createTenantContext("cm0tenant001");
    const store = new MemoryEntitlementStore();
    const service = new EntitlementService(store);

    store.setEntitlement({
      tenant,
      featureKey: "tenant_exports",
      enabled: true,
    });
    store.setFlag(tenant, "tenant_exports", false);

    await expect(service.checkFeature(tenant, "tenant_exports")).resolves.toMatchObject({
      allowed: false,
      reason: "feature_disabled",
    });
  });

  it("blocks usage when the current period has reached the entitlement limit", async () => {
    const tenant = createTenantContext("cm0tenant001");
    const store = new MemoryEntitlementStore();
    const service = new EntitlementService(store);

    store.setEntitlement({
      tenant,
      featureKey: "exports",
      enabled: true,
      limitValue: 3,
    });
    store.setUsage({
      tenant,
      metricKey: "exports",
      count: 3,
    });

    const decision = await service.checkUsageLimit({
      tenant,
      featureKey: "exports",
      metricKey: "exports",
    });

    expect(decision).toMatchObject({
      allowed: false,
      reason: "limit_exceeded",
      usageCount: 3,
      limitValue: 3,
    });

    await expect(service.assertAllowed(Promise.resolve(decision))).rejects.toBeInstanceOf(
      EntitlementError,
    );
  });
});

function key(companyId: TenantId, value: string): string {
  return `${companyId}:${value}`;
}
