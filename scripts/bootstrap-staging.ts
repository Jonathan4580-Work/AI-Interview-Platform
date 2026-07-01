import { PrismaClient } from "@prisma/client";
import { resolve } from "node:path";
import { stdout as output } from "node:process";
import { fileURLToPath } from "node:url";

import { hashPassword } from "../src/modules/auth/password";
import { permissionKeys } from "../src/modules/access-control/types";

const companyAdminRoleKey = "company_admin";

type EntityBootstrapStatus = "created" | "already existed";

export interface StagingBootstrapInput {
  readonly platformAdminEmail: string;
  readonly platformAdminName: string;
  readonly platformAdminPassword: string;
  readonly companyName: string;
  readonly companySlug: string;
  readonly companyAdminEmail: string;
  readonly companyAdminName: string;
  readonly companyAdminPassword: string;
}

export interface StagingBootstrapResult {
  readonly platformAdminStatus: EntityBootstrapStatus;
  readonly companyStatus: EntityBootstrapStatus;
  readonly companyAdminStatus: EntityBootstrapStatus;
  readonly platformAdminEmail: string;
  readonly companyAdminEmail: string;
  readonly companyId: string;
  readonly companySlug: string;
}

interface PlatformUserRecord {
  readonly id: string;
  readonly email: string;
  readonly status: "ACTIVE" | "DISABLED";
}

interface CompanyRecord {
  readonly id: string;
  readonly slug: string;
  readonly status: "ACTIVE" | "SUSPENDED" | "TRIALING" | "ARCHIVED";
  readonly deletedAt: Date | null;
}

interface UserRecord {
  readonly id: string;
  readonly email: string;
  readonly status: "INVITED" | "ACTIVE" | "DISABLED";
  readonly deletedAt: Date | null;
}

interface RoleRecord {
  readonly id: string;
}

interface PermissionRecord {
  readonly id: string;
}

export interface StagingBootstrapTransaction {
  readonly platformUser: {
    findUnique(input: {
      readonly where: { readonly email: string };
    }): Promise<PlatformUserRecord | null>;
    create(input: {
      readonly data: {
        readonly email: string;
        readonly name: string;
        readonly status: "ACTIVE";
      };
    }): Promise<PlatformUserRecord>;
  };
  readonly company: {
    findUnique(input: { readonly where: { readonly slug: string } }): Promise<CompanyRecord | null>;
    create(input: {
      readonly data: {
        readonly name: string;
        readonly slug: string;
        readonly status: "ACTIVE";
      };
    }): Promise<CompanyRecord>;
  };
  readonly permission: {
    createMany(input: {
      readonly data: readonly { readonly key: string; readonly description: string }[];
      readonly skipDuplicates: true;
    }): Promise<unknown>;
    findMany(input: {
      readonly where: { readonly key: { readonly in: readonly string[] } };
      readonly select: { readonly id: true };
    }): Promise<PermissionRecord[]>;
  };
  readonly role: {
    upsert(input: {
      readonly where: {
        readonly companyId_key: {
          readonly companyId: string;
          readonly key: string;
        };
      };
      readonly update: {
        readonly name: string;
        readonly description: string;
        readonly isSystem: true;
      };
      readonly create: {
        readonly companyId: string;
        readonly name: string;
        readonly key: string;
        readonly description: string;
        readonly isSystem: true;
      };
    }): Promise<RoleRecord>;
  };
  readonly rolePermission: {
    createMany(input: {
      readonly data: readonly { readonly roleId: string; readonly permissionId: string }[];
      readonly skipDuplicates: true;
    }): Promise<unknown>;
  };
  readonly user: {
    findUnique(input: {
      readonly where: {
        readonly companyId_email: {
          readonly companyId: string;
          readonly email: string;
        };
      };
    }): Promise<UserRecord | null>;
    create(input: {
      readonly data: {
        readonly companyId: string;
        readonly email: string;
        readonly name: string;
        readonly status: "ACTIVE";
      };
    }): Promise<UserRecord>;
    update(input: {
      readonly where: {
        readonly companyId_email: {
          readonly companyId: string;
          readonly email: string;
        };
      };
      readonly data: {
        readonly status: "ACTIVE";
      };
    }): Promise<UserRecord>;
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
    ): Promise<object | null>;
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
  };
  readonly userRole: {
    upsert(input: {
      readonly where: {
        readonly userId_roleId: {
          readonly userId: string;
          readonly roleId: string;
        };
      };
      readonly update: { readonly companyId: string };
      readonly create: {
        readonly companyId: string;
        readonly userId: string;
        readonly roleId: string;
      };
    }): Promise<unknown>;
  };
}

export interface StagingBootstrapDatabase {
  $transaction<T>(operation: (tx: StagingBootstrapTransaction) => Promise<T>): Promise<T>;
}

interface BootstrapDependencies {
  readonly prisma: StagingBootstrapDatabase;
  readonly now?: Date;
}

