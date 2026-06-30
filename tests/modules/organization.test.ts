import { describe, expect, it } from "vitest";

import { AuditWriter } from "@/modules/audit";
import { createTenantContext } from "@/modules/tenant";
import { OrganizationDomainError, OrganizationService } from "@/modules/organization";

import type { AuditEventStore, PersistedAuditEventInput } from "@/modules/audit";
import type { CompanyUserId, TenantContext, TenantId } from "@/modules/tenant";
import type {
  DepartmentId,
  DepartmentRecord,
  LocationId,
  LocationRecord,
  OrganizationRepository,
  OrganizationUserId,
  TeamId,
  TeamMemberRecord,
  TeamRecord,
} from "@/modules/organization";

const tenant = createTenantContext("cm0tenant001");
const otherTenant = createTenantContext("cm0tenant002");
const actor = { type: "user" as const, id: "user-1" as CompanyUserId };
const request = {
  requestId: "req-1",
  correlationId: "corr-1",
  sessionId: "sess-1",
  ipAddress: "127.0.0.1",
  userAgent: "vitest",
};

class RecordingAuditStore implements AuditEventStore {
  public readonly events: PersistedAuditEventInput[] = [];

  public append(event: PersistedAuditEventInput): Promise<void> {
    this.events.push(event);
    return Promise.resolve();
  }
}

class MemoryOrganizationRepository implements OrganizationRepository {
  public readonly departments = new Map<string, DepartmentRecord>();
  public readonly teams = new Map<string, TeamRecord>();
  public readonly teamMembers = new Map<string, TeamMemberRecord>();
  public readonly locations = new Map<string, LocationRecord>();

  public createDepartment(
    input: Parameters<OrganizationRepository["createDepartment"]>[0],
  ): Promise<DepartmentRecord> {
    const department: DepartmentRecord = {
      id: `dept-${String(this.departments.size + 1)}` as DepartmentId,
      companyId: input.companyId,
      name: input.name,
      slug: input.slug,
      description: input.description,
      status: "active",
      createdAt: new Date("2026-06-30T00:00:00.000Z"),
      updatedAt: new Date("2026-06-30T00:00:00.000Z"),
      deletedAt: null,
    };
    this.departments.set(key(input.companyId, department.id), department);
    return Promise.resolve(department);
  }

  public findDepartment(
    tenantContext: TenantContext,
    departmentId: DepartmentId,
  ): Promise<DepartmentRecord | null> {
    return Promise.resolve(
      this.departments.get(key(tenantContext.companyId, departmentId)) ?? null,
    );
  }

  public updateDepartment(
    input: Parameters<OrganizationRepository["updateDepartment"]>[0],
  ): Promise<DepartmentRecord> {
    const department = this.departments.get(key(input.companyId, input.departmentId));
    if (department === undefined) {
      throw new Error("Department missing");
    }
    const updated: DepartmentRecord = {
      ...department,
      name: input.name ?? department.name,
      slug: input.slug ?? department.slug,
      description: input.description === undefined ? department.description : input.description,
      status: input.status ?? department.status,
      deletedAt: input.deletedAt === undefined ? department.deletedAt : input.deletedAt,
      updatedAt: new Date("2026-06-30T01:00:00.000Z"),
    };
    this.departments.set(key(input.companyId, input.departmentId), updated);
    return Promise.resolve(updated);
  }

  public createTeam(
    input: Parameters<OrganizationRepository["createTeam"]>[0],
  ): Promise<TeamRecord> {
    const team: TeamRecord = {
      id: `team-${String(this.teams.size + 1)}` as TeamId,
      companyId: input.companyId,
      departmentId: input.departmentId,
      name: input.name,
      slug: input.slug,
      description: input.description,
      status: "active",
      createdAt: new Date("2026-06-30T00:00:00.000Z"),
      updatedAt: new Date("2026-06-30T00:00:00.000Z"),
      deletedAt: null,
    };
    this.teams.set(key(input.companyId, team.id), team);
    return Promise.resolve(team);
  }

