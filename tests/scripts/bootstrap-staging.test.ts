import { describe, expect, it } from "vitest";

import {
  bootstrapStaging,
  renderBootstrapResult,
  type StagingBootstrapDatabase,
  type StagingBootstrapInput,
  type StagingBootstrapTransaction,
} from "../../scripts/bootstrap-staging";
import { verifyPassword } from "../../src/modules/auth/password";

const validInput: StagingBootstrapInput = {
  platformAdminEmail: "Platform.Admin@Example.com",
  platformAdminName: "Staging Platform Admin",
  platformAdminPassword: "StrongPlatform123",
  companyName: "Aptly Staging Workspace",
  companySlug: "aptly-staging",
  companyAdminEmail: "Company.Admin@Example.com",
  companyAdminName: "Staging Company Admin",
  companyAdminPassword: "StrongCompany123",
};

describe("staging bootstrap", () => {
  it("creates the first platform admin, company, and company admin", async () => {
    const database = new MemoryBootstrapDatabase();

    const result = await bootstrapStaging(validInput, { prisma: database, now: fixedDate });

    expect(result.platformAdminStatus).toBe("created");
    expect(result.companyStatus).toBe("created");
    expect(result.companyAdminStatus).toBe("created");
    expect(result.platformAdminEmail).toBe("platform.admin@example.com");
    expect(result.companyAdminEmail).toBe("company.admin@example.com");
    expect(result.companySlug).toBe("aptly-staging");
    expect(database.platformUsers).toHaveLength(1);
    expect(database.companies).toHaveLength(1);
    expect(database.users).toHaveLength(1);
    expect(database.authCredentials).toHaveLength(2);
    expect(database.userRoles).toHaveLength(1);
    expect(
      verifyPassword("StrongPlatform123", database.authCredentials[0]?.passwordHash ?? ""),
    ).toBe(true);
    expect(
      verifyPassword("StrongCompany123", database.authCredentials[1]?.passwordHash ?? ""),
    ).toBe(true);
  });

  it("is idempotent on the second run and prevents duplicates", async () => {
    const database = new MemoryBootstrapDatabase();

    const first = await bootstrapStaging(validInput, { prisma: database, now: fixedDate });
    const second = await bootstrapStaging(validInput, { prisma: database, now: fixedDate });

    expect(first.companyId).toBe(second.companyId);
    expect(second.platformAdminStatus).toBe("already existed");
    expect(second.companyStatus).toBe("already existed");
    expect(second.companyAdminStatus).toBe("already existed");
    expect(database.platformUsers).toHaveLength(1);
    expect(database.companies).toHaveLength(1);
    expect(database.users).toHaveLength(1);
    expect(database.authCredentials).toHaveLength(2);
    expect(database.userRoles).toHaveLength(1);
  });

  it("rejects weak passwords using the existing password policy", async () => {
    const database = new MemoryBootstrapDatabase();

    await expect(
      bootstrapStaging(
        {
          ...validInput,
          platformAdminPassword: "weak",
        },
        { prisma: database, now: fixedDate },
      ),
    ).rejects.toThrow("Password must be at least 12 characters.");
  });

  it("does not print password values", async () => {
    const database = new MemoryBootstrapDatabase();

    const result = await bootstrapStaging(validInput, { prisma: database, now: fixedDate });
    const output = renderBootstrapResult(result);

    expect(output).not.toContain(validInput.platformAdminPassword);
    expect(output).not.toContain(validInput.companyAdminPassword);
    expect(output).toContain("Platform login: choose Platform");
    expect(output).toContain("Company login: choose Company");
  });

  it("reuses existing accounts without silently resetting passwords", async () => {
    const database = new MemoryBootstrapDatabase();

    await bootstrapStaging(validInput, { prisma: database, now: fixedDate });
    const originalPlatformHash = database.authCredentials[0]?.passwordHash;
    const originalCompanyHash = database.authCredentials[1]?.passwordHash;

    await bootstrapStaging(
      {
        ...validInput,
        platformAdminPassword: "DifferentPlatform123",
        companyAdminPassword: "DifferentCompany123",
      },
      { prisma: database, now: new Date("2026-07-01T01:00:00.000Z") },
    );

    expect(database.authCredentials[0]?.passwordHash).toBe(originalPlatformHash);
    expect(database.authCredentials[1]?.passwordHash).toBe(originalCompanyHash);
    expect(
      verifyPassword("DifferentPlatform123", database.authCredentials[0]?.passwordHash ?? ""),
    ).toBe(false);
    expect(
      verifyPassword("DifferentCompany123", database.authCredentials[1]?.passwordHash ?? ""),
    ).toBe(false);
  });
});

const fixedDate = new Date("2026-07-01T00:00:00.000Z");

interface PlatformUserRecord {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly status: "ACTIVE" | "DISABLED";
}

interface CompanyRecord {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly status: "ACTIVE" | "SUSPENDED" | "TRIALING" | "ARCHIVED";
  readonly deletedAt: Date | null;
}

interface UserRecord {
  readonly id: string;
  readonly companyId: string;
  readonly email: string;
  readonly name: string;
  readonly status: "INVITED" | "ACTIVE" | "DISABLED";
  readonly deletedAt: Date | null;
}

