import {
  DepartmentStatus as PrismaDepartmentStatus,
  LocationMode as PrismaLocationMode,
  LocationStatus as PrismaLocationStatus,
  Prisma,
  TeamMemberRole as PrismaTeamMemberRole,
  TeamStatus as PrismaTeamStatus,
  type Department as PrismaDepartment,
  type Location as PrismaLocation,
  type Team as PrismaTeam,
  type TeamMember as PrismaTeamMember,
} from "@prisma/client";

import { prisma } from "@/infra/database";
import { assertTenantRecord } from "@/shared/repositories";

import type {
  DepartmentRecord,
  LocationAddress,
  LocationMode,
  LocationRecord,
  OrganizationRepository,
  OrganizationStatus,
  TeamMemberRecord,
  TeamMemberRole,
  TeamRecord,
} from "./types";
import type { TenantContext, TenantId } from "@/modules/tenant";

export class PrismaOrganizationRepository implements OrganizationRepository {
  public async createDepartment(
    input: Parameters<OrganizationRepository["createDepartment"]>[0],
  ): Promise<DepartmentRecord> {
    const department = await prisma.department.create({
      data: {
        companyId: input.companyId,
        name: input.name,
        slug: input.slug,
        description: input.description,
      },
    });
    return mapDepartment(department);
  }

  public async findDepartment(
    tenant: TenantContext,
    departmentId: DepartmentRecord["id"],
  ): Promise<DepartmentRecord | null> {
    const department = await prisma.department.findUnique({
      where: {
        companyId_id: {
          companyId: tenant.companyId,
          id: departmentId,
        },
      },
    });
    const tenantRecord = assertTenantRecord(tenant, department);
    return tenantRecord === null ? null : mapDepartment(tenantRecord);
  }

