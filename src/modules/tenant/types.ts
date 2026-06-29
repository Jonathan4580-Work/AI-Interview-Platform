import type { Brand } from "@/shared";

export type TenantId = Brand<string, "TenantId">;

export const tenantStatuses = ["active", "suspended", "trialing", "archived"] as const;

export type TenantStatus = (typeof tenantStatuses)[number];

export interface TenantContext {
  readonly companyId: TenantId;
}

export interface TenantRecord {
  readonly id: TenantId;
  readonly name: string;
  readonly slug: string;
  readonly status: TenantStatus;
  readonly primaryDomain: string | null;
  readonly deletedAt: Date | null;
}
