import { prisma } from "@/infra/database";
import { createPermissionSet, permissionKeys } from "@/modules/access-control";
import { AuthService, PrismaAuthStore } from "@/modules/auth";
import { unauthenticated } from "@/server/api";

import type { PermissionKey, PermissionSet } from "@/modules/access-control";
import type { AuthSessionRecord, AuthSubject } from "@/modules/auth";
import type { TenantContext, TenantId } from "@/modules/tenant";
import type { NextRequest } from "next/server";
import { authCookieNames } from "@/server/api";

export interface AuthenticatedCompanyContext {
  readonly kind: "company";
  readonly session: AuthSessionRecord;
  readonly subject: AuthSubject & { readonly type: "user" };
  readonly tenant: TenantContext;
  readonly permissionSet: PermissionSet;
}

export interface AuthenticatedPlatformContext {
  readonly kind: "platform";
  readonly session: AuthSessionRecord;
  readonly subject: AuthSubject & { readonly type: "platform_user" };
  readonly permissionSet: PermissionSet;
}

export type AuthenticatedContext = AuthenticatedCompanyContext | AuthenticatedPlatformContext;

export async function getAuthenticatedContext(request: NextRequest): Promise<AuthenticatedContext> {
  const sessionToken = request.cookies.get(authCookieNames.session)?.value;
  if (sessionToken === undefined) {
    throw unauthenticated();
  }

  const session = await new AuthService(new PrismaAuthStore(prisma)).verifySession(sessionToken);

  if (session.subject.type === "platform_user") {
    return {
      kind: "platform",
      session,
      subject: session.subject,
      permissionSet: createPermissionSet(permissionKeys),
    };
  }

  return {
    kind: "company",
    session,
    subject: session.subject,
    tenant: { companyId: session.subject.companyId },
    permissionSet: createPermissionSet(
      await loadCompanyPermissions(session.subject.companyId, session.subject.userId),
    ),
  };
}

async function loadCompanyPermissions(
  companyId: TenantId,
  userId: string,
): Promise<PermissionKey[]> {
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
  });

  const permissions = new Set<PermissionKey>();
  for (const assignment of assignments) {
    for (const rolePermission of assignment.role.permissions) {
      if (isPermissionKey(rolePermission.permission.key)) {
        permissions.add(rolePermission.permission.key);
      }
    }
  }

  return [...permissions];
}

function isPermissionKey(value: string): value is PermissionKey {
  return (permissionKeys as readonly string[]).includes(value);
}
