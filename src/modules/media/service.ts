import { randomUUID } from "node:crypto";

import { AuditWriter } from "@/modules/audit";

import type {
  CompletedUploadPartInput,
  MediaMutationContext,
  MediaObjectId,
  MediaObjectRecord,
  MediaOwnerType,
  MediaPurpose,
  MediaRepository,
  MediaRetentionClass,
  MediaUploadKind,
  MediaUploadSessionRecord,
  MediaUploadSessionId,
  ObjectStorageProvider,
  PreparedUpload,
  SignedUrl,
} from "./types";

const SINGLE_PART_UPLOAD_TTL_SECONDS = 10 * 60;
const MULTIPART_UPLOAD_TTL_SECONDS = 60 * 60;
const DOWNLOAD_TTL_SECONDS = 5 * 60;
const MULTIPART_PART_SIZE_BYTES = 16 * 1024 * 1024;

export class MediaDomainError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "MediaDomainError";
  }
}

export class MediaService {
  public constructor(
    private readonly repository: MediaRepository,
    private readonly storageProvider: ObjectStorageProvider,
    private readonly auditWriter: AuditWriter,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async prepareUpload(input: {
    readonly context: MediaMutationContext;
    readonly ownerType: MediaOwnerType;
    readonly ownerId: string;
    readonly subjectType: MediaOwnerType;
    readonly subjectId: string;
    readonly purpose: MediaPurpose;
    readonly mimeType: string;
    readonly sizeBytes: bigint;
    readonly checksumSha256?: string | null;
    readonly kind: MediaUploadKind;
    readonly partCount?: number | null;
    readonly idempotencyKey: string;
  }): Promise<PreparedUpload> {
    const idempotencyKey = normalizeKey(input.idempotencyKey, "Media upload idempotency key");
    const existing = await this.repository.findUploadSessionByIdempotency({
      companyId: input.context.tenant.companyId,
      idempotencyKey,
    });
    if (existing !== null) {
      return this.createSignedInstructions(existing.media, existing.uploadSession);
    }

    const policy = getPurposePolicy(input.purpose);
    const mimeType = normalizeMimeType(input.mimeType);
    if (!policy.allowedMimeTypes.includes(mimeType)) {
      throw new MediaDomainError("Media MIME type is not allowed for this purpose.");
    }
    if (input.sizeBytes < 1n || input.sizeBytes > policy.maxSizeBytes) {
      throw new MediaDomainError("Media size is outside the allowed range for this purpose.");
    }
    const checksumSha256 = normalizeOptionalChecksum(input.checksumSha256 ?? null);
    const partCount = normalizePartCount(input.kind, input.partCount ?? null, input.sizeBytes);
    const storageKey = createStorageKey({
      companyId: String(input.context.tenant.companyId),
      purpose: input.purpose,
      mimeType,
      now: this.now(),
    });

    const multipart =
      input.kind === "multipart"
        ? await this.storageProvider.createMultipartUpload({
            storageKey,
            mimeType,
            checksumSha256,
          })
        : null;

    const created = await this.repository.createMediaWithUploadSession({
      companyId: input.context.tenant.companyId,
      ownerType: input.ownerType,
      ownerId: normalizeKey(input.ownerId, "Media owner ID"),
      subjectType: input.subjectType,
      subjectId: normalizeKey(input.subjectId, "Media subject ID"),
      purpose: input.purpose,
      storageProvider: this.storageProvider.providerKey,
      bucket: this.storageProvider.bucket,
      region: this.storageProvider.region,
      storageKey,
      mimeType,
      expectedSizeBytes: input.sizeBytes,
      expectedChecksumSha256: checksumSha256,
      retentionClass: policy.retentionClass,
      retentionDeleteAt: addDays(this.now(), policy.retentionDays),
      kind: input.kind,
      providerUploadId: multipart?.providerUploadId ?? null,
      idempotencyKey,
      partSizeBytes: input.kind === "multipart" ? MULTIPART_PART_SIZE_BYTES : null,
      expectedPartCount: partCount,
      expiresAt: new Date(
        this.now().getTime() +
          (input.kind === "multipart"
            ? MULTIPART_UPLOAD_TTL_SECONDS
            : SINGLE_PART_UPLOAD_TTL_SECONDS) *
            1000,
      ),
      requestId: input.context.request.requestId,
      correlationId: input.context.request.correlationId,
      providerMetadata: multipart?.metadata ?? {},
      metadata: {
        schemaVersion: 1,
        dataClassification: policy.dataClassification,
      },
    });

    await this.writeAudit(
      input.context,
      "media.upload_authorized",
      "media_object",
      created.media.id,
      {
        after: safeMediaAudit(created.media),
      },
    );
    return this.createSignedInstructions(created.media, created.uploadSession);
  }

  public async completeUpload(input: {
    readonly context: MediaMutationContext;
    readonly mediaObjectId: MediaObjectId;
    readonly uploadSessionId: MediaUploadSessionId;
    readonly parts?: readonly CompletedUploadPartInput[];
  }): Promise<MediaObjectRecord> {
    const media = await this.requireMedia(input.context, input.mediaObjectId);
    const uploadSession = await this.requireUploadSession(input.context, input.uploadSessionId);
    assertSameUpload(media, uploadSession);
    if (media.uploadStatus === "completed") {
      return media;
    }
    if (uploadSession.status === "aborted" || uploadSession.status === "expired") {
      throw new MediaDomainError("Media upload session is no longer active.");
    }
    if (uploadSession.expiresAt <= this.now()) {
      await this.repository.markUploadFailed({
        tenant: input.context.tenant,
        mediaObjectId: media.id,
        uploadSessionId: uploadSession.id,
        failureCode: "UPLOAD_SESSION_EXPIRED",
        failureMessage: "Upload session expired before completion.",
      });
      throw new MediaDomainError("Media upload session has expired.");
    }

    if (uploadSession.kind === "multipart") {
      await this.completeMultipart(media, uploadSession, input.parts ?? []);
    }

    const verification = await this.storageProvider.verifyObject(media.storageKey);
    if (!verification.exists) {
      await this.failVerification(input.context, media, uploadSession, "OBJECT_NOT_FOUND");
      throw new MediaDomainError("Object storage did not confirm the uploaded object.");
    }
    if (verification.sizeBytes === null || verification.sizeBytes !== media.expectedSizeBytes) {
      await this.failVerification(input.context, media, uploadSession, "OBJECT_SIZE_MISMATCH");
      throw new MediaDomainError("Object size does not match the authorized upload.");
    }
    if (verification.mimeType !== null && verification.mimeType !== media.mimeType) {
      await this.failVerification(input.context, media, uploadSession, "OBJECT_MIME_MISMATCH");
      throw new MediaDomainError("Object MIME type does not match the authorized upload.");
    }
    if (
      media.expectedChecksumSha256 !== null &&
      verification.checksumSha256 !== null &&
      verification.checksumSha256 !== media.expectedChecksumSha256
    ) {
      await this.failVerification(input.context, media, uploadSession, "OBJECT_CHECKSUM_MISMATCH");
      throw new MediaDomainError("Object checksum does not match the authorized upload.");
    }

    const completed = await this.repository.markUploadCompleted({
      tenant: input.context.tenant,
      mediaObjectId: media.id,
      uploadSessionId: uploadSession.id,
      sizeBytes: verification.sizeBytes,
      checksumSha256: verification.checksumSha256 ?? media.expectedChecksumSha256,
      providerMetadata: verification.providerMetadata,
      completedAt: this.now(),
    });
    if (completed === null) {
      throw new MediaDomainError("Media upload could not be completed from its current state.");
    }
    await this.writeAudit(input.context, "media.upload_completed", "media_object", completed.id, {
      after: safeMediaAudit(completed),
    });
    return completed;
  }

  public async abortUpload(input: {
    readonly context: MediaMutationContext;
    readonly mediaObjectId: MediaObjectId;
    readonly uploadSessionId: MediaUploadSessionId;
  }) {
    const media = await this.requireMedia(input.context, input.mediaObjectId);
    const uploadSession = await this.requireUploadSession(input.context, input.uploadSessionId);
    assertSameUpload(media, uploadSession);
    if (uploadSession.providerUploadId !== null) {
      await this.storageProvider.abortMultipartUpload({
        storageKey: media.storageKey,
        providerUploadId: uploadSession.providerUploadId,
      });
    }
    const aborted = await this.repository.abortUpload({
      tenant: input.context.tenant,
      mediaObjectId: media.id,
      uploadSessionId: uploadSession.id,
      abortedAt: this.now(),
    });
    if (aborted === null) {
      throw new MediaDomainError("Media upload cannot be aborted from its current state.");
    }
    await this.writeAudit(
      input.context,
      "media.upload_aborted",
      "media_upload_session",
      aborted.id,
      {
        after: { id: aborted.id, status: aborted.status },
      },
    );
    return aborted;
  }

  public async createPlaybackUrl(input: {
    readonly context: MediaMutationContext;
    readonly mediaObjectId: MediaObjectId;
    readonly contentDisposition?: string | null;
  }): Promise<SignedUrl> {
    const media = await this.requireMedia(input.context, input.mediaObjectId);
    assertReadable(media);
    const signedUrl = await this.storageProvider.createSignedDownloadUrl({
      storageKey: media.storageKey,
      expiresInSeconds: DOWNLOAD_TTL_SECONDS,
      contentDisposition: input.contentDisposition ?? null,
    });
    await this.writeAudit(input.context, "media.signed_url_issued", "media_object", media.id, {
      after: {
        id: media.id,
        purpose: media.purpose,
        expiresAt: signedUrl.expiresAt,
      },
    });
    return signedUrl;
  }

  public async requestDeletion(input: {
    readonly context: MediaMutationContext;
    readonly mediaObjectId: MediaObjectId;
  }): Promise<MediaObjectRecord> {
    const media = await this.requireMedia(input.context, input.mediaObjectId);
    if (media.legalHoldActive || (await this.repository.hasActiveLegalHold(input.context.tenant))) {
      throw new MediaDomainError("Media deletion is blocked by an active legal hold.");
    }
    if (media.deletedAt !== null || media.processingStatus === "deleted") {
      return media;
    }
    const requested = await this.repository.requestDeletion({
      tenant: input.context.tenant,
      mediaObjectId: media.id,
      requestedAt: this.now(),
    });
    if (requested === null) {
      throw new MediaDomainError("Media deletion cannot be requested from its current state.");
    }
    await this.storageProvider.deleteObject(media.storageKey);
    const deleted = await this.repository.markDeleted({
      tenant: input.context.tenant,
      mediaObjectId: media.id,
      deletedAt: this.now(),
    });
    if (deleted === null) {
      throw new MediaDomainError("Media deletion could not be marked complete.");
    }
    await this.writeAudit(input.context, "media.deleted", "media_object", deleted.id, {
      before: safeMediaAudit(media),
      after: safeMediaAudit(deleted),
    });
    return deleted;
  }

  private async createSignedInstructions(
    media: MediaObjectRecord,
    uploadSession: MediaUploadSessionRecord,
  ): Promise<PreparedUpload> {
    if (uploadSession.kind === "single_part") {
      return {
        media,
        uploadSession,
        uploadUrl: await this.storageProvider.createSignedUploadUrl({
          storageKey: media.storageKey,
          mimeType: media.mimeType,
          checksumSha256: media.expectedChecksumSha256,
          expiresInSeconds: secondsUntil(uploadSession.expiresAt, this.now()),
        }),
      };
    }
    if (uploadSession.providerUploadId === null || uploadSession.expectedPartCount === null) {
      throw new MediaDomainError("Multipart upload session is missing provider metadata.");
    }
    const parts = await Promise.all(
      Array.from({ length: uploadSession.expectedPartCount }, async (_, index) => {
        const partNumber = index + 1;
        return {
          partNumber,
          uploadUrl: await this.storageProvider.createSignedPartUploadUrl({
            storageKey: media.storageKey,
            providerUploadId: uploadSession.providerUploadId ?? "",
            partNumber,
            expiresInSeconds: secondsUntil(uploadSession.expiresAt, this.now()),
          }),
        };
      }),
    );
    return { media, uploadSession, parts };
  }

  private async completeMultipart(
    media: MediaObjectRecord,
    uploadSession: { readonly id: MediaUploadSessionId; readonly providerUploadId: string | null },
    parts: readonly CompletedUploadPartInput[],
  ): Promise<void> {
    if (uploadSession.providerUploadId === null) {
      throw new MediaDomainError("Multipart upload session is missing provider upload ID.");
    }
    const normalized = normalizeCompletedParts(parts);
    await this.repository.upsertUploadParts({
      companyId: media.companyId,
      mediaObjectId: media.id,
      uploadSessionId: uploadSession.id,
      parts: normalized,
    });
    await this.storageProvider.completeMultipartUpload({
      storageKey: media.storageKey,
      providerUploadId: uploadSession.providerUploadId,
      parts: normalized.map((part) => ({
        partNumber: part.partNumber,
        etag: part.etag,
      })),
    });
  }

  private async requireMedia(
    context: MediaMutationContext,
    mediaObjectId: MediaObjectId,
  ): Promise<MediaObjectRecord> {
    const media = await this.repository.findMedia(context.tenant, mediaObjectId);
    if (media === null) {
      throw new MediaDomainError("Media object was not found for this company.");
    }
    return media;
  }

  private async requireUploadSession(
    context: MediaMutationContext,
    uploadSessionId: MediaUploadSessionId,
  ) {
    const uploadSession = await this.repository.findUploadSession(context.tenant, uploadSessionId);
    if (uploadSession === null) {
      throw new MediaDomainError("Media upload session was not found for this company.");
    }
    return uploadSession;
  }

  private async failVerification(
    context: MediaMutationContext,
    media: MediaObjectRecord,
    uploadSession: { readonly id: MediaUploadSessionId },
    failureCode: string,
  ): Promise<void> {
    await this.repository.markUploadFailed({
      tenant: context.tenant,
      mediaObjectId: media.id,
      uploadSessionId: uploadSession.id,
      failureCode,
      failureMessage: "Object storage verification failed.",
    });
  }

  private async writeAudit(
    context: MediaMutationContext,
    action: string,
    resourceType: string,
    resourceId: string,
    snapshots: { readonly before?: unknown; readonly after?: unknown },
  ): Promise<void> {
    await this.auditWriter.record({
      companyId: context.tenant.companyId,
      actor: context.actor,
      request: context.request,
      supportAccessSessionId: context.supportAccessSessionId ?? null,
      action,
      resourceType,
      resourceId,
      riskLevel: "high",
      before: snapshots.before,
      after: snapshots.after,
    });
  }
}

function getPurposePolicy(purpose: MediaPurpose): {
  readonly allowedMimeTypes: readonly string[];
  readonly maxSizeBytes: bigint;
  readonly retentionClass: MediaRetentionClass;
  readonly retentionDays: number;
  readonly dataClassification: "restricted" | "confidential";
} {
  switch (purpose) {
    case "identity_snapshot":
      return {
        allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
        maxSizeBytes: 5_000_000n,
        retentionClass: "identity_verification",
        retentionDays: 90,
        dataClassification: "restricted",
      };
    case "interview_recording":
      return {
        allowedMimeTypes: ["video/webm", "video/mp4"],
        maxSizeBytes: 2_000_000_000n,
        retentionClass: "recording",
        retentionDays: 180,
        dataClassification: "restricted",
      };
    case "report_export":
      return {
        allowedMimeTypes: ["application/pdf", "application/zip"],
        maxSizeBytes: 100_000_000n,
        retentionClass: "export",
        retentionDays: 30,
        dataClassification: "confidential",
      };
    case "general_attachment":
      return {
        allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png"],
        maxSizeBytes: 25_000_000n,
        retentionClass: "operational",
        retentionDays: 365,
        dataClassification: "confidential",
      };
  }
}

function normalizeMimeType(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/u.test(normalized)) {
    throw new MediaDomainError("Media MIME type is invalid.");
  }
  return normalized;
}