interface RoleRecord {
  readonly id: string;
  readonly companyId: string;
  readonly key: string;
}

interface PermissionRecord {
  readonly id: string;
  readonly key: string;
}

interface AuthCredentialRecord {
  readonly id: string;
  readonly subjectType: "PLATFORM_USER" | "USER";
  readonly platformUserId?: string;
  readonly companyId?: string;
  readonly userId?: string;
  readonly passwordHash: string;
}

interface UserRoleRecord {
  readonly companyId: string;
  readonly userId: string;
  readonly roleId: string;
}

class MemoryBootstrapDatabase implements StagingBootstrapDatabase {
  public readonly platformUsers: PlatformUserRecord[] = [];
  public readonly companies: CompanyRecord[] = [];
  public readonly users: UserRecord[] = [];
  public readonly roles: RoleRecord[] = [];
  public readonly permissions: PermissionRecord[] = [];
  public readonly authCredentials: AuthCredentialRecord[] = [];
  public readonly userRoles: UserRoleRecord[] = [];

  public $transaction<T>(operation: (tx: StagingBootstrapTransaction) => Promise<T>): Promise<T> {
    return operation(this.createTransaction());
  }

  private createTransaction(): StagingBootstrapTransaction {
    return {
      platformUser: {
        findUnique: ({ where }) =>
          Promise.resolve(this.platformUsers.find((user) => user.email === where.email) ?? null),
        create: ({ data }) => {
          const record: PlatformUserRecord = {
            id: nextId("platform_user", this.platformUsers.length),
            ...data,
          };
          this.platformUsers.push(record);
          return Promise.resolve(record);
        },
      },
      company: {
        findUnique: ({ where }) =>
          Promise.resolve(this.companies.find((company) => company.slug === where.slug) ?? null),
        create: ({ data }) => {
          const record: CompanyRecord = {
            id: nextId("company", this.companies.length),
            deletedAt: null,
            ...data,
          };
          this.companies.push(record);
          return Promise.resolve(record);
        },
      },
      permission: {
        createMany: ({ data }) => {
          for (const permission of data) {
            if (!this.permissions.some((existing) => existing.key === permission.key)) {
              this.permissions.push({
                id: nextId("permission", this.permissions.length),
                key: permission.key,
              });
            }
          }
          return Promise.resolve();
        },
        findMany: ({ where }) =>
          Promise.resolve(
            this.permissions
              .filter((permission) => where.key.in.includes(permission.key))
              .map((permission) => ({ id: permission.id })),
          ),
      },
      role: {
        upsert: ({ where, create }) => {
          const existing = this.roles.find(
            (role) =>
              role.companyId === where.companyId_key.companyId &&
              role.key === where.companyId_key.key,
          );
          if (existing !== undefined) {
            return Promise.resolve(existing);
          }
          const record: RoleRecord = {
            id: nextId("role", this.roles.length),
            companyId: create.companyId,
            key: create.key,
          };
          this.roles.push(record);
          return Promise.resolve(record);
        },
      },
      rolePermission: {
        createMany: () => Promise.resolve(),
      },
      user: {
        findUnique: ({ where }) =>
          Promise.resolve(
            this.users.find(
              (user) =>
                user.companyId === where.companyId_email.companyId &&
                user.email === where.companyId_email.email,
            ) ?? null,
          ),
        create: ({ data }) => {
          const record: UserRecord = {
            id: nextId("user", this.users.length),
            deletedAt: null,
            ...data,
          };
          this.users.push(record);
          return Promise.resolve(record);
        },
        update: ({ where, data }) => {
          const user = this.users.find(
            (candidate) =>
              candidate.companyId === where.companyId_email.companyId &&
              candidate.email === where.companyId_email.email,
          );
          if (user === undefined) {
            throw new Error("User not found.");
          }
          const updated = { ...user, status: data.status };
          this.users.splice(this.users.indexOf(user), 1, updated);
          return Promise.resolve(updated);
        },
      },
      authCredential: {
        findUnique: ({ where }) => {
          if ("platformUserId" in where) {
            return Promise.resolve(
              this.authCredentials.find(
                (credential) => credential.platformUserId === where.platformUserId,
              ) ?? null,
            );
          }
          return Promise.resolve(
            this.authCredentials.find(
              (credential) =>
                credential.companyId === where.companyId_userId.companyId &&
                credential.userId === where.companyId_userId.userId,
            ) ?? null,
          );
        },
        create: ({ data }) => {
          this.authCredentials.push({
            id: nextId("credential", this.authCredentials.length),
            ...data,
          });
          return Promise.resolve();
        },
      },
      userRole: {
        upsert: ({ where, create }) => {
          const existing = this.userRoles.find(
            (role) =>
              role.userId === where.userId_roleId.userId &&
              role.roleId === where.userId_roleId.roleId,
          );
          if (existing === undefined) {
            this.userRoles.push(create);
          }
          return Promise.resolve();
        },
      },
    };
  }
}

function nextId(prefix: string, index: number): string {
  return `${prefix}_${String(index + 1)}`;
}
