import { PrismaClient } from "@prisma/client";
import { resolve } from "node:path";
import { stdout as output } from "node:process";
import { fileURLToPath } from "node:url";

import { hashPassword } from "../src/modules/auth/password";
import { normalizeEmail } from "../src/modules/identity";

type AccountType = "Platform Admin" | "Company Admin";
type AccountState = "active" | "deactivated" | "invited" | "deleted" | "missing";
type CredentialAction = "updated" | "created" | "skipped";

export interface StagingAdminPasswordResetInput {
  readonly platformAdminEmail: string;
  readonly platformAdminPassword: string;
  readonly companyAdminEmail: string;
  readonly companyAdminPassword: string;
  readonly companyWorkspaceId: string;
}

export interface StagingAdminPasswordResetAccountResult {
  readonly type: AccountType;
  readonly email: string;
  readonly exists: boolean;
  readonly workspaceMatch: boolean | "not applicable";
  readonly state: AccountState;
  readonly emailVerified: boolean;
  readonly passwordCredentialExists: boolean;
  readonly credentialAction: CredentialAction;
  readonly revokedSessions: number;
}

export interface StagingAdminPasswordResetResult {
  readonly workspaceId: string;
  readonly platformAdmin: StagingAdminPasswordResetAccountResult;
  readonly companyAdmin: StagingAdminPasswordResetAccountResult;
}

interface CredentialRecord {
  readonly emailVerifiedAt: Date | null;
}

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

export interface StagingPasswordResetTransaction {
  readonly platformUser: {
    findUnique(input: {
      readonly where: { readonly email: string };
    }): Promise<PlatformUserRecord | null>;
  };
  readonly company: {
    findUnique(input: { readonly where: { readonly id: string } }): Promise<CompanyRecord | null>;
  };
  readonly user: {
    findUnique(input: {
      readonly where: {
        readonly companyId_email: {
          readonly companyId: string;
          readonly email: string;
        };
      };
    }): Promise<CompanyUserRecord | null>;
    findFirst(input: {
      readonly where: {
        readonly email: string;
      };
    }): Promise<CompanyUserRecord | null>;
  };
  readonly authCredential: {
    findUnique(
      input:
        | { readonly where: { readonly platformUserId: string } }
        | {
            readonly where: {
              readonly companyId_userId: {
                readonly companyId: string;
                readonly userId: string;
              };
            };
          },
    ): Promise<CredentialRecord | null>;
    create(input: {
      readonly data:
        | {
            readonly subjectType: "PLATFORM_USER";
            readonly platformUserId: string;
            readonly passwordHash: string;
            readonly emailVerifiedAt: Date;
            readonly passwordUpdatedAt: Date;
          }
        | {
            readonly subjectType: "USER";
            readonly companyId: string;
            readonly userId: string;
            readonly passwordHash: string;
            readonly emailVerifiedAt: Date;
            readonly passwordUpdatedAt: Date;
          };
    }): Promise<unknown>;
    update(
      input:
        | {
            readonly where: { readonly platformUserId: string };
            readonly data: {
              readonly passwordHash: string;
              readonly passwordUpdatedAt: Date;
            };
          }
        | {
            readonly where: {
              readonly companyId_userId: {
                readonly companyId: string;
                readonly userId: string;
              };
            };
            readonly data: {
              readonly passwordHash: string;
              readonly passwordUpdatedAt: Date;
            };
          },
    ): Promise<unknown>;
  };
  readonly authSession: {
    updateMany(input: {
      readonly where:
        | {
            readonly subjectType: "PLATFORM_USER";
            readonly platformUserId: string;
            readonly status: "ACTIVE";
          }
        | {
            readonly subjectType: "USER";
            readonly companyId: string;
            readonly userId: string;
            readonly status: "ACTIVE";
          };
      readonly data: { readonly status: "REVOKED"; readonly revokedAt: Date };
    }): Promise<{ readonly count: number }>;
  };
}

export interface StagingPasswordResetDatabase {
  $transaction<T>(operation: (tx: StagingPasswordResetTransaction) => Promise<T>): Promise<T>;
}