function normalizeOptionalChecksum(value: string | null): string | null {
  if (value === null || value.trim().length === 0) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/u.test(normalized)) {
    throw new MediaDomainError("Media checksum must be a SHA-256 hex digest.");
  }
  return normalized;
}

function normalizePartCount(
  kind: MediaUploadKind,
  partCount: number | null,
  sizeBytes: bigint,
): number | null {
  if (kind === "single_part") {
    return null;
  }
  const expected = Math.ceil(Number(sizeBytes) / MULTIPART_PART_SIZE_BYTES);
  const normalized = partCount ?? expected;
  if (!Number.isInteger(normalized) || normalized < 1 || normalized > 10_000) {
    throw new MediaDomainError("Multipart part count is invalid.");
  }
  return normalized;
}

function normalizeCompletedParts(
  parts: readonly CompletedUploadPartInput[],
): readonly CompletedUploadPartInput[] {
  if (parts.length === 0) {
    throw new MediaDomainError("Multipart completion requires at least one uploaded part.");
  }
  const seen = new Set<number>();
  return parts
    .map((part) => {
      if (!Number.isInteger(part.partNumber) || part.partNumber < 1 || part.partNumber > 10_000) {
        throw new MediaDomainError("Multipart part number is invalid.");
      }
      if (seen.has(part.partNumber)) {
        throw new MediaDomainError("Multipart parts cannot contain duplicates.");
      }
      seen.add(part.partNumber);
      if (part.etag.trim().length === 0 || part.etag.length > 200) {
        throw new MediaDomainError("Multipart part ETag is invalid.");
      }
      return {
        partNumber: part.partNumber,
        etag: part.etag.trim(),
        checksumSha256: normalizeOptionalChecksum(part.checksumSha256 ?? null),
        sizeBytes: part.sizeBytes ?? null,
      };
    })
    .sort((left, right) => left.partNumber - right.partNumber);
}

