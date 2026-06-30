import type { TenantContext, TenantId } from "@/modules/tenant";
import type { Brand } from "@/shared";

export type ExportRequestId = Brand<string, "ExportRequestId">;
export type ExportRequesterUserId = Brand<string, "ExportRequesterUserId">;
export type ExportArtifactId = Brand<string, "ExportArtifactId">;

export const exportRequestTypes = [
  "candidate_report",
  "candidate_transcript",
  "role_summary",
  "role_pipeline_csv",
  "candidate_comparison",
  "email_deliverability",
  "compliance_access",
  "audit_export",
  "tenant_export",
  "compliance_export",
] as const;

export type ExportRequestType = (typeof exportRequestTypes)[number];

export const exportRequestStatuses = [
  "requested",
  "pending",
  "queued",
  "processing",
  "generating",
  "ready",
  "failed",
  "expired",
  "cancelled",
] as const;

export type ExportRequestStatus = (typeof exportRequestStatuses)[number];

export const exportArtifactStatuses = ["pending", "ready", "failed", "expired", "deleted"] as const;

export type ExportArtifactStatus = (typeof exportArtifactStatuses)[number];

export const exportAccessEventTypes = ["signed_url_issued", "downloaded", "expired"] as const;

export type ExportAccessEventType = (typeof exportAccessEventTypes)[number];

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

export interface ExportArtifact {
  readonly id: ExportArtifactId;
  readonly companyId: TenantId;
  readonly exportRequestId: ExportRequestId;
  readonly status: ExportArtifactStatus;
  readonly storageProvider: string;
  readonly bucket: string;
  readonly storageKey: string;
  readonly fileName: string;
  readonly contentType: string;
  readonly sizeBytes: bigint | null;
  readonly checksumSha256: string | null;
  readonly retentionDeleteAt: Date;
  readonly expiresAt: Date;
  readonly legalHoldId: string | null;
  readonly legalHoldActive: boolean;
  readonly metadata: Record<string, string | number | boolean | null>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ExportAccessLog {
  readonly id: string;
  readonly companyId: TenantId;
  readonly exportRequestId: ExportRequestId;
  readonly exportArtifactId: ExportArtifactId | null;
  readonly actorUserId: string | null;
  readonly eventType: ExportAccessEventType;
  readonly requestId: string | null;
  readonly correlationId: string | null;
  readonly issuedAt: Date;
  readonly expiresAt: Date | null;
  readonly metadata: Record<string, string | number | boolean | null>;
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

export interface ExportArtifactStore {
  createArtifact(input: {
    readonly companyId: TenantId;
    readonly exportRequestId: ExportRequestId;
    readonly storageProvider: string;
    readonly bucket: string;
    readonly storageKey: string;
    readonly fileName: string;
    readonly contentType: string;
    readonly sizeBytes: bigint | null;
    readonly checksumSha256: string | null;
    readonly retentionDeleteAt: Date;
    readonly expiresAt: Date;
    readonly metadata: Record<string, string | number | boolean | null>;
  }): Promise<ExportArtifact>;
  findArtifact(input: {
    readonly companyId: TenantId;
    readonly artifactId: ExportArtifactId;
  }): Promise<ExportArtifact | null>;
  recordAccess(input: {
    readonly companyId: TenantId;
    readonly exportRequestId: ExportRequestId;
    readonly exportArtifactId: ExportArtifactId | null;
    readonly actorUserId: string | null;
    readonly eventType: ExportAccessEventType;
    readonly requestId: string | null;
    readonly correlationId: string | null;
    readonly expiresAt: Date | null;
    readonly metadata: Record<string, string | number | boolean | null>;
  }): Promise<ExportAccessLog>;
}

export interface ExportDownloadUrlProvider {
  createSignedDownloadUrl(input: {
    readonly bucket: string;
    readonly storageKey: string;
    readonly fileName: string;
    readonly contentType: string;
    readonly expiresInSeconds: number;
  }): Promise<string>;
}
