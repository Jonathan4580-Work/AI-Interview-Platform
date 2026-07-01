import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "@/infra/database";
import { createPermissionSet, permissionKeys } from "@/modules/access-control";
import { AuthService, PrismaAuthStore } from "@/modules/auth";
import { authCookieNames } from "@/server/api";

import type { AuditRequestContext } from "@/modules/audit";
import type { AuthSessionRecord } from "@/modules/auth";
import type { PermissionKey, PermissionSet } from "@/modules/access-control";
import type { CompanyActor, TenantContext } from "@/modules/tenant";

export interface HrWorkspaceContext {
  readonly session: AuthSessionRecord;
  readonly tenant: TenantContext;
  readonly actor: CompanyActor;
  readonly permissions: PermissionSet;
  readonly request: AuditRequestContext;
}

export async function requireHrWorkspaceContext(
  permission?: PermissionKey,
): Promise<HrWorkspaceContext> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(authCookieNames.session)?.value;
  if (sessionToken === undefined) {
    redirect("/login");
  }

  const session = await new AuthService(new PrismaAuthStore(prisma)).verifySession(sessionToken);
  if (session.subject.type !== "user") {
    redirect("/settings/integrations");
  }

  const assignments = await prisma.userRole.findMany({
    where: {
      companyId: session.subject.companyId,
      userId: session.subject.userId,
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
  });

  const permissions = createPermissionSet(
    assignments.flatMap((assignment) =>
      assignment.role.permissions
        .map((rolePermission) => rolePermission.permission.key)
        .filter(isPermissionKey),
    ),
  );

  if (permission !== undefined && !permissions.permissions.has(permission)) {
    redirect("/");
  }

  const headerStore = await headers();
  return {
    session,
    tenant: { companyId: session.subject.companyId },
    actor: { type: "user", id: session.subject.userId as unknown as CompanyActor["id"] },
    permissions,
    request: {
      requestId: headerStore.get("x-request-id") ?? "workspace-action",
      correlationId: headerStore.get("x-correlation-id") ?? "workspace-action",
      sessionId: session.id,
      ipAddress: headerStore.get("x-forwarded-for"),
      userAgent: headerStore.get("user-agent"),
    },
  };
}

export function can(permissions: PermissionSet, permission: PermissionKey): boolean {
  return permissions.permissions.has(permission);
}

function isPermissionKey(value: string): value is PermissionKey {
  return (permissionKeys as readonly string[]).includes(value);
}
