import { describe, expect, it } from "vitest";

import {
  PrivacyRequestError,
  PrivacyRequestService,
  getDataClassificationPolicy,
  tableDataClassification,
} from "@/modules/compliance-privacy";
import { createTenantContext } from "@/modules/tenant";

import type {
  PrivacyRequest,
  PrivacyRequestId,
  PrivacyRequestStore,
} from "@/modules/compliance-privacy";

class MemoryPrivacyRequestStore implements PrivacyRequestStore {
  public readonly requests: PrivacyRequest[] = [];

  public create(input: Parameters<PrivacyRequestStore["create"]>[0]): Promise<PrivacyRequest> {
    const now = new Date("2026-06-30T00:00:00.000Z");
    const request: PrivacyRequest = {
      id: `privacy-${String(this.requests.length + 1)}` as PrivacyRequestId,
      companyId: input.companyId,
      candidateId: input.candidateId,
      type: input.type,
      status: "received",
      requesterEmail: input.requesterEmail,
      reason: input.reason,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    this.requests.push(request);
    return Promise.resolve(request);
  }
}

describe("compliance and privacy module", () => {
  it("classifies support, legal hold, privacy, export, and audit data as sensitive", () => {
    expect(tableDataClassification.support_access_sessions).toBe("restricted");
    expect(tableDataClassification.legal_holds).toBe("regulated_sensitive");
    expect(tableDataClassification.privacy_requests).toBe("regulated_sensitive");
    expect(tableDataClassification.export_requests).toBe("restricted");
    expect(tableDataClassification.audit_events).toBe("restricted");

    expect(getDataClassificationPolicy("restricted")).toMatchObject({
      requiresAccessAudit: true,
      redactFromLogs: true,
      requiresRetentionPolicy: true,
    });
  });

  it("creates privacy requests with normalized requester email", async () => {
    const tenant = createTenantContext("cm0tenant001");
    const store = new MemoryPrivacyRequestStore();
    const service = new PrivacyRequestService(store);

    const request = await service.create({
      companyId: tenant.companyId,
      type: "access",
      requesterEmail: " Candidate@Example.COM ",
      reason: "Candidate requested access",
    });

    expect(request).toMatchObject({
      companyId: tenant.companyId,
      type: "access",
      status: "received",
      requesterEmail: "candidate@example.com",
    });
  });

  it("requires a reason before creating privacy requests that change data", async () => {
    const tenant = createTenantContext("cm0tenant001");
    const service = new PrivacyRequestService(new MemoryPrivacyRequestStore());

    await expect(
      service.create({
        companyId: tenant.companyId,
        type: "deletion",
        requesterEmail: "candidate@example.com",
      }),
    ).rejects.toBeInstanceOf(PrivacyRequestError);
  });
});
