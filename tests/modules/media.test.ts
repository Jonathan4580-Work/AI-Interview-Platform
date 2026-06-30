import { describe, expect, it } from "vitest";

import { AuditWriter, type AuditEventStore, type PersistedAuditEventInput } from "@/modules/audit";
import { MediaDomainError, MediaService } from "@/modules/media";
import type {
  MediaObjectId,
  MediaObjectRecord,
  MediaRepository,
  MediaUploadKind,
  MediaUploadPartRecord,
  MediaUploadSessionId,
  MediaUploadSessionRecord,
  ObjectStorageProvider,
  ObjectStorageVerification,
  SignedUrl,
} from "@/modules/media";
import type { TenantContext, TenantId } from "@/modules/tenant";

describe("media foundation", () => {
  it("prepares signed upload instructions without persisting signed URLs", async () => {
    const repo = new InMemoryMediaRepository();
    const storage = new InMemoryStorageProvider();
    const service = createService(repo, storage);

    const prepared = await service.prepareUpload({
      context,
      ownerType: "candidate_session",
      ownerId: "session_1",
      subjectType: "identity_verification",
      subjectId: "identity_1",
      purpose: "identity_snapshot",
      mimeType: "image/jpeg",
      sizeBytes: 120_000n,
      checksumSha256: checksum,
      kind: "single_part",
      idempotencyKey: "identity:session_1",
    });

    expect(prepared.uploadUrl?.url).toContain("signed-upload");
    expect(repo.media[0]?.storageKey).toContain("identity-snapshot");
    expect(repo.findPersistedText()).not.toContain("signed-upload");
  });

  it("returns the existing upload session for duplicate idempotency keys", async () => {
    const repo = new InMemoryMediaRepository();
    const storage = new InMemoryStorageProvider();
    const service = createService(repo, storage);
    const input = {
      context,
      ownerType: "candidate_session" as const,
      ownerId: "session_1",
      subjectType: "identity_verification" as const,
      subjectId: "identity_1",
      purpose: "identity_snapshot" as const,
      mimeType: "image/jpeg",
      sizeBytes: 120_000n,
      checksumSha256: checksum,
      kind: "single_part" as const,
      idempotencyKey: "identity:dedupe",
    };

    const first = await service.prepareUpload(input);
    const second = await service.prepareUpload(input);

    expect(second.media.id).toBe(first.media.id);
    expect(repo.media).toHaveLength(1);
  });

  it("rejects MIME and size values outside the media purpose policy", async () => {
    const service = createService(new InMemoryMediaRepository(), new InMemoryStorageProvider());

    await expect(
      service.prepareUpload({
        context,
        ownerType: "candidate_session",
        ownerId: "session_1",
        subjectType: "identity_verification",
        subjectId: "identity_1",
        purpose: "identity_snapshot",
        mimeType: "video/webm",
        sizeBytes: 120_000n,
        kind: "single_part",
        idempotencyKey: "identity:bad-mime",
      }),
    ).rejects.toThrow(MediaDomainError);

    await expect(
      service.prepareUpload({
        context,
        ownerType: "candidate_session",
        ownerId: "session_1",
        subjectType: "identity_verification",
        subjectId: "identity_1",
        purpose: "identity_snapshot",
        mimeType: "image/jpeg",
        sizeBytes: 6_000_000n,
        kind: "single_part",
        idempotencyKey: "identity:too-large",
      }),
    ).rejects.toThrow(MediaDomainError);
  });

  it("completes multipart uploads only after provider verification", async () => {
    const repo = new InMemoryMediaRepository();
    const storage = new InMemoryStorageProvider();
    const service = createService(repo, storage);
    const prepared = await service.prepareUpload({
      context,
      ownerType: "candidate_session",
      ownerId: "session_1",
      subjectType: "interview_session",
      subjectId: "interview_1",
      purpose: "interview_recording",
      mimeType: "video/webm",
      sizeBytes: 32_000_000n,
      checksumSha256: checksum,
      kind: "multipart",
      partCount: 2,
      idempotencyKey: "recording:1",
    });
    storage.verification = {
      exists: true,
      sizeBytes: 32_000_000n,
      mimeType: "video/webm",
      checksumSha256: checksum,
      providerMetadata: { etag: "complete" },
    };

    const completed = await service.completeUpload({
      context,
      mediaObjectId: prepared.media.id,
      uploadSessionId: prepared.uploadSession.id,
      parts: [
        { partNumber: 1, etag: "etag-1", sizeBytes: 16_000_000n },
        { partNumber: 2, etag: "etag-2", sizeBytes: 16_000_000n },
      ],
    });

    expect(completed.uploadStatus).toBe("completed");
    expect(completed.processingStatus).toBe("ready");
    expect(storage.completedMultipart).toEqual([
      { partNumber: 1, etag: "etag-1" },
      { partNumber: 2, etag: "etag-2" },
    ]);
  });

  it("rejects object verification mismatches", async () => {
    const repo = new InMemoryMediaRepository();
    const storage = new InMemoryStorageProvider();
    const service = createService(repo, storage);
    const prepared = await service.prepareUpload({
      context,
      ownerType: "candidate_session",
      ownerId: "session_1",
      subjectType: "identity_verification",
      subjectId: "identity_1",
      purpose: "identity_snapshot",
      mimeType: "image/jpeg",
      sizeBytes: 120_000n,
      checksumSha256: checksum,
      kind: "single_part",
      idempotencyKey: "identity:mismatch",
    });
    storage.verification = {
      exists: true,
      sizeBytes: 1n,
      mimeType: "image/jpeg",
      checksumSha256: checksum,
      providerMetadata: {},
    };

    await expect(
      service.completeUpload({
        context,
        mediaObjectId: prepared.media.id,
        uploadSessionId: prepared.uploadSession.id,
      }),
    ).rejects.toThrow(MediaDomainError);
    expect(repo.media[0]?.uploadStatus).toBe("failed");
  });

  it("blocks deletion while a legal hold is active", async () => {
    const repo = new InMemoryMediaRepository();
    const storage = new InMemoryStorageProvider();
    const service = createService(repo, storage);
    const media = repo.seedMedia({ uploadStatus: "completed", processingStatus: "ready" });
    repo.activeLegalHold = true;

    await expect(
      service.requestDeletion({
        context,
        mediaObjectId: media.id,
      }),
    ).rejects.toThrow("legal hold");
    expect(storage.deletedKeys).toEqual([]);
  });

  it("audits signed playback URL issuance without storing the URL", async () => {
    const repo = new InMemoryMediaRepository();
    const audit = new InMemoryAuditStore();
    const storage = new InMemoryStorageProvider();
    const service = createService(repo, storage, audit);
    const media = repo.seedMedia({ uploadStatus: "completed", processingStatus: "ready" });

    const signed = await service.createPlaybackUrl({ context, mediaObjectId: media.id });

    expect(signed.url).toContain("signed-download");
    expect(repo.findPersistedText()).not.toContain("signed-download");
    expect(audit.events.at(-1)?.action).toBe("media.signed_url_issued");
  });
});

