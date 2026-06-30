import type { AuditRequestContext } from "@/modules/audit";
import type { PlatformUserId } from "@/modules/support-access";
import type { Brand } from "@/shared";
import type { TenantContext, TenantId, TenantRecord, TenantStatus } from "./types";

export type CompanyUserId = Brand<string, "CompanyUserId">;

export interface CompanyActor {
  readonly type: "user" | "platform_user" | "system";
  readonly id: CompanyUserId | PlatformUserId | null;
}

export interface CompanyMutationContext {
  readonly tenant: TenantContext;
  readonly actor: CompanyActor;
  readonly request: AuditRequestContext;
  readonly supportAccessSessionId?: string | null;
}

export interface CompanyRecord extends TenantRecord {
  readonly logoUrl: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface UpdateCompanyProfileInput extends CompanyMutationContext {
  readonly name: string;
  readonly primaryDomain?: string | null;
  readonly logoUrl?: string | null;
}

export interface CompanyRepository {
  findByTenant(tenant: TenantContext): Promise<CompanyRecord | null>;
  updateProfile(input: {
    readonly companyId: TenantId;
    readonly name: string;
    readonly primaryDomain: string | null;
    readonly logoUrl: string | null;
  }): Promise<CompanyRecord>;
}

export interface CompanyProfileUpdatedEvent {
  readonly eventKey: "company.profile_updated";
  readonly companyId: TenantId;
  readonly actor: CompanyActor;
}

export type CompanyWritableStatus = Exclude<TenantStatus, "archived" | "suspended">;
