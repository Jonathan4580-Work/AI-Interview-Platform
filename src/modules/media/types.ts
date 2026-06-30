import type { AuditActor, AuditRequestContext } from "@/modules/audit";
import type { TenantContext, TenantId } from "@/modules/tenant";
import type { Brand } from "@/shared";

export type MediaObjectId = Brand<string, "MediaObjectId">;
export type MediaUploadSessionId = Brand<string, "MediaUploadSessionId">;

export type MediaOwnerType =
  | "candidate"
  | "candidate_session"
  | "invitation"
  | "interview_session"
  | "identity_verification"
  | "export";

export type MediaPurpose =
  "identity_snapshot" | "interview_recording" | "report_export" | "general_attachment";

export type MediaUploadStatus =
  "pending" | "authorized" | "uploading" | "completed" | "aborted" | "expired" | "failed";

export type MediaProcessingStatus =
  "pending" | "ready" | "processing" | "failed" | "quarantined" | "deleted";

export type MediaRetentionClass = "identity_verification" | "recording" | "export" | "operational";

export type MediaUploadKind = "single_part" | "multipart";

export interface MediaMutationContext {
  readonly tenant: TenantContext;
  readonly actor: AuditActor;
  readonly request: AuditRequestContext;
  readonly supportAccessSessionId?: string | null;
}

