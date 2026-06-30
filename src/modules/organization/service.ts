import { AuditWriter } from "@/modules/audit";

import type {
  AddTeamMemberInput,
  CreateDepartmentInput,
  CreateLocationInput,
  CreateTeamInput,
  DepartmentId,
  DepartmentRecord,
  LocationAddress,
  LocationRecord,
  OrganizationMutationContext,
  OrganizationRepository,
  RemoveTeamMemberInput,
  TeamMemberRecord,
  TeamRecord,
  UpdateDepartmentInput,
  UpdateLocationInput,
  UpdateTeamInput,
} from "./types";

export class OrganizationDomainError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "OrganizationDomainError";
  }
}

export class OrganizationService {
  public constructor(
    private readonly repository: OrganizationRepository,
    private readonly auditWriter: AuditWriter,
  ) {}

  public async createDepartment(input: CreateDepartmentInput): Promise<DepartmentRecord> {
    const name = normalizeDisplayName(input.name, "Department name");
    const description = normalizeOptionalText(input.description, 500, "Department description");

    const department = await this.repository.createDepartment({
      companyId: input.tenant.companyId,
      name,
      slug: slugify(name),
      description,
    });

    await this.writeAudit(input, "organization.department_created", "department", department.id, {
      after: department,
    });

    return department;
  }

  public async updateDepartment(input: UpdateDepartmentInput): Promise<DepartmentRecord> {
    const existing = await this.requireDepartment(input, input.departmentId);
    assertActive(existing.status, "Department");
    const name =
      input.name === undefined ? undefined : normalizeDisplayName(input.name, "Department name");

    const department = await this.repository.updateDepartment({
      companyId: input.tenant.companyId,
      departmentId: input.departmentId,
      name,
      slug: name === undefined ? undefined : slugify(name),
      description:
        input.description === undefined
          ? undefined
          : normalizeOptionalText(input.description, 500, "Department description"),
    });

    await this.writeAudit(input, "organization.department_updated", "department", department.id, {
      before: existing,
      after: department,
    });

    return department;
  }

  public async archiveDepartment(input: UpdateDepartmentInput): Promise<DepartmentRecord> {
    const existing = await this.requireDepartment(input, input.departmentId);
    assertActive(existing.status, "Department");

    const department = await this.repository.updateDepartment({
      companyId: input.tenant.companyId,
      departmentId: input.departmentId,
      status: "archived",
      deletedAt: new Date(),
    });

    await this.writeAudit(input, "organization.department_archived", "department", department.id, {
      before: existing,
      after: department,
    });

    return department;
  }

  public async createTeam(input: CreateTeamInput): Promise<TeamRecord> {
    const name = normalizeDisplayName(input.name, "Team name");
    const departmentId = await this.normalizeDepartmentReference(input, input.departmentId ?? null);
    const description = normalizeOptionalText(input.description, 500, "Team description");

    const team = await this.repository.createTeam({
      companyId: input.tenant.companyId,
      departmentId,
      name,
      slug: slugify(name),
      description,
    });

    await this.writeAudit(input, "organization.team_created", "team", team.id, {
      after: team,
    });

    return team;
  }

  public async updateTeam(input: UpdateTeamInput): Promise<TeamRecord> {
    const existing = await this.requireTeam(input, input.teamId);
    assertActive(existing.status, "Team");
    const name =
      input.name === undefined ? undefined : normalizeDisplayName(input.name, "Team name");
    const departmentId =
      input.departmentId === undefined
        ? undefined
        : await this.normalizeDepartmentReference(input, input.departmentId);

    const team = await this.repository.updateTeam({
      companyId: input.tenant.companyId,
      teamId: input.teamId,
      departmentId,
      name,
      slug: name === undefined ? undefined : slugify(name),
      description:
        input.description === undefined
          ? undefined
          : normalizeOptionalText(input.description, 500, "Team description"),
    });

    await this.writeAudit(input, "organization.team_updated", "team", team.id, {
      before: existing,
      after: team,
    });

    return team;
  }

  public async addTeamMember(input: AddTeamMemberInput): Promise<TeamMemberRecord> {
    const team = await this.requireTeam(input, input.teamId);
    assertActive(team.status, "Team");

    const member = await this.repository.upsertTeamMember({
      companyId: input.tenant.companyId,
      teamId: input.teamId,
      userId: input.userId,
      role: input.role,
    });

    await this.writeAudit(input, "organization.team_member_added", "team_member", member.id, {
      after: member,
    });

    return member;
  }

  public async removeTeamMember(input: RemoveTeamMemberInput): Promise<TeamMemberRecord | null> {
    await this.requireTeam(input, input.teamId);

    const member = await this.repository.deleteTeamMember({
      companyId: input.tenant.companyId,
      teamId: input.teamId,
      userId: input.userId,
    });

    if (member !== null) {
      await this.writeAudit(input, "organization.team_member_removed", "team_member", member.id, {
        before: member,
      });
    }

    return member;
  }

  public async createLocation(input: CreateLocationInput): Promise<LocationRecord> {
    const name = normalizeDisplayName(input.name, "Location name");
    const address = normalizeAddress(input.address ?? null);
    const timeZone = normalizeTimeZone(input.timeZone ?? null);

    const location = await this.repository.createLocation({
      companyId: input.tenant.companyId,
      name,
      slug: slugify(name),
      mode: input.mode,
      address,
      timeZone,
    });

    await this.writeAudit(input, "organization.location_created", "location", location.id, {
      after: location,
    });

    return location;
  }