  public async updateDepartment(
    input: Parameters<OrganizationRepository["updateDepartment"]>[0],
  ): Promise<DepartmentRecord> {
    const department = await prisma.department.update({
      where: {
        companyId_id: {
          companyId: input.companyId,
          id: input.departmentId,
        },
      },
      data: {
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.slug === undefined ? {} : { slug: input.slug }),
        ...(input.description === undefined ? {} : { description: input.description }),
        ...(input.status === undefined ? {} : { status: toPrismaStatus(input.status) }),
        ...(input.deletedAt === undefined ? {} : { deletedAt: input.deletedAt }),
      },
    });
    return mapDepartment(department);
  }

  public async createTeam(
    input: Parameters<OrganizationRepository["createTeam"]>[0],
  ): Promise<TeamRecord> {
    const team = await prisma.team.create({
      data: {
        companyId: input.companyId,
        departmentId: input.departmentId,
        name: input.name,
        slug: input.slug,
        description: input.description,
      },
    });
    return mapTeam(team);
  }

  public async findTeam(
    tenant: TenantContext,
    teamId: TeamRecord["id"],
  ): Promise<TeamRecord | null> {
    const team = await prisma.team.findUnique({
      where: {
        companyId_id: {
          companyId: tenant.companyId,
          id: teamId,
        },
      },
    });
    const tenantRecord = assertTenantRecord(tenant, team);
    return tenantRecord === null ? null : mapTeam(tenantRecord);
  }

  public async updateTeam(
    input: Parameters<OrganizationRepository["updateTeam"]>[0],
  ): Promise<TeamRecord> {
    const team = await prisma.team.update({
      where: {
        companyId_id: {
          companyId: input.companyId,
          id: input.teamId,
        },
      },
      data: {
        ...(input.departmentId === undefined ? {} : { departmentId: input.departmentId }),
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.slug === undefined ? {} : { slug: input.slug }),
        ...(input.description === undefined ? {} : { description: input.description }),
        ...(input.status === undefined ? {} : { status: toPrismaTeamStatus(input.status) }),
        ...(input.deletedAt === undefined ? {} : { deletedAt: input.deletedAt }),
      },
    });
    return mapTeam(team);
  }

  public async upsertTeamMember(
    input: Parameters<OrganizationRepository["upsertTeamMember"]>[0],
  ): Promise<TeamMemberRecord> {
    const teamMember = await prisma.teamMember.upsert({
      where: {
        companyId_teamId_userId: {
          companyId: input.companyId,
          teamId: input.teamId,
          userId: input.userId,
        },
      },
      create: {
        companyId: input.companyId,
        teamId: input.teamId,
        userId: input.userId,
        role: toPrismaTeamMemberRole(input.role),
      },
      update: {
        role: toPrismaTeamMemberRole(input.role),
      },
    });
    return mapTeamMember(teamMember);
  }

  public async deleteTeamMember(
    input: Parameters<OrganizationRepository["deleteTeamMember"]>[0],
  ): Promise<TeamMemberRecord | null> {
    const existing = await prisma.teamMember.findUnique({
      where: {
        companyId_teamId_userId: {
          companyId: input.companyId,
          teamId: input.teamId,
          userId: input.userId,
        },
      },
    });
    if (existing === null) {
      return null;
    }

    const deleted = await prisma.teamMember.delete({
      where: {
        companyId_teamId_userId: {
          companyId: input.companyId,
          teamId: input.teamId,
          userId: input.userId,
        },
      },
    });
    return mapTeamMember(deleted);
  }

  public async createLocation(
    input: Parameters<OrganizationRepository["createLocation"]>[0],
  ): Promise<LocationRecord> {
    const location = await prisma.location.create({
      data: {
        companyId: input.companyId,
        name: input.name,
        slug: input.slug,
        mode: toPrismaLocationMode(input.mode),
        addressJson: input.address === null ? Prisma.DbNull : addressToJson(input.address),
        timeZone: input.timeZone,
      },
    });
    return mapLocation(location);
  }

  public async findLocation(
    tenant: TenantContext,
    locationId: LocationRecord["id"],
  ): Promise<LocationRecord | null> {
    const location = await prisma.location.findUnique({
      where: {
        companyId_id: {
          companyId: tenant.companyId,
          id: locationId,
        },
      },
    });
    const tenantRecord = assertTenantRecord(tenant, location);
    return tenantRecord === null ? null : mapLocation(tenantRecord);
  }

  public async updateLocation(
    input: Parameters<OrganizationRepository["updateLocation"]>[0],
  ): Promise<LocationRecord> {
    const location = await prisma.location.update({
      where: {
        companyId_id: {
          companyId: input.companyId,
          id: input.locationId,
        },
      },
      data: {
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.slug === undefined ? {} : { slug: input.slug }),
        ...(input.mode === undefined ? {} : { mode: toPrismaLocationMode(input.mode) }),
        ...(input.address === undefined
          ? {}
          : { addressJson: input.address === null ? Prisma.DbNull : addressToJson(input.address) }),
        ...(input.timeZone === undefined ? {} : { timeZone: input.timeZone }),
        ...(input.status === undefined ? {} : { status: toPrismaLocationStatus(input.status) }),
        ...(input.deletedAt === undefined ? {} : { deletedAt: input.deletedAt }),
      },
    });
    return mapLocation(location);
  }
}

function mapDepartment(record: PrismaDepartment): DepartmentRecord {
  return {
    id: record.id as DepartmentRecord["id"],
    companyId: record.companyId as TenantId,
    name: record.name,
    slug: record.slug,
    description: record.description,
    status: fromPrismaStatus(record.status),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    deletedAt: record.deletedAt,
  };
}

function mapTeam(record: PrismaTeam): TeamRecord {
  return {
    id: record.id as TeamRecord["id"],
    companyId: record.companyId as TenantId,
    departmentId: record.departmentId as TeamRecord["departmentId"],
    name: record.name,
    slug: record.slug,
    description: record.description,
    status: fromPrismaStatus(record.status),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    deletedAt: record.deletedAt,
  };
}

