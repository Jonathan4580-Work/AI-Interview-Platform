import { AuditWriter } from "@/modules/audit";

import type { CompanyRecord, CompanyRepository, UpdateCompanyProfileInput } from "./company-types";
import type { TenantContext } from "./types";

const companyNamePattern = /^.{2,160}$/u;
const domainPattern = /^(?=.{1,253}$)(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/u;

export class CompanyDomainError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "CompanyDomainError";
  }
}

export class CompanyService {
  public constructor(
    private readonly repository: CompanyRepository,
    private readonly audit: AuditWriter,
  ) {}

  public async getCompany(tenant: TenantContext): Promise<CompanyRecord> {
    const company = await this.repository.findByTenant(tenant);
    if (company === null) {
      throw new CompanyDomainError("Company was not found.");
    }

    return company;
  }

  public async assertCompanyWritable(tenant: TenantContext): Promise<void> {
    const company = await this.getCompany(tenant);
    if (company.status === "archived" || company.status === "suspended") {
      throw new CompanyDomainError("Company is not writable in its current status.");
    }
  }

  public async updateCompanyProfile(input: UpdateCompanyProfileInput): Promise<CompanyRecord> {
    await this.assertCompanyWritable(input.tenant);

    const before = await this.getCompany(input.tenant);
    const name = normalizeCompanyName(input.name);
    const primaryDomain = normalizeCompanyDomain(input.primaryDomain ?? null);
    const logoUrl = normalizeOptionalUrl(input.logoUrl ?? null);

    const updated = await this.repository.updateProfile({
      companyId: input.tenant.companyId,
      name,
      primaryDomain,
      logoUrl,
    });

    await this.audit.record({
      companyId: input.tenant.companyId,
      actor: input.actor,
      request: input.request,
      supportAccessSessionId: input.supportAccessSessionId ?? null,
      action: "company.profile_updated",
      resourceType: "company",
      resourceId: input.tenant.companyId,
      riskLevel: "medium",
      before: {
        name: before.name,
        primaryDomain: before.primaryDomain,
        logoUrl: before.logoUrl,
      },
      after: {
        name: updated.name,
        primaryDomain: updated.primaryDomain,
        logoUrl: updated.logoUrl,
      },
    });

    return updated;
  }
}

export function normalizeCompanyName(name: string): string {
  const normalized = name.trim();
  if (!companyNamePattern.test(normalized)) {
    throw new CompanyDomainError("Company name must be between 2 and 160 characters.");
  }

  return normalized;
}

export function normalizeCompanyDomain(domain: string | null): string | null {
  if (domain === null) {
    return null;
  }

  const normalized = domain.trim().toLowerCase();
  if (normalized.length === 0) {
    return null;
  }

  if (!domainPattern.test(normalized)) {
    throw new CompanyDomainError("Company primary domain is invalid.");
  }

  return normalized;
}

function normalizeOptionalUrl(url: string | null): string | null {
  if (url === null) {
    return null;
  }

  const normalized = url.trim();
  if (normalized.length === 0) {
    return null;
  }

  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== "https:") {
      throw new CompanyDomainError("Company logo URL must use HTTPS.");
    }
    return parsed.toString();
  } catch (error) {
    if (error instanceof CompanyDomainError) {
      throw error;
    }
    throw new CompanyDomainError("Company logo URL is invalid.");
  }
}
