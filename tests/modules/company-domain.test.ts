import { describe, expect, it } from "vitest";

import { AuditWriter } from "@/modules/audit";
import {
  CompanyDomainError,
  CompanyService,
  CompanySettingsError,
  CompanySettingsService,
  createTenantContext,
} from "@/modules/tenant";

import type { AuditEventStore, PersistedAuditEventInput } from "@/modules/audit";
import type {
  BrandingSettings,
  CandidatePolicySettings,
  CompanyRecord,
  CompanyRepository,
  CompanySettingsRecord,
  CompanySettingsRepository,
  CompanyUserId,
  InvitationPolicySettings,
  SchedulingPolicySettings,
  TenantContext,
  TenantId,
} from "@/modules/tenant";

const request = {
  requestId: "req-1",
  correlationId: "corr-1",
  sessionId: "sess-1",
  ipAddress: "127.0.0.1",
  userAgent: "vitest",
};

class RecordingAuditStore implements AuditEventStore {
  public readonly events: PersistedAuditEventInput[] = [];

  public append(event: PersistedAuditEventInput): Promise<void> {
    this.events.push(event);
    return Promise.resolve();
  }
}

class MemoryCompanyRepository implements CompanyRepository {
  public company: CompanyRecord;

  public constructor(company: Partial<CompanyRecord> = {}) {
    this.company = {
      id: "cm0tenant001" as TenantId,
      name: "Acme",
      slug: "acme",
      status: "active",
      primaryDomain: null,
      logoUrl: null,
      createdAt: new Date("2026-06-30T00:00:00.000Z"),
      updatedAt: new Date("2026-06-30T00:00:00.000Z"),
      deletedAt: null,
      ...company,
    };
  }

  public findByTenant(tenant: TenantContext): Promise<CompanyRecord | null> {
    void tenant;
    return Promise.resolve(this.company);
  }

  public updateProfile(
    input: Parameters<CompanyRepository["updateProfile"]>[0],
  ): Promise<CompanyRecord> {
    this.company = {
      ...this.company,
      name: input.name,
      primaryDomain: input.primaryDomain,
      logoUrl: input.logoUrl,
      updatedAt: new Date("2026-06-30T01:00:00.000Z"),
    };
    return Promise.resolve(this.company);
  }
}

class MemoryCompanySettingsRepository implements CompanySettingsRepository {
  public settings: CompanySettingsRecord | null = null;

  public findByTenant(tenant: TenantContext): Promise<CompanySettingsRecord | null> {
    void tenant;
    return Promise.resolve(this.settings);
  }

  public upsert(input: {
    readonly companyId: TenantId;
    readonly branding: BrandingSettings;
    readonly candidatePolicy: CandidatePolicySettings;
    readonly invitationPolicy: InvitationPolicySettings;
    readonly schedulingPolicy: SchedulingPolicySettings;
  }): Promise<CompanySettingsRecord> {
    const now = new Date("2026-06-30T00:00:00.000Z");
    this.settings = {
      id: "settings-1",
      companyId: input.companyId,
      branding: input.branding,
      candidatePolicy: input.candidatePolicy,
      invitationPolicy: input.invitationPolicy,
      schedulingPolicy: input.schedulingPolicy,
      createdAt: this.settings?.createdAt ?? now,
      updatedAt: now,
    };
    return Promise.resolve(this.settings);
  }
}

describe("company domain", () => {
  it("updates company profile with normalized domain and audit event", async () => {
    const tenant = createTenantContext("cm0tenant001");
    const auditStore = new RecordingAuditStore();
    const service = new CompanyService(new MemoryCompanyRepository(), new AuditWriter(auditStore));

    const actorId = "user-1" as CompanyUserId;
    const updated = await service.updateCompanyProfile({
      tenant,
      actor: { type: "user", id: actorId },
      request,
      name: " Acme Recruiting ",
      primaryDomain: "Example.COM",
      logoUrl: "https://example.com/logo.png",
    });

    expect(updated).toMatchObject({
      name: "Acme Recruiting",
      primaryDomain: "example.com",
      logoUrl: "https://example.com/logo.png",
    });
    expect(auditStore.events[0]).toMatchObject({
      action: "company.profile_updated",
      resourceType: "company",
      riskLevel: "medium",
    });
  });

  it("blocks writes for suspended companies", async () => {
    const tenant = createTenantContext("cm0tenant001");
    const service = new CompanyService(
      new MemoryCompanyRepository({ status: "suspended" }),
      new AuditWriter(new RecordingAuditStore()),
    );

    await expect(
      service.updateCompanyProfile({
        tenant,
        actor: { type: "user", id: "user-1" as CompanyUserId },
        request,
        name: "Acme Recruiting",
      }),
    ).rejects.toBeInstanceOf(CompanyDomainError);
  });

  it("validates and audits company settings policies", async () => {
    const tenant = createTenantContext("cm0tenant001");
    const auditStore = new RecordingAuditStore();
    const service = new CompanySettingsService(
      new MemoryCompanySettingsRepository(),
      new AuditWriter(auditStore),
    );

    const actorId = "user-1" as CompanyUserId;
    await service.updateInvitationPolicy({
      tenant,
      actor: { type: "user", id: actorId },
      request,
      defaultExpirationDays: 14,
      minimumExpirationHours: 2,
      maximumExpirationDays: 30,
    });

    await expect(
      service.updateBranding({
        tenant,
        actor: { type: "user", id: actorId },
        request,
        primaryColor: "blue",
      }),
    ).rejects.toBeInstanceOf(CompanySettingsError);

    expect(auditStore.events.map((event) => event.action)).toContain(
      "company_settings.invitation_policy_updated",
    );
  });
});