const tenant: TenantContext = { companyId: "company_test" as TenantId };
const checksum = "a".repeat(64);
const context = {
  tenant,
  actor: { type: "user" as const, id: "user_1" },
  request: {
    requestId: "req_1",
    correlationId: "corr_1",
    sessionId: "session_1",
    ipAddress: "127.0.0.1",
    userAgent: "vitest",
  },
};

function createService(
  repo: InMemoryMediaRepository,
  storage: InMemoryStorageProvider,
  audit = new InMemoryAuditStore(),
) {
  return new MediaService(
    repo,
    storage,
    new AuditWriter(audit),
    () => new Date("2026-06-30T00:00:00.000Z"),
  );
}

class InMemoryAuditStore implements AuditEventStore {
  public readonly events: PersistedAuditEventInput[] = [];

  public append(event: PersistedAuditEventInput): Promise<void> {
    this.events.push(event);
    return Promise.resolve();
  }
}

class InMemoryStorageProvider implements ObjectStorageProvider {
  public readonly providerKey = "minio";
  public readonly bucket = "aptly-media-test";
  public readonly region = "us-east-1";
  public completedMultipart: readonly { readonly partNumber: number; readonly etag: string }[] = [];
  public deletedKeys: string[] = [];
  public verification: ObjectStorageVerification = {
    exists: true,
    sizeBytes: 120_000n,
    mimeType: "image/jpeg",
    checksumSha256: checksum,
    providerMetadata: {},
  };

