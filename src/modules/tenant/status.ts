import { CompanyStatus } from "@prisma/client";

import type { TenantStatus } from "./types";

export function mapCompanyStatus(status: CompanyStatus): TenantStatus {
  switch (status) {
    case CompanyStatus.ACTIVE:
      return "active";
    case CompanyStatus.SUSPENDED:
      return "suspended";
    case CompanyStatus.TRIALING:
      return "trialing";
    case CompanyStatus.ARCHIVED:
      return "archived";
  }
}

export function isTenantOperational(status: TenantStatus): boolean {
  return status === "active" || status === "trialing";
}
