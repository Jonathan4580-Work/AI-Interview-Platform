import type { TenantContext } from "@/modules/tenant";
import type { EntitlementDecision, EntitlementStore } from "./types";

export class EntitlementError extends Error {
  public constructor(
    message: string,
    public readonly decision: EntitlementDecision,
  ) {
    super(message);
    this.name = "EntitlementError";
  }
}

export class EntitlementService {
  public constructor(
    private readonly store: EntitlementStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async checkFeature(
    tenant: TenantContext,
    featureKey: string,
  ): Promise<EntitlementDecision> {
    const flag = await this.store.findFeatureFlag(tenant, featureKey);
    if (flag !== null && !flag.enabled) {
      return deny(featureKey, "feature_disabled", null, null, null);
    }

    const entitlement = await this.store.findEntitlement(tenant, featureKey);
    if (entitlement === null) {
      return deny(featureKey, "missing_entitlement", null, null, null);
    }

    if (!entitlement.enabled) {
      return deny(
        featureKey,
        "feature_disabled",
        entitlement.limitValue,
        null,
        entitlement.overrideReason,
      );
    }

    return {
      allowed: true,
      featureKey,
      reason: "enabled",
      limitValue: entitlement.limitValue,
      usageCount: null,
      overrideReason: entitlement.overrideReason,
    };
  }

  public async checkUsageLimit(input: {
    readonly tenant: TenantContext;
    readonly featureKey: string;
    readonly metricKey: string;
  }): Promise<EntitlementDecision> {
    const featureDecision = await this.checkFeature(input.tenant, input.featureKey);
    if (!featureDecision.allowed) {
      return featureDecision;
    }

    if (featureDecision.limitValue === null) {
      return featureDecision;
    }

    const usage = await this.store.findCurrentUsage(
      input.tenant,
      input.metricKey,
      this.now(),
    );
    const usageCount = usage?.count ?? 0;

    if (usageCount >= featureDecision.limitValue) {
      return deny(
        input.featureKey,
        "limit_exceeded",
        featureDecision.limitValue,
        usageCount,
        featureDecision.overrideReason,
      );
    }

    return {
      ...featureDecision,
      usageCount,
    };
  }

  public async assertAllowed(decision: Promise<EntitlementDecision>): Promise<void> {
    const resolved = await decision;
    if (!resolved.allowed) {
      throw new EntitlementError(`Feature ${resolved.featureKey} is not allowed.`, resolved);
    }
  }
}

function deny(
  featureKey: string,
  reason: EntitlementDecision["reason"],
  limitValue: number | null,
  usageCount: number | null,
  overrideReason: string | null,
): EntitlementDecision {
  return {
    allowed: false,
    featureKey,
    reason,
    limitValue,
    usageCount,
    overrideReason,
  };
}