  public createSignedUploadUrl(): Promise<SignedUrl> {
    return Promise.resolve(signedUrl("signed-upload"));
  }

  public createMultipartUpload(): Promise<{
    readonly providerUploadId: string;
    readonly metadata: Record<string, unknown>;
  }> {
    return Promise.resolve({
      providerUploadId: "upload_1",
      metadata: { provider: "minio" },
    });
  }

  public createSignedPartUploadUrl(input: { readonly partNumber: number }): Promise<SignedUrl> {
    return Promise.resolve(signedUrl(`signed-part-${String(input.partNumber)}`));
  }

  public completeMultipartUpload(input: {
    readonly parts: readonly { readonly partNumber: number; readonly etag: string }[];
  }): Promise<Record<string, unknown>> {
    this.completedMultipart = input.parts;
    return Promise.resolve({ etag: "complete" });
  }

  public abortMultipartUpload(): Promise<void> {
    return Promise.resolve();
  }

  public verifyObject(): Promise<ObjectStorageVerification> {
    return Promise.resolve(this.verification);
  }

  public createSignedDownloadUrl(): Promise<SignedUrl> {
    return Promise.resolve(signedUrl("signed-download"));
  }

  public deleteObject(storageKey: string): Promise<void> {
    this.deletedKeys.push(storageKey);
    return Promise.resolve();
  }
}

class InMemoryMediaRepository implements MediaRepository {
  public readonly media: MediaObjectRecord[] = [];
  public readonly uploadSessions: MediaUploadSessionRecord[] = [];
  public readonly parts: MediaUploadPartRecord[] = [];
  public activeLegalHold = false;

  public findUploadSessionByIdempotency(input: {
    readonly companyId: TenantId;
    readonly idempotencyKey: string;
  }): Promise<{
    readonly media: MediaObjectRecord;
    readonly uploadSession: MediaUploadSessionRecord;
  } | null> {
    const uploadSession = this.uploadSessions.find(
      (candidate) =>
        candidate.companyId === input.companyId &&
        candidate.idempotencyKey === input.idempotencyKey,
    );
    const media =
      uploadSession === undefined
        ? undefined
        : this.media.find((candidate) => candidate.id === uploadSession.mediaObjectId);
    return Promise.resolve(
      uploadSession === undefined || media === undefined ? null : { media, uploadSession },
    );
  }

  public createMediaWithUploadSession(
    input: Parameters<MediaRepository["createMediaWithUploadSession"]>[0],
  ): Promise<{
    readonly media: MediaObjectRecord;
    readonly uploadSession: MediaUploadSessionRecord;
  }> {
    const media = this.seedMedia({
      ownerType: input.ownerType,
      ownerId: input.ownerId,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      purpose: input.purpose,
      storageProvider: input.storageProvider,
      bucket: input.bucket,
      region: input.region,
      storageKey: input.storageKey,
      mimeType: input.mimeType,
      expectedSizeBytes: input.expectedSizeBytes,
      expectedChecksumSha256: input.expectedChecksumSha256,
      retentionClass: input.retentionClass,
      retentionDeleteAt: input.retentionDeleteAt,
      metadata: input.metadata,
    });
    const uploadSession = createUploadSession({
      id: `upload_${String(this.uploadSessions.length + 1)}` as MediaUploadSessionId,
      companyId: input.companyId,
      mediaObjectId: media.id,
      kind: input.kind,
      providerUploadId: input.providerUploadId,
      idempotencyKey: input.idempotencyKey,
      partSizeBytes: input.partSizeBytes,
      expectedPartCount: input.expectedPartCount,
      expiresAt: input.expiresAt,
      requestId: input.requestId,
      correlationId: input.correlationId,
      providerMetadata: input.providerMetadata,
    });
    this.uploadSessions.push(uploadSession);
    return Promise.resolve({ media, uploadSession });
  }

  public findMedia(_tenant: TenantContext, id: MediaObjectId): Promise<MediaObjectRecord | null> {
    return Promise.resolve(this.media.find((candidate) => candidate.id === id) ?? null);
  }

  public findUploadSession(
    _tenant: TenantContext,
    id: MediaUploadSessionId,
  ): Promise<MediaUploadSessionRecord | null> {
    return Promise.resolve(this.uploadSessions.find((candidate) => candidate.id === id) ?? null);
  }

