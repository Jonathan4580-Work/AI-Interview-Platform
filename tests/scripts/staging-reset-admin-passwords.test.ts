import { describe, expect, it } from "vitest";

import {
  assertStagingOnly,
  renderPasswordResetResult,
  resetStagingAdminPasswords,
  type StagingAdminPasswordResetInput,
  type StagingPasswordResetDatabase,
  type StagingPasswordResetTransaction,
} from "../../scripts/staging-reset-admin-passwords";
import { verifyPassword } from "../../src/modules/auth/password";

const fixedDate = new Date("2026-07-01T00:00:00.000Z");
const validInput: StagingAdminPasswordResetInput = {
  platformAdminEmail: "Platform.Admin@Example.com",
  platformAdminPassword: "NewPlatform123",
  companyAdminEmail: "Company.Admin@Example.com",
  companyAdminPassword: "NewCompany123",
  companyWorkspaceId: "company_1",
};

describe("staging reset admin passwords", () => {
  it("resets the platform account password", async () => {
    const database = MemoryPasswordResetDatabase.seeded();

    const result = await resetStagingAdminPasswords(validInput, {
      prisma: database,
      now: fixedDate,
    });

    expect(result.platformAdmin.exists).toBe(true);
    expect(result.platformAdmin.credentialAction).toBe("updated");
    expect(result.platformAdmin.revokedSessions).toBe(1);
    expect(verifyPassword("NewPlatform123", database.platformCredential.passwordHash)).toBe(true);
  });

  it("resets the company account password", async () => {
    const database = MemoryPasswordResetDatabase.seeded();

    const result = await resetStagingAdminPasswords(validInput, {
      prisma: database,
      now: fixedDate,
    });

    expect(result.companyAdmin.exists).toBe(true);
    expect(result.companyAdmin.workspaceMatch).toBe(true);
    expect(result.companyAdmin.credentialAction).toBe("updated");
    expect(result.companyAdmin.revokedSessions).toBe(1);
    expect(verifyPassword("NewCompany123", database.companyCredential.passwordHash)).toBe(true);
  });

  it("rejects the wrong workspace", async () => {
    const database = MemoryPasswordResetDatabase.seeded();
    database.companies.push({ id: "company_2", status: "ACTIVE", deletedAt: null });

    await expect(
      resetStagingAdminPasswords(
        {
          ...validInput,
          companyWorkspaceId: "company_2",
        },
        { prisma: database, now: fixedDate },
      ),
    ).rejects.toThrow("Company Admin does not belong to the provided workspace.");
  });

  it("reports a missing account without creating a duplicate user", async () => {
    const database = MemoryPasswordResetDatabase.seeded();

    const result = await resetStagingAdminPasswords(
      {
        ...validInput,
        companyAdminEmail: "missing@example.com",
      },
      { prisma: database, now: fixedDate },
    );

    expect(result.companyAdmin.exists).toBe(false);
    expect(result.companyAdmin.credentialAction).toBe("skipped");
    expect(database.users).toHaveLength(1);
  });

  it("rejects weak passwords through the existing password policy", async () => {
    const database = MemoryPasswordResetDatabase.seeded();

    await expect(
      resetStagingAdminPasswords(
        {
          ...validInput,
          companyAdminPassword: "weak",
        },
        { prisma: database, now: fixedDate },
      ),
    ).rejects.toThrow("Password must be at least 12 characters.");
  });

  it("revokes active sessions after reset", async () => {
    const database = MemoryPasswordResetDatabase.seeded();

    await resetStagingAdminPasswords(validInput, { prisma: database, now: fixedDate });

    expect(database.sessions.every((session) => session.status === "REVOKED")).toBe(true);
    expect(
      database.sessions.every(
        (session) => session.revokedAt?.toISOString() === fixedDate.toISOString(),
      ),
    ).toBe(true);
  });

  it("does not print passwords or hashes", async () => {
    const database = MemoryPasswordResetDatabase.seeded();

    const result = await resetStagingAdminPasswords(validInput, {
      prisma: database,
      now: fixedDate,
    });
    const output = renderPasswordResetResult(result);

    expect(output).not.toContain(validInput.platformAdminPassword);
    expect(output).not.toContain(validInput.companyAdminPassword);
    expect(output).not.toContain(database.platformCredential.passwordHash);
    expect(output).not.toContain(database.companyCredential.passwordHash);
  });

  it("enforces staging-only execution", () => {
    expect(() => {
      assertStagingOnly("staging");
    }).not.toThrow();
    expect(() => {
      assertStagingOnly("production");
    }).toThrow("APP_ENV=staging");
    expect(() => {
      assertStagingOnly(undefined);
    }).toThrow("APP_ENV=staging");
  });
});

interface PlatformUserRecord {
  readonly id: string;
  readonly email: string;
  readonly status: "ACTIVE" | "DISABLED";
}

interface CompanyRecord {
  readonly id: string;
  readonly status: "ACTIVE" | "SUSPENDED" | "TRIALING" | "ARCHIVED";
  readonly deletedAt: Date | null;
}

interface CompanyUserRecord {
  readonly id: string;
  readonly companyId: string;
  readonly email: string;
  readonly status: "INVITED" | "ACTIVE" | "DISABLED";
  readonly deletedAt: Date | null;
}

