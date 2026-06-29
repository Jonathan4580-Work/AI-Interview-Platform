import { describe, expect, it } from "vitest";

import { ExportRequestError, ExportRequestService } from "@/modules/exports";
import { createTenantContext } from "@/modules/tenant";

import type {
  ExportRequesterUserId,
  ExportRequest,
  ExportRequestId,
  ExportRequestStore,
} from "@/modules/exports";

class MemoryExportRequestStore implements ExportRequestStore {
  public readonly requests: ExportRequest[] = [];

  public create(input: Parameters<ExportRequestStore["create"]>[0]): Promise<ExportRequest> {
    const now = new Date("2026-06-30T00:00:00.000Z");
    const request: ExportRequest = {
      id: `export-${String(this.requests.length + 1)}` as ExportRequestId,
      companyId: input.companyId,
      requestedByUserId: input.requestedByUserId,
      type: input.type,
      status: "pending",
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      storageKey: null,
      expiresAt: null,
      createdAt: now,
      updatedAt: now,
    };

    this.requests.push(request);
    return Promise.resolve(request);
  }
}

describe("export module", () => {
  it("creates tenant-scoped export requests without generating export artifacts", async () => {
    const tenant = createTenantContext("cm0tenant001");
    const service = new ExportRequestService(new MemoryExportRequestStore());

    const request = await service.create({
      tenant,
      requestedByUserId: "user-1" as ExportRequesterUserId,
      type: "tenant_export",
    });

    expect(request).toMatchObject({
      companyId: tenant.companyId,
      requestedByUserId: "user-1",
      type: "tenant_export",
      status: "pending",
      storageKey: null,
      expiresAt: null,
    });
  });

  it("requires resource context for resource-scoped exports", () => {
    const tenant = createTenantContext("cm0tenant001");
    const service = new ExportRequestService(new MemoryExportRequestStore());

    expect(() =>
      service.create({
        tenant,
        requestedByUserId: "user-1" as ExportRequesterUserId,
        type: "candidate_report",
      }),
    ).toThrow(ExportRequestError);

    expect(() =>
      service.create({
        tenant,
        requestedByUserId: "user-1" as ExportRequesterUserId,
        type: "candidate_report",
        resourceType: "candidate",
        resourceId: "candidate-1",
      }),
    ).not.toThrow();
  });

  it("rejects partially specified export resources", () => {
    const tenant = createTenantContext("cm0tenant001");
    const service = new ExportRequestService(new MemoryExportRequestStore());

    expect(() =>
      service.create({
        tenant,
        requestedByUserId: "user-1" as ExportRequesterUserId,
        type: "audit_export",
        resourceType: "audit",
      }),
    ).toThrow(ExportRequestError);
  });
});