  public listMedia(): Promise<readonly MediaObjectRecord[]> {
    return Promise.resolve(this.media);
  }

  public upsertUploadParts(
    input: Parameters<MediaRepository["upsertUploadParts"]>[0],
  ): Promise<readonly MediaUploadPartRecord[]> {
    const now = new Date("2026-06-30T00:00:00.000Z");
    for (const part of input.parts) {
      this.parts.push({
        id: `part_${String(this.parts.length + 1)}`,
        companyId: input.companyId,
        mediaObjectId: input.mediaObjectId,
        uploadSessionId: input.uploadSessionId,
        partNumber: part.partNumber,
        etag: part.etag,
        checksumSha256: part.checksumSha256 ?? null,
        sizeBytes: part.sizeBytes ?? null,
        uploadedAt: now,
        metadata: {},
        createdAt: now,
        updatedAt: now,
      });
    }
    return Promise.resolve(this.parts);
  }

  public listUploadParts(): Promise<readonly MediaUploadPartRecord[]> {
    return Promise.resolve(this.parts);
  }

  public markUploadCompleted(
    input: Parameters<MediaRepository["markUploadCompleted"]>[0],
  ): Promise<MediaObjectRecord | null> {
    const index = this.media.findIndex((candidate) => candidate.id === input.mediaObjectId);
    const sessionIndex = this.uploadSessions.findIndex(
      (candidate) => candidate.id === input.uploadSessionId,
    );
    if (index < 0 || sessionIndex < 0) return Promise.resolve(null);
    this.uploadSessions[sessionIndex] = {
      ...this.uploadSessions[sessionIndex],
      status: "completed",
      completedAt: input.completedAt,
    };
    const updated = {
      ...this.media[index],
      uploadStatus: "completed",
      processingStatus: "ready",
      sizeBytes: input.sizeBytes,
      checksumSha256: input.checksumSha256,
      providerMetadata: input.providerMetadata,
      completedAt: input.completedAt,
    } as MediaObjectRecord;
    this.media[index] = updated;
    return Promise.resolve(updated);
  }

  public markUploadFailed(
    input: Parameters<MediaRepository["markUploadFailed"]>[0],
  ): Promise<void> {
    const index = this.media.findIndex((candidate) => candidate.id === input.mediaObjectId);
    if (index >= 0) {
      this.media[index] = {
        ...this.media[index],
        uploadStatus: "failed",
        processingStatus: "failed",
      };
    }
    return Promise.resolve();
  }

  public abortUpload(
    input: Parameters<MediaRepository["abortUpload"]>[0],
  ): Promise<MediaUploadSessionRecord | null> {
    const index = this.uploadSessions.findIndex(
      (candidate) => candidate.id === input.uploadSessionId,
    );
    if (index < 0) return Promise.resolve(null);
    const updated = {
      ...this.uploadSessions[index],
      status: "aborted",
      abortedAt: input.abortedAt,
    } as MediaUploadSessionRecord;
    this.uploadSessions[index] = updated;
    return Promise.resolve(updated);
  }

  public requestDeletion(
    input: Parameters<MediaRepository["requestDeletion"]>[0],
  ): Promise<MediaObjectRecord | null> {
    const index = this.media.findIndex((candidate) => candidate.id === input.mediaObjectId);
    if (index < 0) return Promise.resolve(null);
    const updated = {
      ...this.media[index],
      deletionRequestedAt: input.requestedAt,
    } as MediaObjectRecord;
    this.media[index] = updated;
    return Promise.resolve(updated);
  }

  public markDeleted(
    input: Parameters<MediaRepository["markDeleted"]>[0],
  ): Promise<MediaObjectRecord | null> {
    const index = this.media.findIndex((candidate) => candidate.id === input.mediaObjectId);
    if (index < 0) return Promise.resolve(null);
    const updated = {
      ...this.media[index],
      processingStatus: "deleted",
      deletedAt: input.deletedAt,
    } as MediaObjectRecord;
    this.media[index] = updated;
    return Promise.resolve(updated);
  }

  public hasActiveLegalHold(): Promise<boolean> {
    return Promise.resolve(this.activeLegalHold);
  }

