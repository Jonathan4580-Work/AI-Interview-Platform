import { PrismaClient } from "@prisma/client";
import { resolve } from "node:path";
import { stdin as input, stdout as output } from "node:process";
import { fileURLToPath } from "node:url";

import { hashPassword } from "../src/modules/auth/password";
import { permissionKeys } from "../src/modules/access-control/types";

const companyAdminRoleKey = "company_admin";

interface BootstrapInput {
  readonly platformAdminEmail: string;
  readonly platformAdminName: string;
  readonly companyName: string;
  readonly companySlug: string;
  readonly companyAdminEmail: string;
  readonly companyAdminName: string;
  readonly platformAdminPassword: string;
  readonly companyAdminPassword: string;
}

interface BootstrapResult {
  readonly platformAdminEmail: string;
  readonly companyAdminEmail: string;
  readonly companyId: string;
  readonly companySlug: string;
}

async function bootstrapStaging(): Promise<BootstrapResult> {
  if (process.env.APP_ENV !== "staging") {
    throw new Error("Staging bootstrap requires APP_ENV=staging.");
  }

  const inputValues = await loadBootstrapInput();
  const now = new Date();
  const prisma = new PrismaClient();

  try {
    const platformPasswordHash = hashPassword(inputValues.platformAdminPassword);
    const companyPasswordHash =
      inputValues.companyAdminPassword === inputValues.platformAdminPassword
        ? platformPasswordHash
        : hashPassword(inputValues.companyAdminPassword);

    const result = await prisma.$transaction(async (tx) => {
      const platformAdmin = await tx.platformUser.upsert({
        where: { email: inputValues.platformAdminEmail },
        update: {
          name: inputValues.platformAdminName,
          status: "ACTIVE",
        },
        create: {
          email: inputValues.platformAdminEmail,
          name: inputValues.platformAdminName,
          status: "ACTIVE",
        },
      });

      await tx.authCredential.upsert({
        where: { platformUserId: platformAdmin.id },
        update: {
          passwordHash: platformPasswordHash,
          emailVerifiedAt: now,
          passwordUpdatedAt: now,
        },
        create: {
          subjectType: "PLATFORM_USER",
          platformUserId: platformAdmin.id,
          passwordHash: platformPasswordHash,
          emailVerifiedAt: now,
          passwordUpdatedAt: now,
        },
      });

      const company = await tx.company.upsert({
        where: { slug: inputValues.companySlug },
        update: {
          name: inputValues.companyName,
          status: "ACTIVE",
          deletedAt: null,
        },
        create: {
          name: inputValues.companyName,
          slug: inputValues.companySlug,
          status: "ACTIVE",
        },
      });

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

      const companyAdmin = await tx.user.upsert({
        where: {
          companyId_email: {
            companyId: company.id,
            email: inputValues.companyAdminEmail,
          },
        },
        update: {
          name: inputValues.companyAdminName,
          status: "ACTIVE",
          deletedAt: null,
        },
        create: {
          companyId: company.id,
          email: inputValues.companyAdminEmail,
          name: inputValues.companyAdminName,
          status: "ACTIVE",
        },
      });

      await tx.authCredential.upsert({
        where: {
          companyId_userId: {
            companyId: company.id,
            userId: companyAdmin.id,
          },
        },
        update: {
          passwordHash: companyPasswordHash,
          emailVerifiedAt: now,
          passwordUpdatedAt: now,
        },
        create: {
          subjectType: "USER",
          companyId: company.id,
          userId: companyAdmin.id,
          passwordHash: companyPasswordHash,
          emailVerifiedAt: now,
          passwordUpdatedAt: now,
        },
      });

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
        platformAdminEmail: platformAdmin.email,
        companyAdminEmail: companyAdmin.email,
        companyId: company.id,
        companySlug: company.slug,
      };
    });

    return result;
  } finally {
    await prisma.$disconnect();
  }
}

async function loadBootstrapInput(): Promise<BootstrapInput> {
  const sharedPassword =
    process.env.BOOTSTRAP_ADMIN_PASSWORD?.trim() ?? (await promptHidden("Admin password: "));

  return {
    platformAdminEmail: requiredEmail("BOOTSTRAP_PLATFORM_ADMIN_EMAIL"),
    platformAdminName: optionalText("BOOTSTRAP_PLATFORM_ADMIN_NAME", "Staging Platform Admin"),
    companyName: requiredText("BOOTSTRAP_COMPANY_NAME"),
    companySlug: requiredSlug("BOOTSTRAP_COMPANY_SLUG"),
    companyAdminEmail: requiredEmail("BOOTSTRAP_COMPANY_ADMIN_EMAIL"),
    companyAdminName: optionalText("BOOTSTRAP_COMPANY_ADMIN_NAME", "Staging Company Admin"),
    platformAdminPassword: process.env.BOOTSTRAP_PLATFORM_ADMIN_PASSWORD?.trim() ?? sharedPassword,
    companyAdminPassword: process.env.BOOTSTRAP_COMPANY_ADMIN_PASSWORD?.trim() ?? sharedPassword,
  };
}

function requiredText(name: string): string {
  const value = process.env[name]?.trim();
  if (value === undefined || value.length === 0) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function optionalText(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value === undefined || value.length === 0 ? fallback : value;
}

function requiredEmail(name: string): string {
  const value = requiredText(name).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value)) {
    throw new Error(`${name} must be a valid email address.`);
  }

  return value;
}

function requiredSlug(name: string): string {
  const value = requiredText(name).toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(value)) {
    throw new Error(`${name} must contain lowercase letters, numbers, and single hyphens only.`);
  }

  return value;
}

async function promptHidden(prompt: string): Promise<string> {
  if (!input.isTTY) {
    throw new Error(
      "BOOTSTRAP_ADMIN_PASSWORD is required when no interactive terminal is attached.",
    );
  }

  output.write(prompt);
  input.setRawMode(true);
  input.resume();
  input.setEncoding("utf8");

  return new Promise((resolve, reject) => {
    let value = "";

    const cleanup = (): void => {
      input.setRawMode(false);
      input.pause();
      input.removeListener("data", onData);
      output.write("\n");
    };

    const onData = (char: string): void => {
      if (char === "\u0003") {
        cleanup();
        reject(new Error("Bootstrap cancelled."));
        return;
      }
      if (char === "\r" || char === "\n") {
        cleanup();
        resolve(value.trim());
        return;
      }
      if (char === "\u007f" || char === "\b") {
        value = value.slice(0, -1);
        return;
      }

      value += char;
    };

    input.on("data", onData);
  });
}

function printResult(result: BootstrapResult): void {
  output.write(
    [
      "Staging bootstrap complete.",
      "",
      "Platform Admin",
      `Email: ${result.platformAdminEmail}`,
      "Login account type: Platform",
      "Workspace ID: not required",
      "",
      "Company Admin",
      `Email: ${result.companyAdminEmail}`,
      `Workspace ID: ${result.companyId}`,
      `Workspace slug: ${result.companySlug}`,
      "Login account type: Company",
      "",
      "Email verification: not required for these bootstrap accounts; credentials were marked verified.",
      "",
    ].join("\n"),
  );
}

const executedPath = resolve(process.argv[1]);
if (fileURLToPath(import.meta.url) === executedPath) {
  bootstrapStaging()
    .then(printResult)
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Unknown bootstrap failure.";
      console.error(`Staging bootstrap failed: ${message}`);
      process.exitCode = 1;
    });
}
