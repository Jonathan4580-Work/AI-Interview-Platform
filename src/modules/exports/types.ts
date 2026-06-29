import type { TenantContext, TenantId } from "@/modules/tenant";
import type { Brand } from "@/shared";

export type ExportRequestId = Brand<string, "ExportRequestId">;
export type ExportRequesterUserId = Brand<string, "ExportRequesterUserId">;

export const exportRequestTypes = [
  "candidate_report",
  "role_summary",
  "audit_export",
  "tenant_export",
  "compliance_export",
] as const;

export type ExportRequestType = (typeof exportRequestTypes)[number];

export const exportRequestStatuses = [
  "pending",
  "processing",
  "ready",
  "failed",
  "expired",
] as const;

export type ExportRequestStatus = (typeof exportRequestStatuses)[number];

export interface ExportRequest {
  readonly id: ExportRequestId;
  readonly companyId: TenantId;
  readonly requestedByUserId: ExportRequesterUserId;
  readonly type: ExportRequestType;
  readonly status: ExportRequestStatus;
  readonly resourceType: string | null;
  readonly resourceId: string | null;
  readonly storageKey: string | null;
  readonly expiresAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateExportRequestInput {
  readonly tenant: TenantContext;
  readonly requestedByUserId: ExportRequesterUserId;
  readonly type: ExportRequestType;
  readonly resourceType?: string | null;
  readonly resourceId?: string | null;
}

export interface ExportRequestStore {
  create(input: {
    readonly companyId: TenantId;
    readonly requestedByUserId: ExportRequesterUserId;
    readonly type: ExportRequestType;
    readonly resourceType: string | null;
    readonly resourceId: string | null;
  }): Promise<ExportRequest>;
}