  public seedMedia(overrides: Partial<MediaObjectRecord> = {}): MediaObjectRecord {
    const media = createMediaRecord({
      id: `media_${String(this.media.length + 1)}` as MediaObjectId,
      companyId: tenant.companyId,
      ...overrides,
    });
    this.media.push(media);
    return media;
  }

  public findPersistedText(): string {
    return JSON.stringify({
      media: this.media.map((record) => ({
        storageKey: record.storageKey,
        providerMetadata: record.providerMetadata,
        metadata: record.metadata,
      })),
      uploadSessions: this.uploadSessions.map((record) => ({
        providerUploadId: record.providerUploadId,
        providerMetadata: record.providerMetadata,
        metadata: record.metadata,
      })),
    });
  }
}

function signedUrl(label: string): SignedUrl {
  return {
    url: `https://storage.example.test/${label}`,
    expiresAt: new Date("2026-06-30T00:10:00.000Z"),
    headers: {},
  };
}

function createMediaRecord(
  overrides: Partial<MediaObjectRecord> & {
    readonly id: MediaObjectId;
    readonly companyId: TenantId;
  },
): MediaObjectRecord {
  const now = new Date("2026-06-30T00:00:00.000Z");
  return {
    id: overrides.id,
    companyId: overrides.companyId,
    ownerType: overrides.ownerType ?? "candidate_session",
    ownerId: overrides.ownerId ?? "session_1",
    subjectType: overrides.subjectType ?? "identity_verification",
    subjectId: overrides.subjectId ?? "identity_1",
    purpose: overrides.purpose ?? "identity_snapshot",
    storageProvider: overrides.storageProvider ?? "minio",
    bucket: overrides.bucket ?? "aptly-media-test",
    region: overrides.region ?? "us-east-1",
    storageKey: overrides.storageKey ?? "tenants/company_test/identity-snapshot/object.jpg",
    mimeType: overrides.mimeType ?? "image/jpeg",
    sizeBytes: overrides.sizeBytes ?? null,
    expectedSizeBytes: overrides.expectedSizeBytes ?? 120_000n,
    checksumSha256: overrides.checksumSha256 ?? null,
    expectedChecksumSha256: overrides.expectedChecksumSha256 ?? checksum,
    uploadStatus: overrides.uploadStatus ?? "authorized",
    processingStatus: overrides.processingStatus ?? "pending",
    retentionClass: overrides.retentionClass ?? "identity_verification",
    encryptionRef: overrides.encryptionRef ?? null,
    retentionDeleteAt: overrides.retentionDeleteAt ?? new Date("2026-09-28T00:00:00.000Z"),
    legalHoldId: overrides.legalHoldId ?? null,
    legalHoldActive: overrides.legalHoldActive ?? false,
    completedAt: overrides.completedAt ?? null,
    deletedAt: overrides.deletedAt ?? null,
    deletionRequestedAt: overrides.deletionRequestedAt ?? null,
    providerMetadata: overrides.providerMetadata ?? {},
    metadata: overrides.metadata ?? {},
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

function createUploadSession(
  input: Partial<MediaUploadSessionRecord> & {
    readonly id: MediaUploadSessionId;
    readonly companyId: TenantId;
    readonly mediaObjectId: MediaObjectId;
    readonly kind: MediaUploadKind;
    readonly idempotencyKey: string;
  },
): MediaUploadSessionRecord {
  const now = new Date("2026-06-30T00:00:00.000Z");
  return {
    id: input.id,
    companyId: input.companyId,
    mediaObjectId: input.mediaObjectId,
    kind: input.kind,
    status: input.status ?? "authorized",
    providerUploadId: input.providerUploadId ?? null,
    idempotencyKey: input.idempotencyKey,
    partSizeBytes: input.partSizeBytes ?? null,
    expectedPartCount: input.expectedPartCount ?? null,
    expiresAt: input.expiresAt ?? new Date("2026-06-30T01:00:00.000Z"),
    completedAt: input.completedAt ?? null,
    abortedAt: input.abortedAt ?? null,
    requestId: input.requestId ?? "req_1",
    correlationId: input.correlationId ?? "corr_1",
    providerMetadata: input.providerMetadata ?? {},
    metadata: input.metadata ?? {},
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  };
}
