import { PrismaClient } from "@prisma/client";
import { resolve } from "node:path";
import { stdout as output } from "node:process";
import { fileURLToPath } from "node:url";

import { hashPassword } from "../src/modules/auth/password";
import { normalizeEmail } from "../src/modules/identity";

export interface StagingCompanyUserPasswordResetInput {
  readonly workspaceId: string;
  readonly email: string;
  readonly password: string;
}

export interface StagingCompanyUserPasswordResetResult {
  readonly workspaceId: string;
  readonly normalizedEmail: string;
  readonly success: true;
  readonly revokedSessions: number;
}

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
  readonly emailVerifiedAt: Date | null;
  readonly passwordHash: string;
  readonly passwordUpdatedAt: Date;
}

export interface StagingCompanyUserPasswordResetTransaction {
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
  };
  readonly authCredential: {
    findUnique(input: {
      readonly where: {
        readonly companyId_userId: {
          readonly companyId: string;
          readonly userId: string;
        };
      };
    }): Promise<CredentialRecord | null>;
    update(input: {
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
    }): Promise<unknown>;
  };
  readonly authSession: {
    updateMany(input: {
      readonly where: {
        readonly subjectType: "USER";
        readonly companyId: string;
        readonly userId: string;
        readonly status: "ACTIVE";
      };
      readonly data: { readonly status: "REVOKED"; readonly revokedAt: Date };
    }): Promise<{ readonly count: number }>;
  };
  readonly auditEvent: {
    create(input: {
      readonly data: {
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
      };
    }): Promise<unknown>;
  };
}

export interface StagingCompanyUserPasswordResetDatabase {
  $transaction<T>(
    operation: (tx: StagingCompanyUserPasswordResetTransaction) => Promise<T>,
  ): Promise<T>;
}

export function assertStagingOnly(appEnv: string | undefined): void {
  if (appEnv !== "staging") {
    throw new Error("Staging company-user password reset requires APP_ENV=staging.");
  }
}

export function loadCompanyUserPasswordResetInputFromEnv(
  source: NodeJS.ProcessEnv,
): StagingCompanyUserPasswordResetInput {
  return {
    workspaceId: requiredText(source, "STAGING_COMPANY_WORKSPACE_ID"),
    email: normalizeEmail(requiredText(source, "STAGING_COMPANY_USER_EMAIL")),
    password: requiredText(source, "STAGING_COMPANY_USER_PASSWORD"),
  };
}

export async function resetStagingCompanyUserPassword(
  input: StagingCompanyUserPasswordResetInput,
  dependencies: {
    readonly prisma: StagingCompanyUserPasswordResetDatabase;
    readonly now?: Date;
  },
): Promise<StagingCompanyUserPasswordResetResult> {
  const workspaceId = requiredValue(input.workspaceId, "STAGING_COMPANY_WORKSPACE_ID");
  const normalizedEmail = normalizeEmail(input.email);
  const passwordHash = hashPassword(input.password);
  const now = dependencies.now ?? new Date();

  return dependencies.prisma.$transaction(async (tx) => {
    const company = await tx.company.findUnique({ where: { id: workspaceId } });
    if (company?.deletedAt !== null) {
      throw new Error("Company workspace was not found.");
    }

    const user = await tx.user.findUnique({
      where: {
        companyId_email: {
          companyId: workspaceId,
          email: normalizedEmail,
        },
      },
    });
    if (user?.deletedAt !== null) {
      throw new Error("Company user was not found in the provided workspace.");
    }

    const credential = await tx.authCredential.findUnique({
      where: {
        companyId_userId: {
          companyId: workspaceId,
          userId: user.id,
        },
      },
    });
    if (credential === null) {
      throw new Error("Company user password credential was not found.");
    }

    await tx.authCredential.update({
      where: {
        companyId_userId: {
          companyId: workspaceId,
          userId: user.id,
        },
      },
      data: {
        passwordHash,
        passwordUpdatedAt: now,
      },
    });

    const revoked = await tx.authSession.updateMany({
      where: {
        subjectType: "USER",
        companyId: workspaceId,
        userId: user.id,
        status: "ACTIVE",
      },
      data: { status: "REVOKED", revokedAt: now },
    });

    await tx.auditEvent.create({
      data: {
        companyId: workspaceId,
        actorType: "SYSTEM",
        actorId: "staging-reset-company-user-password",
        action: "staging.company_user_password_reset",
        resourceType: "user",
        resourceId: user.id,
        riskLevel: "HIGH",
        afterJson: {
          workspaceId,
          normalizedEmail,
          revokedSessions: revoked.count,
        },
        metadataJson: { source: "staging_cli" },
      },
    });

    return {
      workspaceId,
      normalizedEmail,
      success: true,
      revokedSessions: revoked.count,
    };
  });
}

export function renderCompanyUserPasswordResetResult(
  result: StagingCompanyUserPasswordResetResult,
): string {
  return [
    "Staging company-user password reset complete.",
    `Company Workspace ID: ${result.workspaceId}`,
    `Normalized email: ${result.normalizedEmail}`,
    "Success: true",
    `Revoked sessions: ${String(result.revokedSessions)}`,
    "Password was read from environment variables and was not printed.",
    "",
  ].join("\n");
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
    const result = await resetStagingCompanyUserPassword(
      loadCompanyUserPasswordResetInputFromEnv(process.env),
      { prisma: createPrismaPasswordResetDatabase(prisma) },
    );
    output.write(renderCompanyUserPasswordResetResult(result));
  } finally {
    await prisma.$disconnect();
  }
}

function createPrismaPasswordResetDatabase(
  prisma: PrismaClient,
): StagingCompanyUserPasswordResetDatabase {
  return {
    $transaction: async (operation) =>
      prisma.$transaction((tx) =>
        operation(tx as unknown as StagingCompanyUserPasswordResetTransaction),
      ),
  };
}

const executedPath = resolve(process.argv[1] ?? "");
if (fileURLToPath(import.meta.url) === executedPath) {
  runCli().catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : "Unknown company-user password reset failure.";
    console.error(`Staging company-user password reset failed: ${message}`);
    process.exitCode = 1;
  });
}