function mapTeamMember(record: PrismaTeamMember): TeamMemberRecord {
  return {
    id: record.id as TeamMemberRecord["id"],
    companyId: record.companyId as TenantId,
    teamId: record.teamId as TeamMemberRecord["teamId"],
    userId: record.userId as TeamMemberRecord["userId"],
    role: fromPrismaTeamMemberRole(record.role),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function mapLocation(record: PrismaLocation): LocationRecord {
  return {
    id: record.id as LocationRecord["id"],
    companyId: record.companyId as TenantId,
    name: record.name,
    slug: record.slug,
    mode: fromPrismaLocationMode(record.mode),
    status: fromPrismaStatus(record.status),
    address: readAddress(record.addressJson),
    timeZone: record.timeZone,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    deletedAt: record.deletedAt,
  };
}

function toPrismaStatus(status: OrganizationStatus): PrismaDepartmentStatus {
  return status === "active" ? PrismaDepartmentStatus.ACTIVE : PrismaDepartmentStatus.ARCHIVED;
}

function toPrismaTeamStatus(status: OrganizationStatus): PrismaTeamStatus {
  return status === "active" ? PrismaTeamStatus.ACTIVE : PrismaTeamStatus.ARCHIVED;
}

function toPrismaLocationStatus(status: OrganizationStatus): PrismaLocationStatus {
  return status === "active" ? PrismaLocationStatus.ACTIVE : PrismaLocationStatus.ARCHIVED;
}

function fromPrismaStatus(
  status: PrismaDepartmentStatus | PrismaTeamStatus | PrismaLocationStatus,
): OrganizationStatus {
  return status === "ACTIVE" ? "active" : "archived";
}

function toPrismaTeamMemberRole(role: TeamMemberRole): PrismaTeamMemberRole {
  return role === "lead" ? PrismaTeamMemberRole.LEAD : PrismaTeamMemberRole.MEMBER;
}

function fromPrismaTeamMemberRole(role: PrismaTeamMemberRole): TeamMemberRole {
  return role === "LEAD" ? "lead" : "member";
}

function toPrismaLocationMode(mode: LocationMode): PrismaLocationMode {
  switch (mode) {
    case "onsite":
      return PrismaLocationMode.ONSITE;
    case "hybrid":
      return PrismaLocationMode.HYBRID;
    case "remote":
      return PrismaLocationMode.REMOTE;
  }
}

function fromPrismaLocationMode(mode: PrismaLocationMode): LocationMode {
  switch (mode) {
    case "ONSITE":
      return "onsite";
    case "HYBRID":
      return "hybrid";
    case "REMOTE":
      return "remote";
  }
}

function addressToJson(address: LocationAddress): Prisma.InputJsonObject {
  return {
    ...(address.line1 === undefined ? {} : { line1: address.line1 }),
    ...(address.line2 === undefined ? {} : { line2: address.line2 }),
    ...(address.city === undefined ? {} : { city: address.city }),
    ...(address.region === undefined ? {} : { region: address.region }),
    ...(address.postalCode === undefined ? {} : { postalCode: address.postalCode }),
    ...(address.countryCode === undefined ? {} : { countryCode: address.countryCode }),
  };
}

function readAddress(value: Prisma.JsonValue): LocationAddress | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  return {
    ...(typeof value.line1 === "string" ? { line1: value.line1 } : {}),
    ...(typeof value.line2 === "string" ? { line2: value.line2 } : {}),
    ...(typeof value.city === "string" ? { city: value.city } : {}),
    ...(typeof value.region === "string" ? { region: value.region } : {}),
    ...(typeof value.postalCode === "string" ? { postalCode: value.postalCode } : {}),
    ...(typeof value.countryCode === "string" ? { countryCode: value.countryCode } : {}),
  };
}
