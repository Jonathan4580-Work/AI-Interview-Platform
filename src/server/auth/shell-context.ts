import { prisma } from "@/infra/database";
import { createPermissionSet, permissionKeys } from "@/modules/access-control";
import { AuthService, PrismaAuthStore } from "@/modules/auth";

import type { ShellUser, ShellWorkspace } from "@/components/layout/navigation-types";
import type { PermissionKey } from "@/modules/access-control";
import type { TenantId } from "@/modules/tenant";
import type { ShellAudience } from "@/components/layout/workspace-navigation";

export interface WorkspaceShellContext {
  readonly audience: ShellAudience;
  readonly user: ShellUser;
  readonly workspace: ShellWorkspace;
  readonly permissions: readonly PermissionKey[];
}

export async function getWorkspaceShellContext(
  sessionToken: string,
): Promise<WorkspaceShellContext | null> {
  try {
    const session = await new AuthService(new PrismaAuthStore(prisma)).verifySession(sessionToken);

    if (session.subject.type === "platform_user") {
      return {
        audience: "platform",
        user: {
          name: session.subject.name,
          email: session.subject.email,
          initials: initialsForName(session.subject.name, session.subject.email),
          roleLabel: "Platform Admin",
        },
        workspace: {
          name: "Aptly Platform",
          planLabel: "Platform administration",
        },
        permissions: [...permissionKeys],
      };
    }

    const company = await prisma.company.findFirst({
      where: {
        id: session.subject.companyId,
        deletedAt: null,
      },
      select: {
        name: true,
        slug: true,
      },
    });

    if (company === null) {
      return null;
    }

    const roles = await loadCompanyRoles(session.subject.companyId, session.subject.userId);

    return {
      audience: "company",
      user: {
        name: session.subject.name,
        email: session.subject.email,
        initials: initialsForName(session.subject.name, session.subject.email),
        roleLabel: roleLabel(roles.names),
      },
      workspace: {
        name: company.name,
        planLabel: `Workspace ${company.slug}`,
      },
      permissions: roles.permissions,
    };
  } catch {
    return null;
  }
}

async function loadCompanyRoles(
  companyId: TenantId,
  userId: string,
): Promise<{ readonly names: readonly string[]; readonly permissions: readonly PermissionKey[] }> {
  const assignments = await prisma.userRole.findMany({
    where: {
      companyId,
      userId,
    },
    include: {
      role: {
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
    orderBy: {
      role: {
        name: "asc",
      },
    },
  });

  const permissions = createPermissionSet(
    assignments.flatMap((assignment) =>
      assignment.role.permissions
        .map((rolePermission) => rolePermission.permission.key)
        .filter(isPermissionKey),
    ),
  );

  return {
    names: assignments.map((assignment) => assignment.role.name),
    permissions: [...permissions.permissions],
  };
}

function roleLabel(roleNames: readonly string[]): string {
  if (roleNames.length === 0) {
    return "Workspace user";
  }

  if (roleNames.length === 1) {
    return roleNames[0] ?? "Workspace user";
  }

  return `${roleNames[0] ?? "Workspace user"} +${String(roleNames.length - 1)}`;
}

function initialsForName(name: string, email: string): string {
  const parts = name
    .trim()
    .split(/\s+/u)
    .filter((part) => part.length > 0);

  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }

  const source = parts[0] ?? email;
  return source.slice(0, 2).toUpperCase();
}

function isPermissionKey(value: string): value is PermissionKey {
  return (permissionKeys as readonly string[]).includes(value);
}