export async function bootstrapStaging(
  input: StagingBootstrapInput,
  dependencies: BootstrapDependencies,
): Promise<StagingBootstrapResult> {
  const normalized = normalizeInput(input);
  const now = dependencies.now ?? new Date();
  const platformPasswordHash = hashPassword(normalized.platformAdminPassword);
  const companyPasswordHash = hashPassword(normalized.companyAdminPassword);

  return dependencies.prisma.$transaction(async (tx) => {
    const existingPlatformAdmin = await tx.platformUser.findUnique({
      where: { email: normalized.platformAdminEmail },
    });
    const platformAdminWasCreated = existingPlatformAdmin === null;
    if (existingPlatformAdmin !== null && existingPlatformAdmin.status === "DISABLED") {
      throw new Error(
        "Platform Admin exists but is disabled. Reactivate it manually before reuse.",
      );
    }

    const platformAdmin =
      existingPlatformAdmin ??
      (await tx.platformUser.create({
        data: {
          email: normalized.platformAdminEmail,
          name: normalized.platformAdminName,
          status: "ACTIVE",
        },
      }));

    const existingPlatformCredential = await tx.authCredential.findUnique({
      where: { platformUserId: platformAdmin.id },
    });
    if (existingPlatformCredential === null) {
      await tx.authCredential.create({
        data: {
          subjectType: "PLATFORM_USER",
          platformUserId: platformAdmin.id,
          passwordHash: platformPasswordHash,
          emailVerifiedAt: now,
          passwordUpdatedAt: now,
        },
      });
    }

    const existingCompany = await tx.company.findUnique({
      where: { slug: normalized.companySlug },
    });
    const companyWasCreated = existingCompany === null;
    if (existingCompany !== null && existingCompany.deletedAt !== null) {
      throw new Error("Company slug exists for a deleted workspace. Restore or choose a new slug.");
    }
    if (
      existingCompany !== null &&
      (existingCompany.status === "ARCHIVED" || existingCompany.status === "SUSPENDED")
    ) {
      throw new Error(
        "Company slug exists but the workspace is not active. Reactivate it manually.",
      );
    }

    const company =
      existingCompany ??
      (await tx.company.create({
        data: {
          name: normalized.companyName,
          slug: normalized.companySlug,
          status: "ACTIVE",
        },
      }));

    await tx.permission.createMany({
      data: permissionKeys.map((key) => ({
        key,
        description: `System permission: ${key}`,
      })),
      skipDuplicates: true,
    });

    const companyAdminRole = await tx.role.upsert({
      where: {
        companyId_key: {
          companyId: company.id,
          key: companyAdminRoleKey,
        },
      },
      update: {
        name: "Company Admin",
        description: "Full workspace administration role.",
        isSystem: true,
      },
      create: {
        companyId: company.id,
        name: "Company Admin",
        key: companyAdminRoleKey,
        description: "Full workspace administration role.",
        isSystem: true,
      },
    });

    const permissions = await tx.permission.findMany({
      where: { key: { in: [...permissionKeys] } },
      select: { id: true },
    });

    await tx.rolePermission.createMany({
      data: permissions.map((permission) => ({
        roleId: companyAdminRole.id,
        permissionId: permission.id,
      })),
      skipDuplicates: true,
    });

    const existingCompanyAdmin = await tx.user.findUnique({
      where: {
        companyId_email: {
          companyId: company.id,
          email: normalized.companyAdminEmail,
        },
      },
    });
    const companyAdminWasCreated = existingCompanyAdmin === null;
    if (
      existingCompanyAdmin !== null &&
      (existingCompanyAdmin.deletedAt !== null || existingCompanyAdmin.status === "DISABLED")
    ) {
      throw new Error("Company Admin exists but cannot be reused. Reactivate it manually.");
    }

    const companyAdmin =
      existingCompanyAdmin !== null && existingCompanyAdmin.status === "INVITED"
        ? await tx.user.update({
            where: {
              companyId_email: {
                companyId: company.id,
                email: normalized.companyAdminEmail,
              },
            },
            data: { status: "ACTIVE" },
          })
        : (existingCompanyAdmin ??
          (await tx.user.create({
            data: {
              companyId: company.id,
              email: normalized.companyAdminEmail,
              name: normalized.companyAdminName,
              status: "ACTIVE",
            },
          })));

    const existingCompanyCredential = await tx.authCredential.findUnique({
      where: {
        companyId_userId: {
          companyId: company.id,
          userId: companyAdmin.id,
        },
      },
    });
    if (existingCompanyCredential === null) {
      await tx.authCredential.create({
        data: {
          subjectType: "USER",
          companyId: company.id,
          userId: companyAdmin.id,
          passwordHash: companyPasswordHash,
          emailVerifiedAt: now,
          passwordUpdatedAt: now,
        },
      });
    }

    await tx.userRole.upsert({
      where: {
        userId_roleId: {
          userId: companyAdmin.id,
          roleId: companyAdminRole.id,
        },
      },
      update: { companyId: company.id },
      create: {
        companyId: company.id,
        userId: companyAdmin.id,
        roleId: companyAdminRole.id,
      },
    });

    return {
      platformAdminStatus: platformAdminWasCreated ? "created" : "already existed",
      companyStatus: companyWasCreated ? "created" : "already existed",
      companyAdminStatus: companyAdminWasCreated ? "created" : "already existed",
      platformAdminEmail: platformAdmin.email,
      companyAdminEmail: companyAdmin.email,
      companyId: company.id,
      companySlug: company.slug,
    };
  });
}