  public findTeam(tenantContext: TenantContext, teamId: TeamId): Promise<TeamRecord | null> {
    return Promise.resolve(this.teams.get(key(tenantContext.companyId, teamId)) ?? null);
  }

  public updateTeam(
    input: Parameters<OrganizationRepository["updateTeam"]>[0],
  ): Promise<TeamRecord> {
    const team = this.teams.get(key(input.companyId, input.teamId));
    if (team === undefined) {
      throw new Error("Team missing");
    }
    const updated: TeamRecord = {
      ...team,
      departmentId: input.departmentId === undefined ? team.departmentId : input.departmentId,
      name: input.name ?? team.name,
      slug: input.slug ?? team.slug,
      description: input.description === undefined ? team.description : input.description,
      status: input.status ?? team.status,
      deletedAt: input.deletedAt === undefined ? team.deletedAt : input.deletedAt,
      updatedAt: new Date("2026-06-30T01:00:00.000Z"),
    };
    this.teams.set(key(input.companyId, input.teamId), updated);
    return Promise.resolve(updated);
  }

  public upsertTeamMember(
    input: Parameters<OrganizationRepository["upsertTeamMember"]>[0],
  ): Promise<TeamMemberRecord> {
    const memberKey = key(input.companyId, `${input.teamId}:${input.userId}`);
    const member: TeamMemberRecord = {
      id: (this.teamMembers.get(memberKey)?.id ??
        `member-${String(this.teamMembers.size + 1)}`) as TeamMemberRecord["id"],
      companyId: input.companyId,
      teamId: input.teamId,
      userId: input.userId,
      role: input.role,
      createdAt: new Date("2026-06-30T00:00:00.000Z"),
      updatedAt: new Date("2026-06-30T01:00:00.000Z"),
    };
    this.teamMembers.set(memberKey, member);
    return Promise.resolve(member);
  }

  public deleteTeamMember(
    input: Parameters<OrganizationRepository["deleteTeamMember"]>[0],
  ): Promise<TeamMemberRecord | null> {
    const memberKey = key(input.companyId, `${input.teamId}:${input.userId}`);
    const member = this.teamMembers.get(memberKey) ?? null;
    this.teamMembers.delete(memberKey);
    return Promise.resolve(member);
  }

  public createLocation(
    input: Parameters<OrganizationRepository["createLocation"]>[0],
  ): Promise<LocationRecord> {
    const location: LocationRecord = {
      id: `loc-${String(this.locations.size + 1)}` as LocationId,
      companyId: input.companyId,
      name: input.name,
      slug: input.slug,
      mode: input.mode,
      status: "active",
      address: input.address,
      timeZone: input.timeZone,
      createdAt: new Date("2026-06-30T00:00:00.000Z"),
      updatedAt: new Date("2026-06-30T00:00:00.000Z"),
      deletedAt: null,
    };
    this.locations.set(key(input.companyId, location.id), location);
    return Promise.resolve(location);
  }

  public findLocation(
    tenantContext: TenantContext,
    locationId: LocationId,
  ): Promise<LocationRecord | null> {
    return Promise.resolve(this.locations.get(key(tenantContext.companyId, locationId)) ?? null);
  }

  public updateLocation(
    input: Parameters<OrganizationRepository["updateLocation"]>[0],
  ): Promise<LocationRecord> {
    const location = this.locations.get(key(input.companyId, input.locationId));
    if (location === undefined) {
      throw new Error("Location missing");
    }
    const updated: LocationRecord = {
      ...location,
      name: input.name ?? location.name,
      slug: input.slug ?? location.slug,
      mode: input.mode ?? location.mode,
      address: input.address === undefined ? location.address : input.address,
      timeZone: input.timeZone === undefined ? location.timeZone : input.timeZone,
      status: input.status ?? location.status,
      deletedAt: input.deletedAt === undefined ? location.deletedAt : input.deletedAt,
      updatedAt: new Date("2026-06-30T01:00:00.000Z"),
    };
    this.locations.set(key(input.companyId, input.locationId), updated);
    return Promise.resolve(updated);
  }
}