interface CredentialRecord {
  readonly subjectType: "PLATFORM_USER" | "USER";
  readonly platformUserId?: string;
  readonly companyId?: string;
  readonly userId?: string;
  passwordHash: string;
  readonly emailVerifiedAt: Date | null;
  passwordUpdatedAt: Date;
}

interface SessionRecord {
  readonly subjectType: "PLATFORM_USER" | "USER";
  readonly platformUserId?: string;
  readonly companyId?: string;
  readonly userId?: string;
  status: "ACTIVE" | "REVOKED";
  revokedAt: Date | null;
}

class MemoryPasswordResetDatabase implements StagingPasswordResetDatabase {
  public readonly platformUsers: PlatformUserRecord[] = [];
  public readonly companies: CompanyRecord[] = [];
  public readonly users: CompanyUserRecord[] = [];
  public readonly credentials: CredentialRecord[] = [];
  public readonly sessions: SessionRecord[] = [];

  public static seeded(): MemoryPasswordResetDatabase {
    const database = new MemoryPasswordResetDatabase();
    database.platformUsers.push({
      id: "platform_1",
      email: "platform.admin@example.com",
      status: "ACTIVE",
    });
    database.companies.push({
      id: "company_1",
      status: "ACTIVE",
      deletedAt: null,
    });
    database.users.push({
      id: "user_1",
      companyId: "company_1",
      email: "company.admin@example.com",
      status: "ACTIVE",
      deletedAt: null,
    });
    database.credentials.push(
      {
        subjectType: "PLATFORM_USER",
        platformUserId: "platform_1",
        passwordHash: "$existing-platform-hash",
        emailVerifiedAt: fixedDate,
        passwordUpdatedAt: fixedDate,
      },
      {
        subjectType: "USER",
        companyId: "company_1",
        userId: "user_1",
        passwordHash: "$existing-company-hash",
        emailVerifiedAt: fixedDate,
        passwordUpdatedAt: fixedDate,
      },
    );
    database.sessions.push(
      {
        subjectType: "PLATFORM_USER",
        platformUserId: "platform_1",
        status: "ACTIVE",
        revokedAt: null,
      },
      {
        subjectType: "USER",
        companyId: "company_1",
        userId: "user_1",
        status: "ACTIVE",
        revokedAt: null,
      },
    );
    return database;
  }

  public get platformCredential(): CredentialRecord {
    const credential = this.credentials.find(
      (candidate) => candidate.subjectType === "PLATFORM_USER",
    );
    if (credential === undefined) {
      throw new Error("Missing platform credential.");
    }
    return credential;
  }

  public get companyCredential(): CredentialRecord {
    const credential = this.credentials.find((candidate) => candidate.subjectType === "USER");
    if (credential === undefined) {
      throw new Error("Missing company credential.");
    }
    return credential;
  }

  public $transaction<T>(
    operation: (tx: StagingPasswordResetTransaction) => Promise<T>,
  ): Promise<T> {
    return operation(this.createTransaction());
  }

  private createTransaction(): StagingPasswordResetTransaction {
    return {
      platformUser: {
        findUnique: ({ where }) =>
          Promise.resolve(this.platformUsers.find((user) => user.email === where.email) ?? null),
      },
      company: {
        findUnique: ({ where }) =>
          Promise.resolve(this.companies.find((company) => company.id === where.id) ?? null),
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
        findFirst: ({ where }) =>
          Promise.resolve(this.users.find((user) => user.email === where.email) ?? null),
      },
      authCredential: {
        findUnique: ({ where }) => {
          if ("platformUserId" in where) {
            return Promise.resolve(
              this.credentials.find(
                (credential) => credential.platformUserId === where.platformUserId,
              ) ?? null,
            );
          }
          return Promise.resolve(
            this.credentials.find(
              (credential) =>
                credential.companyId === where.companyId_userId.companyId &&
                credential.userId === where.companyId_userId.userId,
            ) ?? null,
          );
        },
        create: ({ data }) => {
          this.credentials.push({ ...data });
          return Promise.resolve();
        },
        update: ({ where, data }) => {
          const credential =
            "platformUserId" in where
              ? this.credentials.find(
                  (candidate) => candidate.platformUserId === where.platformUserId,
                )
              : this.credentials.find(
                  (candidate) =>
                    candidate.companyId === where.companyId_userId.companyId &&
                    candidate.userId === where.companyId_userId.userId,
                );
          if (credential === undefined) {
            throw new Error("Credential not found.");
          }
          credential.passwordHash = data.passwordHash;
          credential.passwordUpdatedAt = data.passwordUpdatedAt;
          return Promise.resolve();
        },
      },
      authSession: {
        updateMany: ({ where, data }) => {
          let count = 0;
          for (const session of this.sessions) {
            const matches =
              "platformUserId" in where
                ? session.platformUserId === where.platformUserId && session.status === where.status
                : session.companyId === where.companyId &&
                  session.userId === where.userId &&
                  session.status === where.status;
            if (matches) {
              session.status = data.status;
              session.revokedAt = data.revokedAt;
              count += 1;
            }
          }
          return Promise.resolve({ count });
        },
      },
    };
  }
}
