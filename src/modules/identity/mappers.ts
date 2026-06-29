import { toTenantId } from "@/modules/tenant";

import { normalizeEmail } from "./email";
import { mapCompanyUserStatus, mapPlatformUserStatus } from "./status";

import type { PlatformIdentity, PlatformUserId, CompanyIdentity, UserId } from "./types";
import type { PlatformUser, User } from "@prisma/client";

export function toPlatformIdentity(record: PlatformUser): PlatformIdentity {
  return {
    id: record.id as PlatformUserId,
    email: normalizeEmail(record.email),
    name: record.name,
    status: mapPlatformUserStatus(record.status),
  };
}

export function toCompanyIdentity(record: User): CompanyIdentity {
  return {
    id: record.id as UserId,
    companyId: toTenantId(record.companyId),
    email: normalizeEmail(record.email),
    name: record.name,
    status: mapCompanyUserStatus(record.status),
  };
}