export function loadBootstrapInputFromEnv(source: NodeJS.ProcessEnv): StagingBootstrapInput {
  return {
    platformAdminEmail: requiredEmail(source, "BOOTSTRAP_PLATFORM_ADMIN_EMAIL"),
    platformAdminName: requiredText(source, "BOOTSTRAP_PLATFORM_ADMIN_NAME"),
    platformAdminPassword: requiredText(source, "BOOTSTRAP_PLATFORM_ADMIN_PASSWORD"),
    companyName: requiredText(source, "BOOTSTRAP_COMPANY_NAME"),
    companySlug: requiredSlug(source, "BOOTSTRAP_COMPANY_SLUG"),
    companyAdminEmail: requiredEmail(source, "BOOTSTRAP_COMPANY_ADMIN_EMAIL"),
    companyAdminName: requiredText(source, "BOOTSTRAP_COMPANY_ADMIN_NAME"),
    companyAdminPassword: requiredText(source, "BOOTSTRAP_COMPANY_ADMIN_PASSWORD"),
  };
}

export function renderBootstrapResult(result: StagingBootstrapResult): string {
  return [
    "Staging bootstrap complete.",
    `Platform Admin: ${result.platformAdminStatus}`,
    `Company/workspace: ${result.companyStatus}`,
    `Company Admin: ${result.companyAdminStatus}`,
    "",
    `Platform Admin email: ${result.platformAdminEmail}`,
    `Company Admin email: ${result.companyAdminEmail}`,
    `Company Workspace ID: ${result.companyId}`,
    `Company slug: ${result.companySlug}`,
    "",
    "Platform login: choose Platform; Workspace ID is not required.",
    "Company login: choose Company; enter the printed Workspace ID.",
    "",
  ].join("\n");
}

async function runCli(): Promise<void> {
  if (process.env.APP_ENV !== "staging") {
    throw new Error("Staging bootstrap requires APP_ENV=staging.");
  }

  const prisma = new PrismaClient();
  try {
    const result = await bootstrapStaging(loadBootstrapInputFromEnv(process.env), {
      prisma: createPrismaBootstrapDatabase(prisma),
    });
    output.write(renderBootstrapResult(result));
  } finally {
    await prisma.$disconnect();
  }
}

function createPrismaBootstrapDatabase(prisma: PrismaClient): StagingBootstrapDatabase {
  return {
    $transaction: async (operation) =>
      prisma.$transaction((tx) => operation(tx as unknown as StagingBootstrapTransaction)),
  };
}

function normalizeInput(input: StagingBootstrapInput): StagingBootstrapInput {
  return {
    platformAdminEmail: normalizeEmail(input.platformAdminEmail),
    platformAdminName: normalizeRequiredText(
      input.platformAdminName,
      "BOOTSTRAP_PLATFORM_ADMIN_NAME",
    ),
    platformAdminPassword: normalizeRequiredText(
      input.platformAdminPassword,
      "BOOTSTRAP_PLATFORM_ADMIN_PASSWORD",
    ),
    companyName: normalizeRequiredText(input.companyName, "BOOTSTRAP_COMPANY_NAME"),
    companySlug: normalizeSlug(input.companySlug),
    companyAdminEmail: normalizeEmail(input.companyAdminEmail),
    companyAdminName: normalizeRequiredText(input.companyAdminName, "BOOTSTRAP_COMPANY_ADMIN_NAME"),
    companyAdminPassword: normalizeRequiredText(
      input.companyAdminPassword,
      "BOOTSTRAP_COMPANY_ADMIN_PASSWORD",
    ),
  };
}

function requiredText(source: NodeJS.ProcessEnv, name: string): string {
  return normalizeRequiredText(source[name], name);
}

function requiredEmail(source: NodeJS.ProcessEnv, name: string): string {
  return normalizeEmail(requiredText(source, name));
}

function requiredSlug(source: NodeJS.ProcessEnv, name: string): string {
  return normalizeSlug(requiredText(source, name));
}

function normalizeRequiredText(value: string | undefined, name: string): string {
  const trimmed = value?.trim();
  if (trimmed === undefined || trimmed.length === 0) {
    throw new Error(`${name} is required.`);
  }

  return trimmed;
}

function normalizeEmail(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(normalized)) {
    throw new Error("Bootstrap email values must be valid email addresses.");
  }

  return normalized;
}

function normalizeSlug(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(normalized)) {
    throw new Error(
      "BOOTSTRAP_COMPANY_SLUG must contain lowercase letters, numbers, and single hyphens only.",
    );
  }

  return normalized;
}

const executedPath = resolve(process.argv[1]);
if (fileURLToPath(import.meta.url) === executedPath) {
  runCli().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown bootstrap failure.";
    console.error(`Staging bootstrap failed: ${message}`);
    process.exitCode = 1;
  });
}