function normalizeKey(value: string, label: string): string {
  const normalized = value.trim();
  if (!/^[a-zA-Z0-9_.:-]{1,180}$/u.test(normalized)) {
    throw new MediaDomainError(`${label} must be a stable identifier.`);
  }
  return normalized;
}

function createStorageKey(input: {
  readonly companyId: string;
  readonly purpose: MediaPurpose;
  readonly mimeType: string;
  readonly now: Date;
}): string {
  const year = String(input.now.getUTCFullYear());
  const month = String(input.now.getUTCMonth() + 1).padStart(2, "0");
  const extension = extensionForMime(input.mimeType);
  return [
    "tenants",
    input.companyId,
    input.purpose.replaceAll("_", "-"),
    year,
    month,
    `${randomUUID()}${extension}`,
  ].join("/");
}

function extensionForMime(mimeType: string): string {
  switch (mimeType) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "video/webm":
      return ".webm";
    case "video/mp4":
      return ".mp4";
    case "application/pdf":
      return ".pdf";
    case "application/zip":
      return ".zip";
    default:
      return ".bin";
  }
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function secondsUntil(expiresAt: Date, now: Date): number {
  return Math.max(1, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
}

function assertSameUpload(
  media: MediaObjectRecord,
  uploadSession: { readonly companyId: string; readonly mediaObjectId: string },
): void {
  if (media.companyId !== uploadSession.companyId || media.id !== uploadSession.mediaObjectId) {
    throw new MediaDomainError("Media upload session does not belong to the media object.");
  }
}

function assertReadable(media: MediaObjectRecord): void {
  if (
    media.deletedAt !== null ||
    media.processingStatus === "deleted" ||
    media.uploadStatus !== "completed"
  ) {
    throw new MediaDomainError("Media object is not available for access.");
  }
}

function safeMediaAudit(media: MediaObjectRecord): Record<string, unknown> {
  return {
    id: media.id,
    companyId: media.companyId,
    ownerType: media.ownerType,
    ownerId: media.ownerId,
    purpose: media.purpose,
    storageKey: media.storageKey,
    mimeType: media.mimeType,
    uploadStatus: media.uploadStatus,
    processingStatus: media.processingStatus,
    retentionDeleteAt: media.retentionDeleteAt,
    legalHoldActive: media.legalHoldActive,
  };
}