export interface MediaObjectRecord {
  readonly id: MediaObjectId;
  readonly companyId: TenantId;
  readonly ownerType: MediaOwnerType;
  readonly ownerId: string;
  readonly subjectType: MediaOwnerType;
  readonly subjectId: string;
  readonly purpose: MediaPurpose;
  readonly storageProvider: string;
  readonly bucket: string;
  readonly region: string | null;
  readonly storageKey: string;
  readonly mimeType: string;
  readonly sizeBytes: bigint | null;
  readonly expectedSizeBytes: bigint | null;
  readonly checksumSha256: string | null;
  readonly expectedChecksumSha256: string | null;
  readonly uploadStatus: MediaUploadStatus;
  readonly processingStatus: MediaProcessingStatus;
  readonly retentionClass: MediaRetentionClass;
  readonly encryptionRef: string | null;
  readonly retentionDeleteAt: Date;
  readonly legalHoldId: string | null;
  readonly legalHoldActive: boolean;
  readonly completedAt: Date | null;
  readonly deletedAt: Date | null;
  readonly deletionRequestedAt: Date | null;
  readonly providerMetadata: Record<string, unknown>;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface MediaUploadSessionRecord {
  readonly id: MediaUploadSessionId;
  readonly companyId: TenantId;
  readonly mediaObjectId: MediaObjectId;
  readonly kind: MediaUploadKind;
  readonly status: MediaUploadStatus;
  readonly providerUploadId: string | null;
  readonly idempotencyKey: string;
  readonly partSizeBytes: number | null;
  readonly expectedPartCount: number | null;
  readonly expiresAt: Date;
  readonly completedAt: Date | null;
  readonly abortedAt: Date | null;
  readonly requestId: string | null;
  readonly correlationId: string | null;
  readonly providerMetadata: Record<string, unknown>;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface MediaUploadPartRecord {
  readonly id: string;
  readonly companyId: TenantId;
  readonly uploadSessionId: MediaUploadSessionId;
  readonly mediaObjectId: MediaObjectId;
  readonly partNumber: number;
  readonly etag: string | null;
  readonly checksumSha256: string | null;
  readonly sizeBytes: bigint | null;
  readonly uploadedAt: Date | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface SignedUrl {
  readonly url: string;
  readonly expiresAt: Date;
  readonly headers: Readonly<Record<string, string>>;
}

export interface PreparedUpload {
  readonly media: MediaObjectRecord;
  readonly uploadSession: MediaUploadSessionRecord;
  readonly uploadUrl?: SignedUrl;
  readonly parts?: readonly {
    readonly partNumber: number;
    readonly uploadUrl: SignedUrl;
  }[];
}

export interface CompletedUploadPartInput {
  readonly partNumber: number;
  readonly etag: string;
  readonly checksumSha256?: string | null;
  readonly sizeBytes?: bigint | null;
}

export interface ObjectStorageVerification {
  readonly exists: boolean;
  readonly sizeBytes: bigint | null;
  readonly mimeType: string | null;
  readonly checksumSha256: string | null;
  readonly providerMetadata: Record<string, unknown>;
}

export interface ObjectStorageProvider {
  readonly providerKey: string;
  readonly bucket: string;
  readonly region: string | null;

  createSignedUploadUrl(input: {
    readonly storageKey: string;
    readonly mimeType: string;
    readonly checksumSha256?: string | null;
    readonly expiresInSeconds: number;
  }): Promise<SignedUrl>;

  createMultipartUpload(input: {
    readonly storageKey: string;
    readonly mimeType: string;
    readonly checksumSha256?: string | null;
  }): Promise<{ readonly providerUploadId: string; readonly metadata: Record<string, unknown> }>;

  createSignedPartUploadUrl(input: {
    readonly storageKey: string;
    readonly providerUploadId: string;
    readonly partNumber: number;
    readonly expiresInSeconds: number;
  }): Promise<SignedUrl>;

  completeMultipartUpload(input: {
    readonly storageKey: string;
    readonly providerUploadId: string;
    readonly parts: readonly { readonly partNumber: number; readonly etag: string }[];
  }): Promise<Record<string, unknown>>;

  abortMultipartUpload(input: {
    readonly storageKey: string;
    readonly providerUploadId: string;
  }): Promise<void>;

  verifyObject(storageKey: string): Promise<ObjectStorageVerification>;

  createSignedDownloadUrl(input: {
    readonly storageKey: string;
    readonly expiresInSeconds: number;
    readonly contentDisposition?: string | null;
  }): Promise<SignedUrl>;

  deleteObject(storageKey: string): Promise<void>;
}

export interface MediaRepository {
  findUploadSessionByIdempotency(input: {
    readonly companyId: TenantId;
    readonly idempotencyKey: string;
  }): Promise<{
    readonly media: MediaObjectRecord;
    readonly uploadSession: MediaUploadSessionRecord;
  } | null>;

  createMediaWithUploadSession(input: {
    readonly companyId: TenantId;
    readonly ownerType: MediaOwnerType;
    readonly ownerId: string;
    readonly subjectType: MediaOwnerType;
    readonly subjectId: string;
    readonly purpose: MediaPurpose;
    readonly storageProvider: string;
    readonly bucket: string;
    readonly region: string | null;
    readonly storageKey: string;
    readonly mimeType: string;
    readonly expectedSizeBytes: bigint;
    readonly expectedChecksumSha256: string | null;
    readonly retentionClass: MediaRetentionClass;
    readonly retentionDeleteAt: Date;
    readonly kind: MediaUploadKind;
    readonly providerUploadId: string | null;
    readonly idempotencyKey: string;
    readonly partSizeBytes: number | null;
    readonly expectedPartCount: number | null;
    readonly expiresAt: Date;
    readonly requestId: string | null;
    readonly correlationId: string | null;
    readonly providerMetadata: Record<string, unknown>;
    readonly metadata: Record<string, unknown>;
  }): Promise<{
    readonly media: MediaObjectRecord;
    readonly uploadSession: MediaUploadSessionRecord;
  }>;

  findMedia(tenant: TenantContext, id: MediaObjectId): Promise<MediaObjectRecord | null>;

  findUploadSession(
    tenant: TenantContext,
    id: MediaUploadSessionId,
  ): Promise<MediaUploadSessionRecord | null>;

  listMedia(input: {
    readonly tenant: TenantContext;
    readonly purpose?: MediaPurpose;
    readonly limit: number;
    readonly cursor?: string;
  }): Promise<readonly MediaObjectRecord[]>;

  upsertUploadParts(input: {
    readonly companyId: TenantId;
    readonly mediaObjectId: MediaObjectId;
    readonly uploadSessionId: MediaUploadSessionId;
    readonly parts: readonly CompletedUploadPartInput[];
  }): Promise<readonly MediaUploadPartRecord[]>;

  listUploadParts(
    tenant: TenantContext,
    uploadSessionId: MediaUploadSessionId,
  ): Promise<readonly MediaUploadPartRecord[]>;

  markUploadCompleted(input: {
    readonly tenant: TenantContext;
    readonly mediaObjectId: MediaObjectId;
    readonly uploadSessionId: MediaUploadSessionId;
    readonly sizeBytes: bigint;
    readonly checksumSha256: string | null;
    readonly providerMetadata: Record<string, unknown>;
    readonly completedAt: Date;
  }): Promise<MediaObjectRecord | null>;

  markUploadFailed(input: {
    readonly tenant: TenantContext;
    readonly mediaObjectId: MediaObjectId;
    readonly uploadSessionId: MediaUploadSessionId;
    readonly failureCode: string;
    readonly failureMessage: string;
  }): Promise<void>;

  abortUpload(input: {
    readonly tenant: TenantContext;
    readonly mediaObjectId: MediaObjectId;
    readonly uploadSessionId: MediaUploadSessionId;
    readonly abortedAt: Date;
  }): Promise<MediaUploadSessionRecord | null>;

  requestDeletion(input: {
    readonly tenant: TenantContext;
    readonly mediaObjectId: MediaObjectId;
    readonly requestedAt: Date;
  }): Promise<MediaObjectRecord | null>;

  markDeleted(input: {
    readonly tenant: TenantContext;
    readonly mediaObjectId: MediaObjectId;
    readonly deletedAt: Date;
  }): Promise<MediaObjectRecord | null>;

  hasActiveLegalHold(tenant: TenantContext): Promise<boolean>;
}