  public async updateLocation(input: UpdateLocationInput): Promise<LocationRecord> {
    const existing = await this.requireLocation(input, input.locationId);
    assertActive(existing.status, "Location");
    const name =
      input.name === undefined ? undefined : normalizeDisplayName(input.name, "Location name");

    const location = await this.repository.updateLocation({
      companyId: input.tenant.companyId,
      locationId: input.locationId,
      name,
      slug: name === undefined ? undefined : slugify(name),
      mode: input.mode,
      address: input.address === undefined ? undefined : normalizeAddress(input.address),
      timeZone: input.timeZone === undefined ? undefined : normalizeTimeZone(input.timeZone),
    });

    await this.writeAudit(input, "organization.location_updated", "location", location.id, {
      before: existing,
      after: location,
    });

    return location;
  }

  public async archiveLocation(input: UpdateLocationInput): Promise<LocationRecord> {
    const existing = await this.requireLocation(input, input.locationId);
    assertActive(existing.status, "Location");

    const location = await this.repository.updateLocation({
      companyId: input.tenant.companyId,
      locationId: input.locationId,
      status: "archived",
      deletedAt: new Date(),
    });

    await this.writeAudit(input, "organization.location_archived", "location", location.id, {
      before: existing,
      after: location,
    });

    return location;
  }

  private async normalizeDepartmentReference(
    context: OrganizationMutationContext,
    departmentId: DepartmentId | null,
  ): Promise<DepartmentId | null> {
    if (departmentId === null) {
      return null;
    }

    const department = await this.requireDepartment(context, departmentId);
    assertActive(department.status, "Department");
    return department.id;
  }

  private async requireDepartment(
    context: OrganizationMutationContext,
    departmentId: DepartmentId,
  ): Promise<DepartmentRecord> {
    const department = await this.repository.findDepartment(context.tenant, departmentId);
    if (department === null) {
      throw new OrganizationDomainError("Department was not found for this company.");
    }
    return department;
  }

  private async requireTeam(
    context: OrganizationMutationContext,
    teamId: TeamRecord["id"],
  ): Promise<TeamRecord> {
    const team = await this.repository.findTeam(context.tenant, teamId);
    if (team === null) {
      throw new OrganizationDomainError("Team was not found for this company.");
    }
    return team;
  }

  private async requireLocation(
    context: OrganizationMutationContext,
    locationId: LocationRecord["id"],
  ): Promise<LocationRecord> {
    const location = await this.repository.findLocation(context.tenant, locationId);
    if (location === null) {
      throw new OrganizationDomainError("Location was not found for this company.");
    }
    return location;
  }

  private async writeAudit(
    context: OrganizationMutationContext,
    action: string,
    resourceType: string,
    resourceId: string,
    snapshots: { readonly before?: unknown; readonly after?: unknown },
  ): Promise<void> {
    await this.auditWriter.record({
      companyId: context.tenant.companyId,
      actor:
        context.actor.type === "system"
          ? { type: "system", id: null }
          : { type: context.actor.type, id: context.actor.id },
      request: context.request,
      supportAccessSessionId: context.supportAccessSessionId,
      action,
      resourceType,
      resourceId,
      riskLevel: "medium",
      before: snapshots.before,
      after: snapshots.after,
    });
  }
}

function assertActive(status: string, entity: string): void {
  if (status !== "active") {
    throw new OrganizationDomainError(`${entity} is archived and cannot be changed.`);
  }
}

export function normalizeDisplayName(value: string, label: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length < 2 || normalized.length > 120) {
    throw new OrganizationDomainError(`${label} must be between 2 and 120 characters.`);
  }
  return normalized;
}

export function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  if (slug.length < 2 || slug.length > 140) {
    throw new OrganizationDomainError("Generated slug must be between 2 and 140 characters.");
  }

  return slug;
}

function normalizeOptionalText(
  value: string | null | undefined,
  maxLength: number,
  label: string,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length === 0) {
    return null;
  }
  if (normalized.length > maxLength) {
    throw new OrganizationDomainError(`${label} cannot exceed ${String(maxLength)} characters.`);
  }
  return normalized;
}

function normalizeAddress(value: LocationAddress | null): LocationAddress | null {
  if (value === null) {
    return null;
  }

  const normalized = {
    line1: normalizeAddressField(value.line1, 160, "Address line 1"),
    line2: normalizeAddressField(value.line2, 160, "Address line 2"),
    city: normalizeAddressField(value.city, 100, "City"),
    region: normalizeAddressField(value.region, 100, "Region"),
    postalCode: normalizeAddressField(value.postalCode, 32, "Postal code"),
    countryCode: normalizeCountryCode(value.countryCode),
  };

  return Object.fromEntries(
    Object.entries(normalized).filter(([, fieldValue]) => fieldValue !== undefined),
  );
}

function normalizeAddressField(
  value: string | undefined,
  maxLength: number,
  label: string,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length === 0) {
    return undefined;
  }
  if (normalized.length > maxLength) {
    throw new OrganizationDomainError(`${label} cannot exceed ${String(maxLength)} characters.`);
  }
  return normalized;
}

function normalizeCountryCode(value: string | undefined): string | undefined {
  if (value === undefined || value.trim().length === 0) {
    return undefined;
  }

  const code = value.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) {
    throw new OrganizationDomainError("Country code must be a two-letter ISO 3166-1 code.");
  }
  return code;
}

function normalizeTimeZone(value: string | null): string | null {
  if (value === null || value.trim().length === 0) {
    return null;
  }

  const normalized = value.trim();
  try {
    Intl.DateTimeFormat(undefined, { timeZone: normalized });
  } catch {
    throw new OrganizationDomainError("Time zone must be a valid IANA time zone.");
  }
  return normalized;
}