interface ResetDependencies {
  readonly prisma: StagingPasswordResetDatabase;
  readonly now?: Date;
}

export function assertStagingOnly(appEnv: string | undefined): void {
  if (appEnv !== "staging") {
    throw new Error("Staging admin password reset requires APP_ENV=staging.");
  }
}

export function loadPasswordResetInputFromEnv(
  source: NodeJS.ProcessEnv,
): StagingAdminPasswordResetInput {
  return {
    platformAdminEmail: normalizeEmail(requiredText(source, "STAGING_PLATFORM_ADMIN_EMAIL")),
    platformAdminPassword: requiredText(source, "STAGING_PLATFORM_ADMIN_PASSWORD"),
    companyAdminEmail: normalizeEmail(requiredText(source, "STAGING_COMPANY_ADMIN_EMAIL")),
    companyAdminPassword: requiredText(source, "STAGING_COMPANY_ADMIN_PASSWORD"),
    companyWorkspaceId: requiredText(source, "STAGING_COMPANY_WORKSPACE_ID"),
  };
}

export async function resetStagingAdminPasswords(
  input: StagingAdminPasswordResetInput,
  dependencies: ResetDependencies,
): Promise<StagingAdminPasswordResetResult> {
  const normalizedInput = normalizeResetInput(input);
  const now = dependencies.now ?? new Date();
  const platformPasswordHash = hashPassword(normalizedInput.platformAdminPassword);
  const companyPasswordHash = hashPassword(normalizedInput.companyAdminPassword);

  return dependencies.prisma.$transaction(async (tx) => {
    const workspace = await tx.company.findUnique({
      where: { id: normalizedInput.companyWorkspaceId },
    });
    if (workspace?.deletedAt !== null) {
      throw new Error("Company workspace is missing or deleted.");
    }

    const platformUser = await tx.platformUser.findUnique({
      where: { email: normalizedInput.platformAdminEmail },
    });
    const platformAdmin = await resetPlatformAdmin({
      tx,
      platformUser,
      passwordHash: platformPasswordHash,
      passwordUpdatedAt: now,
      email: normalizedInput.platformAdminEmail,
    });

    const companyUser = await tx.user.findUnique({
      where: {
        companyId_email: {
          companyId: normalizedInput.companyWorkspaceId,
          email: normalizedInput.companyAdminEmail,
        },
      },
    });
    if (companyUser === null) {
      const userInAnotherWorkspace = await tx.user.findFirst({
        where: { email: normalizedInput.companyAdminEmail },
      });
      if (
        userInAnotherWorkspace !== null &&
        userInAnotherWorkspace.companyId !== normalizedInput.companyWorkspaceId
      ) {
        throw new Error("Company Admin does not belong to the provided workspace.");
      }
    }
    const companyAdmin = await resetCompanyAdmin({
      tx,
      companyUser,
      passwordHash: companyPasswordHash,
      passwordUpdatedAt: now,
      email: normalizedInput.companyAdminEmail,
      workspaceId: normalizedInput.companyWorkspaceId,
    });

    return {
      workspaceId: workspace.id,
      platformAdmin,
      companyAdmin,
    };
  });
}

export function renderPasswordResetResult(result: StagingAdminPasswordResetResult): string {
  return [
    "Staging admin password reset complete.",
    `Company Workspace ID: ${result.workspaceId}`,
    "",
    renderAccount(result.platformAdmin),
    "",
    renderAccount(result.companyAdmin),
    "",
    "Platform login: choose Platform; Workspace ID is not required.",
    "Company login: choose Company; enter the printed Company Workspace ID.",
    "",
  ].join("\n");
}

