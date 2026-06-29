import type { TenantId } from "@/modules/tenant";
import type { Brand } from "@/shared";

export type PlatformUserId = Brand<string, "PlatformUserId">;
export type UserId = Brand<string, "UserId">;
export type NormalizedEmail = Brand<string, "NormalizedEmail">;

export const platformUserStatuses = ["active", "disabled"] as const;
export const companyUserStatuses = ["invited", "active", "disabled"] as const;

export type PlatformUserStatus = (typeof platformUserStatuses)[number];
export type CompanyUserStatus = (typeof companyUserStatuses)[number];

export interface PlatformIdentity {
  readonly id: PlatformUserId;
  readonly email: NormalizedEmail;
  readonly name: string;
  readonly status: PlatformUserStatus;
}

export interface CompanyIdentity {
  readonly id: UserId;
  readonly companyId: TenantId;
  readonly email: NormalizedEmail;
  readonly name: string;
  readonly status: CompanyUserStatus;
}
