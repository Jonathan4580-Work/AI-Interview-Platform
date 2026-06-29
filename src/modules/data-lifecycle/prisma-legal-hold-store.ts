import {
  LegalHoldStatus as PrismaLegalHoldStatus,
  type LegalHold as PrismaLegalHold,
} from "@prisma/client";

import { prisma } from "@/infra/database";
import { assertTenantRecord } from "@/shared/repositories";

import type { TenantContext } from "@/modules/tenant";
import type { LegalHold, LegalHoldId, LegalHoldStatus, LegalHoldStore } from "./legal-holds";

export class PrismaLegalHoldStore implements LegalHoldStore {
  public async create(input: Parameters<LegalHoldStore["create"]>[0]): Promise<LegalHold> {
    const record = await prisma.legalHold.create({
      data: {
        companyId: input.companyId,
        name: input.name,
        description: input.description,
        createdByUserId: input.createdByUserId,
      },
    });

    return mapLegalHold(record);
  }

  public async release(input: Parameters<LegalHoldStore["release"]>[0]): Promise<LegalHold> {
    const result = await prisma.legalHold.updateMany({
      where: {
        id: input.legalHoldId,
        companyId: input.tenant.companyId,
      },
      data: {
        status: PrismaLegalHoldStatus.RELEASED,
        releasedByUserId: input.releasedByUserId,
        releasedAt: input.releasedAt,
      },
    });

    if (result.count !== 1) {
      throw new Error("Legal hold was not found for tenant.");
    }

    const record = await prisma.legalHold.findUniqueOrThrow({
      where: {
        id: input.legalHoldId,
      },
    });
    const tenantRecord = assertTenantRecord(input.tenant, record);
    if (tenantRecord === null) {
      throw new Error("Legal hold was not found for tenant.");
    }

    return mapLegalHold(tenantRecord);
  }

  public async hasActiveHold(tenant: TenantContext): Promise<boolean> {
    const count = await prisma.legalHold.count({
      where: {
        companyId: tenant.companyId,
        status: PrismaLegalHoldStatus.ACTIVE,
      },
    });

    return count > 0;
  }
}

function mapLegalHold(record: PrismaLegalHold): LegalHold {
  return {
    id: record.id as LegalHoldId,
    companyId: record.companyId as LegalHold["companyId"],
    name: record.name,
    description: record.description,
    status: fromPrismaLegalHoldStatus(record.status),
    createdByUserId: record.createdByUserId as LegalHold["createdByUserId"],
    releasedByUserId: record.releasedByUserId as LegalHold["releasedByUserId"],
    createdAt: record.createdAt,
    releasedAt: record.releasedAt,
  };
}

function fromPrismaLegalHoldStatus(status: PrismaLegalHoldStatus): LegalHoldStatus {
  switch (status) {
    case PrismaLegalHoldStatus.ACTIVE:
      return "active";
    case PrismaLegalHoldStatus.RELEASED:
      return "released";
  }
}
