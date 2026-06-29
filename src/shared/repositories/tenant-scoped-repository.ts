import { assertSameTenant } from "@/modules/tenant";

import type { TenantContext, TenantId } from "@/modules/tenant";

export interface TenantOwnedRecord {
  readonly companyId: string;
}

export type TenantScopedWhere<TWhere extends object> = TWhere & {
  readonly companyId: TenantId;
};

export function withTenantScope<TWhere extends object>(
  tenant: TenantContext,
  where: TWhere,
): TenantScopedWhere<TWhere> {
  return {
    ...where,
    companyId: tenant.companyId,
  };
}

export function assertTenantRecord<TRecord extends TenantOwnedRecord>(
  tenant: TenantContext,
  record: TRecord | null,
): TRecord | null {
  if (record === null) {
    return null;
  }

  assertSameTenant(tenant, record.companyId);
  return record;
}

export function assertTenantRecords<TRecord extends TenantOwnedRecord>(
  tenant: TenantContext,
  records: readonly TRecord[],
): readonly TRecord[] {
  for (const record of records) {
    assertSameTenant(tenant, record.companyId);
  }

  return records;
}
