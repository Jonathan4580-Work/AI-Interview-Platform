import type { AuditRequestContext } from "@/modules/audit";
import type { CompanyActor } from "@/modules/tenant";
import type { TenantContext, TenantId } from "@/modules/tenant";
import type { Brand } from "@/shared";

export type DepartmentId = Brand<string, "DepartmentId">;
export type TeamId = Brand<string, "TeamId">;
export type TeamMemberId = Brand<string, "TeamMemberId">;
export type LocationId = Brand<string, "LocationId">;
export type OrganizationUserId = Brand<string, "OrganizationUserId">;

export type OrganizationStatus = "active" | "archived";
export type TeamMemberRole = "lead" | "member";
export type LocationMode = "onsite" | "hybrid" | "remote";

export interface OrganizationMutationContext {
  readonly tenant: TenantContext;
  readonly actor: CompanyActor;
  readonly request: AuditRequestContext;
  readonly supportAccessSessionId?: string | null;
}

export interface DepartmentRecord {
  readonly id: DepartmentId;
  readonly companyId: TenantId;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly status: OrganizationStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
}

export interface TeamRecord {
  readonly id: TeamId;
  readonly companyId: TenantId;
  readonly departmentId: DepartmentId | null;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly status: OrganizationStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
}

export interface TeamMemberRecord {
  readonly id: TeamMemberId;
  readonly companyId: TenantId;
  readonly teamId: TeamId;
  readonly userId: OrganizationUserId;
  readonly role: TeamMemberRole;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface LocationAddress {
  readonly line1?: string;
  readonly line2?: string;
  readonly city?: string;
  readonly region?: string;
  readonly postalCode?: string;
  readonly countryCode?: string;
}

export interface LocationRecord {
  readonly id: LocationId;
  readonly companyId: TenantId;
  readonly name: string;
  readonly slug: string;
  readonly mode: LocationMode;
  readonly status: OrganizationStatus;
  readonly address: LocationAddress | null;
  readonly timeZone: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
}

export interface CreateDepartmentInput extends OrganizationMutationContext {
  readonly name: string;
  readonly description?: string | null;
}

export interface UpdateDepartmentInput extends OrganizationMutationContext {
  readonly departmentId: DepartmentId;
  readonly name?: string;
  readonly description?: string | null;
}

export interface CreateTeamInput extends OrganizationMutationContext {
  readonly name: string;
  readonly departmentId?: DepartmentId | null;
  readonly description?: string | null;
}

export interface UpdateTeamInput extends OrganizationMutationContext {
  readonly teamId: TeamId;
  readonly name?: string;
  readonly departmentId?: DepartmentId | null;
  readonly description?: string | null;
}

export interface AddTeamMemberInput extends OrganizationMutationContext {
  readonly teamId: TeamId;
  readonly userId: OrganizationUserId;
  readonly role: TeamMemberRole;
}

export interface RemoveTeamMemberInput extends OrganizationMutationContext {
  readonly teamId: TeamId;
  readonly userId: OrganizationUserId;
}

export interface CreateLocationInput extends OrganizationMutationContext {
  readonly name: string;
  readonly mode: LocationMode;
  readonly address?: LocationAddress | null;
  readonly timeZone?: string | null;
}

export interface UpdateLocationInput extends OrganizationMutationContext {
  readonly locationId: LocationId;
  readonly name?: string;
  readonly mode?: LocationMode;
  readonly address?: LocationAddress | null;
  readonly timeZone?: string | null;
}

export interface OrganizationRepository {
  createDepartment(input: {
    readonly companyId: TenantId;
    readonly name: string;
    readonly slug: string;
    readonly description: string | null;
  }): Promise<DepartmentRecord>;
  findDepartment(
    tenant: TenantContext,
    departmentId: DepartmentId,
  ): Promise<DepartmentRecord | null>;
  updateDepartment(input: {
    readonly companyId: TenantId;
    readonly departmentId: DepartmentId;
    readonly name?: string;
    readonly slug?: string;
    readonly description?: string | null;
    readonly status?: OrganizationStatus;
    readonly deletedAt?: Date | null;
  }): Promise<DepartmentRecord>;
  createTeam(input: {
    readonly companyId: TenantId;
    readonly departmentId: DepartmentId | null;
    readonly name: string;
    readonly slug: string;
    readonly description: string | null;
  }): Promise<TeamRecord>;
  findTeam(tenant: TenantContext, teamId: TeamId): Promise<TeamRecord | null>;
  updateTeam(input: {
    readonly companyId: TenantId;
    readonly teamId: TeamId;
    readonly departmentId?: DepartmentId | null;
    readonly name?: string;
    readonly slug?: string;
    readonly description?: string | null;
    readonly status?: OrganizationStatus;
    readonly deletedAt?: Date | null;
  }): Promise<TeamRecord>;
  upsertTeamMember(input: {
    readonly companyId: TenantId;
    readonly teamId: TeamId;
    readonly userId: OrganizationUserId;
    readonly role: TeamMemberRole;
  }): Promise<TeamMemberRecord>;
  deleteTeamMember(input: {
    readonly companyId: TenantId;
    readonly teamId: TeamId;
    readonly userId: OrganizationUserId;
  }): Promise<TeamMemberRecord | null>;
  createLocation(input: {
    readonly companyId: TenantId;
    readonly name: string;
    readonly slug: string;
    readonly mode: LocationMode;
    readonly address: LocationAddress | null;
    readonly timeZone: string | null;
  }): Promise<LocationRecord>;
  findLocation(tenant: TenantContext, locationId: LocationId): Promise<LocationRecord | null>;
  updateLocation(input: {
    readonly companyId: TenantId;
    readonly locationId: LocationId;
    readonly name?: string;
    readonly slug?: string;
    readonly mode?: LocationMode;
    readonly address?: LocationAddress | null;
    readonly timeZone?: string | null;
    readonly status?: OrganizationStatus;
    readonly deletedAt?: Date | null;
  }): Promise<LocationRecord>;
}
