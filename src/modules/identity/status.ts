import { PlatformUserStatus, UserStatus } from "@prisma/client";

import type {
  CompanyUserStatus as CompanyUserStatusValue,
  PlatformUserStatus as PlatformUserStatusValue,
} from "./types";

export function mapPlatformUserStatus(status: PlatformUserStatus): PlatformUserStatusValue {
  switch (status) {
    case PlatformUserStatus.ACTIVE:
      return "active";
    case PlatformUserStatus.DISABLED:
      return "disabled";
  }
}

export function mapCompanyUserStatus(status: UserStatus): CompanyUserStatusValue {
  switch (status) {
    case UserStatus.INVITED:
      return "invited";
    case UserStatus.ACTIVE:
      return "active";
    case UserStatus.DISABLED:
      return "disabled";
  }
}

export function isCompanyUserActive(status: CompanyUserStatusValue): boolean {
  return status === "active";
}
