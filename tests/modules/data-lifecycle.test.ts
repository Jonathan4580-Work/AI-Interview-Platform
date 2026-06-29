import { describe, expect, it } from "vitest";

import {
  LegalHoldError,
  LegalHoldService,
  RetentionPolicyError,
  createRetentionPolicyRecord,
} from "@/modules/data-lifecycle";
import { createTenantContext } from "@/modules/tenant";

import type {
  CompanyUserId,
  LegalHold,
  LegalHoldId,
  LegalHoldStore,
} from "@/modules/data-lifecycle";
import type { TenantContext } from "@/modules/tenant";

class MemoryLegalHoldStore implements LegalHoldStore {
  public readonly holds: LegalHold[] = [];

  public create(input: Parameters<LegalHoldStore["create"]>[0]): Promise<LegalHold> {
    const now = new Date("2026-06-30T00:00:00.000Z");
    const hold: LegalHold = {
      id: `hold-${String(this.holds.length + 1)}` as LegalHoldId,
      companyId: input.companyId,
      name: input.name,
      description: input.description,
      status: "active",
      createdByUserId: input.createdByUserId,
      releasedByUserId: null,
      createdAt: now,
      releasedAt: null,
    };

    this.holds.push(hold);
    return Promise.resolve(hold);
  }

  public release(input: Parameters<LegalHoldStore["release"]>[0]): Promise<LegalHold> {
    const index = this.holds.findIndex(
      (hold) => hold.id === input.legalHoldId && hold.companyId === input.tenant.companyId,
    );
    if (index < 0) {
      throw new Error("missing hold");
    }

    const released: LegalHold = {
      ...this.holds[index],
      status: "released",
      releasedByUserId: input.releasedByUserId,
      releasedAt: input.releasedAt,
    };
    this.holds[index] = released;
    return Promise.resolve(released);
  }

  public hasActiveHold(tenant: TenantContext): Promise<boolean> {
    return Promise.resolve(
      this.holds.some(
        (hold) => hold.companyId === tenant.companyId && hold.status === "active",
      ),
    );
  }
}

describe("data lifecycle module", () => {
  it("creates retention policy records with enforced audit and support retention floors", () => {
    const tenant = createTenantContext("cm0tenant001");

    const policy = createRetentionPolicyRecord(tenant.companyId, {
      recordingDays: 120,
    });

    expect(policy).toMatchObject({
      companyId: tenant.companyId,
      recordingDays: 120,
      auditEventDays: 2555,
      supportAccessDays: 2555,
    });

    expect(() =>
      createRetentionPolicyRecord(tenant.companyId, {
        auditEventDays: 30,
      }),
    ).toThrow(RetentionPolicyError);
  });

  it("blocks deletion while a legal hold is active and allows it after release", async () => {
    const tenant = createTenantContext("cm0tenant001");
    const store = new MemoryLegalHoldStore();
    const service = new LegalHoldService(store, () => new Date("2026-06-30T01:00:00.000Z"));

    const hold = await service.create({
      tenant,
      name: "Litigation hold",
      description: "Retention deletion paused for covered records.",
      createdByUserId: "user-1" as CompanyUserId,
    });

    await expect(service.assertDeletionAllowed(tenant)).rejects.toBeInstanceOf(LegalHoldError);

    await service.release({
      tenant,
      legalHoldId: hold.id,
      releasedByUserId: "user-2" as CompanyUserId,
    });

    await expect(service.assertDeletionAllowed(tenant)).resolves.toBeUndefined();
  });

  it("rejects vague legal hold names", () => {
    const tenant = createTenantContext("cm0tenant001");
    const service = new LegalHoldService(new MemoryLegalHoldStore());

    expect(() =>
      service.create({
        tenant,
        name: "x",
        createdByUserId: "user-1" as CompanyUserId,
      }),
    ).toThrow(LegalHoldError);
  });
});