describe("organization domain", () => {
  it("creates departments with normalized names and audit events", async () => {
    const auditStore = new RecordingAuditStore();
    const service = new OrganizationService(
      new MemoryOrganizationRepository(),
      new AuditWriter(auditStore),
    );

    const department = await service.createDepartment({
      tenant,
      actor,
      request,
      name: "  Product   Engineering ",
      description: " Builds hiring workflows ",
    });

    expect(department).toMatchObject({
      name: "Product Engineering",
      slug: "product-engineering",
      description: "Builds hiring workflows",
    });
    expect(auditStore.events[0]).toMatchObject({
      action: "organization.department_created",
      companyId: tenant.companyId,
      resourceType: "department",
    });
  });

  it("rejects cross-tenant department references when creating teams", async () => {
    const repository = new MemoryOrganizationRepository();
    const service = new OrganizationService(repository, new AuditWriter(new RecordingAuditStore()));
    const otherDepartment = await repository.createDepartment({
      companyId: otherTenant.companyId,
      name: "Operations",
      slug: "operations",
      description: null,
    });

    await expect(
      service.createTeam({
        tenant,
        actor,
        request,
        name: "Recruiting Ops",
        departmentId: otherDepartment.id,
      }),
    ).rejects.toBeInstanceOf(OrganizationDomainError);
  });

  it("archives departments and blocks later mutation", async () => {
    const repository = new MemoryOrganizationRepository();
    const service = new OrganizationService(repository, new AuditWriter(new RecordingAuditStore()));
    const department = await service.createDepartment({
      tenant,
      actor,
      request,
      name: "Finance",
    });

    await service.archiveDepartment({
      tenant,
      actor,
      request,
      departmentId: department.id,
    });

    await expect(
      service.updateDepartment({
        tenant,
        actor,
        request,
        departmentId: department.id,
        name: "Finance Team",
      }),
    ).rejects.toBeInstanceOf(OrganizationDomainError);
  });

  it("manages team membership through tenant-scoped teams", async () => {
    const repository = new MemoryOrganizationRepository();
    const auditStore = new RecordingAuditStore();
    const service = new OrganizationService(repository, new AuditWriter(auditStore));
    const team = await service.createTeam({
      tenant,
      actor,
      request,
      name: "Hiring Team",
    });

    const member = await service.addTeamMember({
      tenant,
      actor,
      request,
      teamId: team.id,
      userId: "user-2" as OrganizationUserId,
      role: "lead",
    });

    expect(member).toMatchObject({
      teamId: team.id,
      userId: "user-2",
      role: "lead",
    });
    expect(auditStore.events.map((event) => event.action)).toContain(
      "organization.team_member_added",
    );
  });

  it("normalizes locations and validates time zones", async () => {
    const service = new OrganizationService(
      new MemoryOrganizationRepository(),
      new AuditWriter(new RecordingAuditStore()),
    );

    const location = await service.createLocation({
      tenant,
      actor,
      request,
      name: "  New York Office ",
      mode: "hybrid",
      timeZone: "America/New_York",
      address: {
        line1: "  10 Main St ",
        city: " New York ",
        countryCode: "us",
      },
    });

    expect(location).toMatchObject({
      name: "New York Office",
      slug: "new-york-office",
      address: {
        line1: "10 Main St",
        city: "New York",
        countryCode: "US",
      },
    });

    await expect(
      service.createLocation({
        tenant,
        actor,
        request,
        name: "Invalid Time",
        mode: "remote",
        timeZone: "Not/A_Zone",
      }),
    ).rejects.toBeInstanceOf(OrganizationDomainError);
  });
});

function key(companyId: TenantId, id: string): string {
  return `${companyId}:${id}`;
}