async function resetPlatformAdmin(input: {
  readonly tx: StagingPasswordResetTransaction;
  readonly platformUser: PlatformUserRecord | null;
  readonly passwordHash: string;
  readonly passwordUpdatedAt: Date;
  readonly email: string;
}): Promise<StagingAdminPasswordResetAccountResult> {
  if (input.platformUser === null) {
    return missingAccount("Platform Admin", input.email, "not applicable");
  }

  const credential = await input.tx.authCredential.findUnique({
    where: { platformUserId: input.platformUser.id },
  });
  const credentialAction = await upsertPlatformCredential({
    tx: input.tx,
    platformUserId: input.platformUser.id,
    credential,
    passwordHash: input.passwordHash,
    passwordUpdatedAt: input.passwordUpdatedAt,
  });
  const revokedSessions = await input.tx.authSession.updateMany({
    where: {
      subjectType: "PLATFORM_USER",
      platformUserId: input.platformUser.id,
      status: "ACTIVE",
    },
    data: { status: "REVOKED", revokedAt: input.passwordUpdatedAt },
  });

  return {
    type: "Platform Admin",
    email: input.platformUser.email,
    exists: true,
    workspaceMatch: "not applicable",
    state: input.platformUser.status === "ACTIVE" ? "active" : "deactivated",
    emailVerified: credential?.emailVerifiedAt != null,
    passwordCredentialExists: credential !== null,
    credentialAction,
    revokedSessions: revokedSessions.count,
  };
}

async function resetCompanyAdmin(input: {
  readonly tx: StagingPasswordResetTransaction;
  readonly companyUser: CompanyUserRecord | null;
  readonly passwordHash: string;
  readonly passwordUpdatedAt: Date;
  readonly email: string;
  readonly workspaceId: string;
}): Promise<StagingAdminPasswordResetAccountResult> {
  if (input.companyUser === null) {
    return missingAccount("Company Admin", input.email, false);
  }
  if (input.companyUser.companyId !== input.workspaceId) {
    throw new Error("Company Admin does not belong to the provided workspace.");
  }

  const credential = await input.tx.authCredential.findUnique({
    where: {
      companyId_userId: {
        companyId: input.workspaceId,
        userId: input.companyUser.id,
      },
    },
  });
  const credentialAction = await upsertCompanyCredential({
    tx: input.tx,
    companyId: input.workspaceId,
    userId: input.companyUser.id,
    credential,
    passwordHash: input.passwordHash,
    passwordUpdatedAt: input.passwordUpdatedAt,
  });
  const revokedSessions = await input.tx.authSession.updateMany({
    where: {
      subjectType: "USER",
      companyId: input.workspaceId,
      userId: input.companyUser.id,
      status: "ACTIVE",
    },
    data: { status: "REVOKED", revokedAt: input.passwordUpdatedAt },
  });

  return {
    type: "Company Admin",
    email: input.companyUser.email,
    exists: true,
    workspaceMatch: true,
    state: mapCompanyUserState(input.companyUser),
    emailVerified: credential?.emailVerifiedAt != null,
    passwordCredentialExists: credential !== null,
    credentialAction,
    revokedSessions: revokedSessions.count,
  };
}

async function upsertPlatformCredential(input: {
  readonly tx: StagingPasswordResetTransaction;
  readonly platformUserId: string;
  readonly credential: CredentialRecord | null;
  readonly passwordHash: string;
  readonly passwordUpdatedAt: Date;
}): Promise<CredentialAction> {
  if (input.credential === null) {
    await input.tx.authCredential.create({
      data: {
        subjectType: "PLATFORM_USER",
        platformUserId: input.platformUserId,
        passwordHash: input.passwordHash,
        emailVerifiedAt: input.passwordUpdatedAt,
        passwordUpdatedAt: input.passwordUpdatedAt,
      },
    });
    return "created";
  }

  await input.tx.authCredential.update({
    where: { platformUserId: input.platformUserId },
    data: {
      passwordHash: input.passwordHash,
      passwordUpdatedAt: input.passwordUpdatedAt,
    },
  });
  return "updated";
}

