import { describe, expect, it } from "vitest";

import {
  assertStagingOnly,
  renderCompanyUserPasswordResetResult,
  resetStagingCompanyUserPassword,
  type StagingCompanyUserPasswordResetDatabase,
  type StagingCompanyUserPasswordResetInput,
  type StagingCompanyUserPasswordResetTransaction,
} from "../../scripts/staging-reset-company-user-password";
import { verifyPassword } from "../../src/modules/auth/password";

const originalDate = new Date("2026-07-01T00:00:00.000Z");
const resetDate = new Date("2026-07-02T00:00:00.000Z");
const validInput: StagingCompanyUserPasswordResetInput = {
  workspaceId: "company_1",
  email: "Hr.User@Example.com",
  password: "NewHrPassword123",
};

describe("staging reset company-user password", () => {
  it("resets an existing HR password", async () => {
    const database = MemoryCompanyUserPasswordResetDatabase.seeded();

    const result = await resetStagingCompanyUserPassword(validInput, {
      prisma: database,
      now: resetDate,
    });

    const credential = database.credentialFor("company_1", "user_hr");
    expect(result.success).toBe(true);
    expect(result.normalizedEmail).toBe("hr.user@example.com");
    expect(verifyPassword("NewHrPassword123", credential.passwordHash)).toBe(true);
    expect(credential.passwordUpdatedAt).toEqual(resetDate);
    expect(credential.emailVerifiedAt).toEqual(originalDate);
  });

  it("scopes user lookup to the provided workspace", async () => {
    const database = MemoryCompanyUserPasswordResetDatabase.seeded();

    await resetStagingCompanyUserPassword(
      {
        workspaceId: "company_2",
        email: "hr.user@example.com",
        password: "CompanyTwoPassword123",
      },
      { prisma: database, now: resetDate },
    );

    expect(
      verifyPassword(
        "CompanyTwoPassword123",
        database.credentialFor("company_2", "user_hr_2").passwordHash,
      ),
    ).toBe(true);
    expect(
      verifyPassword(
        "CompanyTwoPassword123",
        database.credentialFor("company_1", "user_hr").passwordHash,
      ),
    ).toBe(false);
  });

  it("rejects an unknown workspace", async () => {
    const database = MemoryCompanyUserPasswordResetDatabase.seeded();

    await expect(
      resetStagingCompanyUserPassword(
        { ...validInput, workspaceId: "missing_company" },
        { prisma: database, now: resetDate },
      ),
    ).rejects.toThrow("Company workspace was not found.");
  });

  it("rejects an unknown user", async () => {
    const database = MemoryCompanyUserPasswordResetDatabase.seeded();

    await expect(
      resetStagingCompanyUserPassword(
        { ...validInput, email: "missing@example.com" },
        { prisma: database, now: resetDate },
      ),
    ).rejects.toThrow("Company user was not found in the provided workspace.");
  });

  it("requires an existing password credential", async () => {
    const database = MemoryCompanyUserPasswordResetDatabase.seeded();
    database.credentials = database.credentials.filter(
      (credential) => credential.userId !== "user_hr",
    );

    await expect(
      resetStagingCompanyUserPassword(validInput, { prisma: database, now: resetDate }),
    ).rejects.toThrow("Company user password credential was not found.");
  });

  it("revokes active sessions without changing roles", async () => {
    const database = MemoryCompanyUserPasswordResetDatabase.seeded();
    const rolesBefore = JSON.stringify(database.userRoles);

    const result = await resetStagingCompanyUserPassword(validInput, {
      prisma: database,
      now: resetDate,
    });

    expect(result.revokedSessions).toBe(1);
    expect(database.sessions.find((session) => session.userId === "user_hr")?.status).toBe(
      "REVOKED",
    );
    expect(
      database.sessions.find((session) => session.userId === "user_company_admin")?.status,
    ).toBe("ACTIVE");
    expect(JSON.stringify(database.userRoles)).toBe(rolesBefore);
  });

  it("redacts passwords and hashes from output and audit metadata", async () => {
    const database = MemoryCompanyUserPasswordResetDatabase.seeded();

    const result = await resetStagingCompanyUserPassword(validInput, {
      prisma: database,
      now: resetDate,
    });
    const output = renderCompanyUserPasswordResetResult(result);
    const auditText = JSON.stringify(database.auditEvents);
    const credentialHash = database.credentialFor("company_1", "user_hr").passwordHash;

    expect(output).not.toContain(validInput.password);
    expect(output).not.toContain(credentialHash);
    expect(auditText).not.toContain(validInput.password);
    expect(auditText).not.toContain(credentialHash);
    expect(database.auditEvents).toHaveLength(1);
  });

  it("rejects weak passwords through the existing password policy", async () => {
    const database = MemoryCompanyUserPasswordResetDatabase.seeded();

    await expect(
      resetStagingCompanyUserPassword(
        { ...validInput, password: "weak" },
        { prisma: database, now: resetDate },
      ),
    ).rejects.toThrow("Password must be at least 12 characters.");
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

interface CompanyRecord {
  readonly id: string;
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
  readonly companyId: string;
  readonly userId: string;
  passwordHash: string;
  readonly emailVerifiedAt: Date | null;
  passwordUpdatedAt: Date;
}

interface SessionRecord {
  readonly subjectType: "USER";
  readonly companyId: string;
  readonly userId: string;
  status: "ACTIVE" | "REVOKED";
  revokedAt: Date | null;
}

interface UserRoleRecord {
  readonly companyId: string;
  readonly userId: string;
  readonly roleId: string;
}

interface AuditEventRecord {
  readonly companyId: string;
  readonly actorType: "SYSTEM";
  readonly actorId: string;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly riskLevel: "HIGH";
  readonly afterJson: {
    readonly workspaceId: string;
    readonly normalizedEmail: string;
    readonly revokedSessions: number;
  };
  readonly metadataJson: {
    readonly source: "staging_cli";
  };
}

class MemoryCompanyUserPasswordResetDatabase implements StagingCompanyUserPasswordResetDatabase {
  public readonly companies: CompanyRecord[] = [];
  public readonly users: CompanyUserRecord[] = [];
  public credentials: CredentialRecord[] = [];
  public readonly sessions: SessionRecord[] = [];
  public readonly userRoles: UserRoleRecord[] = [];
  public readonly auditEvents: AuditEventRecord[] = [];

  public static seeded(): MemoryCompanyUserPasswordResetDatabase {
    const database = new MemoryCompanyUserPasswordResetDatabase();
    database.companies.push(
      { id: "company_1", deletedAt: null },
      { id: "company_2", deletedAt: null },
    );
    database.users.push(
      {
        id: "user_hr",
        companyId: "company_1",
        email: "hr.user@example.com",
        status: "ACTIVE",
        deletedAt: null,
      },
      {
        id: "user_company_admin",
        companyId: "company_1",
        email: "admin@example.com",
        status: "ACTIVE",
        deletedAt: null,
      },
      {
        id: "user_hr_2",
        companyId: "company_2",
        email: "hr.user@example.com",
        status: "ACTIVE",
        deletedAt: null,
      },
    );
    database.credentials.push(
      {
        companyId: "company_1",
        userId: "user_hr",
        passwordHash: "$existing-hr-hash",
        emailVerifiedAt: originalDate,
        passwordUpdatedAt: originalDate,
      },
      {
        companyId: "company_1",
        userId: "user_company_admin",
        passwordHash: "$existing-admin-hash",
        emailVerifiedAt: originalDate,
        passwordUpdatedAt: originalDate,
      },
      {
        companyId: "company_2",
        userId: "user_hr_2",
        passwordHash: "$existing-hr-2-hash",
        emailVerifiedAt: originalDate,
        passwordUpdatedAt: originalDate,
      },
    );
    database.sessions.push(
      {
        subjectType: "USER",
        companyId: "company_1",
        userId: "user_hr",
        status: "ACTIVE",
        revokedAt: null,
      },
      {
        subjectType: "USER",
        companyId: "company_1",
        userId: "user_company_admin",
        status: "ACTIVE",
        revokedAt: null,
      },
      {
        subjectType: "USER",
        companyId: "company_2",
        userId: "user_hr_2",
        status: "ACTIVE",
        revokedAt: null,
      },
    );
    database.userRoles.push(
      { companyId: "company_1", userId: "user_hr", roleId: "role_hr" },
      { companyId: "company_1", userId: "user_company_admin", roleId: "role_admin" },
      { companyId: "company_2", userId: "user_hr_2", roleId: "role_hr" },
    );
    return database;
  }

  public credentialFor(companyId: string, userId: string): CredentialRecord {
    const credential = this.credentials.find(
      (candidate) => candidate.companyId === companyId && candidate.userId === userId,
    );
    if (credential === undefined) {
      throw new Error("Missing credential.");
    }
    return credential;
  }

  public $transaction<T>(
    operation: (tx: StagingCompanyUserPasswordResetTransaction) => Promise<T>,
  ): Promise<T> {
    return operation(this.createTransaction());
  }

  private createTransaction(): StagingCompanyUserPasswordResetTransaction {
    return {
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
      },
      authCredential: {
        findUnique: ({ where }) =>
          Promise.resolve(
            this.credentials.find(
              (credential) =>
                credential.companyId === where.companyId_userId.companyId &&
                credential.userId === where.companyId_userId.userId,
            ) ?? null,
          ),
        update: ({ where, data }) => {
          const credential = this.credentialFor(
            where.companyId_userId.companyId,
            where.companyId_userId.userId,
          );
          credential.passwordHash = data.passwordHash;
          credential.passwordUpdatedAt = data.passwordUpdatedAt;
          return Promise.resolve();
        },
      },
      authSession: {
        updateMany: ({ where, data }) => {
          let count = 0;
          for (const session of this.sessions) {
            if (
              session.companyId === where.companyId &&
              session.userId === where.userId &&
              session.status === where.status
            ) {
              session.status = data.status;
              session.revokedAt = data.revokedAt;
              count += 1;
            }
          }
          return Promise.resolve({ count });
        },
      },
      auditEvent: {
        create: ({ data }) => {
          this.auditEvents.push(data);
          return Promise.resolve();
        },
      },
    };
  }
}
