import type { Company as PrismaCompany } from "@prisma/client";

import { prisma } from "@/infra/database";

import { mapCompanyStatus } from "./status";

import type { CompanyRecord, CompanyRepository } from "./company-types";
import type { TenantContext } from "./types";

export class PrismaCompanyRepository implements CompanyRepository {
  public async findByTenant(tenant: TenantContext): Promise<CompanyRecord | null> {
    const record = await prisma.company.findUnique({
      where: {
        id: tenant.companyId,
      },
    });

    return record === null ? null : mapCompany(record);
  }

  public async updateProfile(
    input: Parameters<CompanyRepository["updateProfile"]>[0],
  ): Promise<CompanyRecord> {
    const record = await prisma.company.update({
      where: {
        id: input.companyId,
      },
      data: {
        name: input.name,
        primaryDomain: input.primaryDomain,
        logoUrl: input.logoUrl,
      },
    });

    return mapCompany(record);
  }
}

function mapCompany(record: PrismaCompany): CompanyRecord {
  return {
    id: record.id as CompanyRecord["id"],
    name: record.name,
    slug: record.slug,
    status: mapCompanyStatus(record.status),
    primaryDomain: record.primaryDomain,
    logoUrl: record.logoUrl,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    deletedAt: record.deletedAt,
  };
}