async function upsertCompanyCredential(input: {
  readonly tx: StagingPasswordResetTransaction;
  readonly companyId: string;
  readonly userId: string;
  readonly credential: CredentialRecord | null;
  readonly passwordHash: string;
  readonly passwordUpdatedAt: Date;
}): Promise<CredentialAction> {
  if (input.credential === null) {
    await input.tx.authCredential.create({
      data: {
        subjectType: "USER",
        companyId: input.companyId,
        userId: input.userId,
        passwordHash: input.passwordHash,
        emailVerifiedAt: input.passwordUpdatedAt,
        passwordUpdatedAt: input.passwordUpdatedAt,
      },
    });
    return "created";
  }

  await input.tx.authCredential.update({
    where: {
      companyId_userId: {
        companyId: input.companyId,
        userId: input.userId,
      },
    },
    data: {
      passwordHash: input.passwordHash,
      passwordUpdatedAt: input.passwordUpdatedAt,
    },
  });
  return "updated";
}

function mapCompanyUserState(user: CompanyUserRecord): AccountState {
  if (user.deletedAt !== null) {
    return "deleted";
  }
  if (user.status === "ACTIVE") {
    return "active";
  }
  if (user.status === "INVITED") {
    return "invited";
  }

  return "deactivated";
}

function missingAccount(
  type: AccountType,
  email: string,
  workspaceMatch: boolean | "not applicable",
): StagingAdminPasswordResetAccountResult {
  return {
    type,
    email,
    exists: false,
    workspaceMatch,
    state: "missing",
    emailVerified: false,
    passwordCredentialExists: false,
    credentialAction: "skipped",
    revokedSessions: 0,
  };
}

function renderAccount(account: StagingAdminPasswordResetAccountResult): string {
  return [
    `${account.type}: ${account.exists ? "exists" : "missing"}`,
    `Email: ${account.email}`,
    `Workspace match: ${String(account.workspaceMatch)}`,
    `State: ${account.state}`,
    `Email verified: ${String(account.emailVerified)}`,
    `Password credential exists: ${String(account.passwordCredentialExists)}`,
    `Credential action: ${account.credentialAction}`,
    `Revoked sessions: ${String(account.revokedSessions)}`,
  ].join("\n");
}

function normalizeResetInput(
  input: StagingAdminPasswordResetInput,
): StagingAdminPasswordResetInput {
  return {
    platformAdminEmail: normalizeEmail(input.platformAdminEmail),
    platformAdminPassword: requiredValue(
      input.platformAdminPassword,
      "STAGING_PLATFORM_ADMIN_PASSWORD",
    ),
    companyAdminEmail: normalizeEmail(input.companyAdminEmail),
    companyAdminPassword: requiredValue(
      input.companyAdminPassword,
      "STAGING_COMPANY_ADMIN_PASSWORD",
    ),
    companyWorkspaceId: requiredValue(input.companyWorkspaceId, "STAGING_COMPANY_WORKSPACE_ID"),
  };
}

function requiredText(source: NodeJS.ProcessEnv, name: string): string {
  return requiredValue(source[name], name);
}

function requiredValue(value: string | undefined, name: string): string {
  const trimmed = value?.trim();
  if (trimmed === undefined || trimmed.length === 0) {
    throw new Error(`${name} is required.`);
  }

  return trimmed;
}

async function runCli(): Promise<void> {
  assertStagingOnly(process.env.APP_ENV);

  const prisma = new PrismaClient();
  try {
    const result = await resetStagingAdminPasswords(loadPasswordResetInputFromEnv(process.env), {
      prisma: createPrismaPasswordResetDatabase(prisma),
    });
    output.write(renderPasswordResetResult(result));
  } finally {
    await prisma.$disconnect();
  }
}

function createPrismaPasswordResetDatabase(prisma: PrismaClient): StagingPasswordResetDatabase {
  return {
    $transaction: async (operation) =>
      prisma.$transaction((tx) => operation(tx as unknown as StagingPasswordResetTransaction)),
  };
}

const executedPath = resolve(process.argv[1]);
if (fileURLToPath(import.meta.url) === executedPath) {
  runCli().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown password reset failure.";
    console.error(`Staging admin password reset failed: ${message}`);
    process.exitCode = 1;
  });
}
