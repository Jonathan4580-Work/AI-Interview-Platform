import { prisma } from "@/infra/database";

import type {
  CompletedUploadPartInput,
  MediaObjectId,
  MediaObjectRecord,
  MediaOwnerType,
  MediaProcessingStatus,
  MediaPurpose,
  MediaRepository,
  MediaRetentionClass,
  MediaUploadKind,
  MediaUploadPartRecord,
  MediaUploadSessionId,
  MediaUploadSessionRecord,
  MediaUploadStatus,
} from "./types";
import type { MediaObject, MediaUploadPart, MediaUploadSession, Prisma } from "@prisma/client";
import type { TenantContext, TenantId } from "@/modules/tenant";

export class PrismaMediaRepository implements MediaRepository {
  public async findUploadSessionByIdempotency(input: {
    readonly companyId: TenantId;
    readonly idempotencyKey: string;
  }): Promise<{
    readonly media: MediaObjectRecord;
    readonly uploadSession: MediaUploadSessionRecord;
  } | null> {
    const session = await prisma.mediaUploadSession.findUnique({
      where: {
        companyId_idempotencyKey: {
          companyId: input.companyId,
          idempotencyKey: input.idempotencyKey,
        },
      },
      include: { mediaObject: true },
    });
    return session === null
      ? null
      : {
          media: mapMedia(session.mediaObject),
          uploadSession: mapUploadSession(session),
        };
  }

  public async createMediaWithUploadSession(input: {
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
  }> {
    const created = await prisma.$transaction(async (tx) => {
      const media = await tx.mediaObject.create({
        data: {
          companyId: input.companyId,
          ownerType: toPrismaOwnerType(input.ownerType),
          ownerId: input.ownerId,
          subjectType: toPrismaOwnerType(input.subjectType),
          subjectId: input.subjectId,
          purpose: toPrismaPurpose(input.purpose),
          storageProvider: input.storageProvider,
          bucket: input.bucket,
          region: input.region,
          storageKey: input.storageKey,
          mimeType: input.mimeType,
          expectedSizeBytes: input.expectedSizeBytes,
          expectedChecksumSha256: input.expectedChecksumSha256,
          uploadStatus: "AUTHORIZED",
          processingStatus: "PENDING",
          retentionClass: toPrismaRetentionClass(input.retentionClass),
          retentionDeleteAt: input.retentionDeleteAt,
          providerMetadataJson: {},
          metadataJson: toInputJson(input.metadata),
        },
      });
      const uploadSession = await tx.mediaUploadSession.create({
        data: {
          companyId: input.companyId,
          mediaObjectId: media.id,
          kind: toPrismaUploadKind(input.kind),
          status: "AUTHORIZED",
          providerUploadId: input.providerUploadId,
          idempotencyKey: input.idempotencyKey,
          partSizeBytes: input.partSizeBytes,
          expectedPartCount: input.expectedPartCount,
          expiresAt: input.expiresAt,
          requestId: input.requestId,
          correlationId: input.correlationId,
          providerMetadataJson: toInputJson(input.providerMetadata),
          metadataJson: {},
        },
      });
      return { media, uploadSession };
    });
    return {
      media: mapMedia(created.media),
      uploadSession: mapUploadSession(created.uploadSession),
    };
  }

  public async findMedia(
    tenant: TenantContext,
    id: MediaObjectId,
  ): Promise<MediaObjectRecord | null> {
    const record = await prisma.mediaObject.findUnique({
      where: { companyId_id: { companyId: tenant.companyId, id } },
    });
    return record === null ? null : mapMedia(record);
  }

  public async findUploadSession(
    tenant: TenantContext,
    id: MediaUploadSessionId,
  ): Promise<MediaUploadSessionRecord | null> {
    const record = await prisma.mediaUploadSession.findUnique({
      where: { companyId_id: { companyId: tenant.companyId, id } },
    });
    return record === null ? null : mapUploadSession(record);
  }

  public async listMedia(input: {
    readonly tenant: TenantContext;
    readonly purpose?: MediaPurpose;
    readonly limit: number;
    readonly cursor?: string;
  }): Promise<readonly MediaObjectRecord[]> {
    const records = await prisma.mediaObject.findMany({
      where: {
        companyId: input.tenant.companyId,
        ...(input.purpose === undefined ? {} : { purpose: toPrismaPurpose(input.purpose) }),
      },
      orderBy: { createdAt: "desc" },
      take: input.limit,
      ...(input.cursor === undefined ? {} : { cursor: { id: input.cursor }, skip: 1 }),
    });
    return records.map(mapMedia);
  }

  public async upsertUploadParts(input: {
    readonly companyId: TenantId;
    readonly mediaObjectId: MediaObjectId;
    readonly uploadSessionId: MediaUploadSessionId;
    readonly parts: readonly CompletedUploadPartInput[];
  }): Promise<readonly MediaUploadPartRecord[]> {
    await prisma.$transaction(
      input.parts.map((part) =>
        prisma.mediaUploadPart.upsert({
          where: {
            companyId_uploadSessionId_partNumber: {
              companyId: input.companyId,
              uploadSessionId: input.uploadSessionId,
              partNumber: part.partNumber,
            },
          },
          update: {
            etag: part.etag,
            checksumSha256: part.checksumSha256 ?? null,
            sizeBytes: part.sizeBytes ?? null,
            uploadedAt: new Date(),
          },
          create: {
            companyId: input.companyId,
            mediaObjectId: input.mediaObjectId,
            uploadSessionId: input.uploadSessionId,
            partNumber: part.partNumber,
            etag: part.etag,
            checksumSha256: part.checksumSha256 ?? null,
            sizeBytes: part.sizeBytes ?? null,
            uploadedAt: new Date(),
            metadataJson: {},
          },
        }),
      ),
    );
    return this.listUploadParts({ companyId: input.companyId }, input.uploadSessionId);
  }

  public async listUploadParts(
    tenant: TenantContext,
    uploadSessionId: MediaUploadSessionId,
  ): Promise<readonly MediaUploadPartRecord[]> {
    const records = await prisma.mediaUploadPart.findMany({
      where: { companyId: tenant.companyId, uploadSessionId },
      orderBy: { partNumber: "asc" },
    });
    return records.map(mapPart);
  }

  public async markUploadCompleted(input: {
    readonly tenant: TenantContext;
    readonly mediaObjectId: MediaObjectId;
    readonly uploadSessionId: MediaUploadSessionId;
    readonly sizeBytes: bigint;
    readonly checksumSha256: string | null;
    readonly providerMetadata: Record<string, unknown>;
    readonly completedAt: Date;
  }): Promise<MediaObjectRecord | null> {
    const session = await prisma.mediaUploadSession.findFirst({
      where: {
        companyId: input.tenant.companyId,
        id: input.uploadSessionId,
        mediaObjectId: input.mediaObjectId,
        status: { in: ["AUTHORIZED", "UPLOADING"] },
      },
    });
    if (session === null) {
      return null;
    }
    const updated = await prisma.$transaction(async (tx) => {
      await tx.mediaUploadSession.update({
        where: { companyId_id: { companyId: input.tenant.companyId, id: input.uploadSessionId } },
        data: { status: "COMPLETED", completedAt: input.completedAt },
      });
      return tx.mediaObject.update({
        where: { companyId_id: { companyId: input.tenant.companyId, id: input.mediaObjectId } },
        data: {
          uploadStatus: "COMPLETED",
          processingStatus: "READY",
          sizeBytes: input.sizeBytes,
          checksumSha256: input.checksumSha256,
          completedAt: input.completedAt,
          providerMetadataJson: toInputJson(input.providerMetadata),
        },
      });
    });
    return mapMedia(updated);
  }

  public async markUploadFailed(input: {
    readonly tenant: TenantContext;
    readonly mediaObjectId: MediaObjectId;
    readonly uploadSessionId: MediaUploadSessionId;
    readonly failureCode: string;
    readonly failureMessage: string;
  }): Promise<void> {
    await prisma.$transaction([
      prisma.mediaUploadSession.update({
        where: { companyId_id: { companyId: input.tenant.companyId, id: input.uploadSessionId } },
        data: {
          status: "FAILED",
          metadataJson: {
            failureCode: input.failureCode,
            failureMessage: input.failureMessage,
          },
        },
      }),
      prisma.mediaObject.update({
        where: { companyId_id: { companyId: input.tenant.companyId, id: input.mediaObjectId } },
        data: {
          uploadStatus: "FAILED",
          processingStatus: "FAILED",
          metadataJson: {
            failureCode: input.failureCode,
            failureMessage: input.failureMessage,
          },
        },
      }),
    ]);
  }

  public async abortUpload(input: {
    readonly tenant: TenantContext;
    readonly mediaObjectId: MediaObjectId;
    readonly uploadSessionId: MediaUploadSessionId;
    readonly abortedAt: Date;
  }): Promise<MediaUploadSessionRecord | null> {
    const existing = await prisma.mediaUploadSession.findFirst({
      where: {
        companyId: input.tenant.companyId,
        id: input.uploadSessionId,
        mediaObjectId: input.mediaObjectId,
        status: { in: ["AUTHORIZED", "UPLOADING"] },
      },
    });
    if (existing === null) {
      return null;
    }
    const updated = await prisma.$transaction(async (tx) => {
      const session = await tx.mediaUploadSession.update({
        where: { companyId_id: { companyId: input.tenant.companyId, id: input.uploadSessionId } },
        data: { status: "ABORTED", abortedAt: input.abortedAt },
      });
      await tx.mediaObject.update({
        where: { companyId_id: { companyId: input.tenant.companyId, id: input.mediaObjectId } },
        data: { uploadStatus: "ABORTED" },
      });
      return session;
    });
    return mapUploadSession(updated);
  }

  public async requestDeletion(input: {
    readonly tenant: TenantContext;
    readonly mediaObjectId: MediaObjectId;
    readonly requestedAt: Date;
  }): Promise<MediaObjectRecord | null> {
    const updated = await prisma.mediaObject.update({
      where: { companyId_id: { companyId: input.tenant.companyId, id: input.mediaObjectId } },
      data: { deletionRequestedAt: input.requestedAt },
    });
    return mapMedia(updated);
  }

  public async markDeleted(input: {
    readonly tenant: TenantContext;
    readonly mediaObjectId: MediaObjectId;
    readonly deletedAt: Date;
  }): Promise<MediaObjectRecord | null> {
    const updated = await prisma.mediaObject.update({
      where: { companyId_id: { companyId: input.tenant.companyId, id: input.mediaObjectId } },
      data: {
        uploadStatus: "COMPLETED",
        processingStatus: "DELETED",
        deletedAt: input.deletedAt,
      },
    });
    return mapMedia(updated);
  }

  public async hasActiveLegalHold(tenant: TenantContext): Promise<boolean> {
    const count = await prisma.legalHold.count({
      where: { companyId: tenant.companyId, status: "ACTIVE" },
    });
    return count > 0;
  }
}

function mapMedia(record: MediaObject): MediaObjectRecord {
  return {
    id: record.id as MediaObjectId,
    companyId: record.companyId as TenantId,
    ownerType: fromPrismaOwnerType(record.ownerType),
    ownerId: record.ownerId,
    subjectType: fromPrismaOwnerType(record.subjectType),
    subjectId: record.subjectId,
    purpose: fromPrismaPurpose(record.purpose),
    storageProvider: record.storageProvider,
    bucket: record.bucket,
    region: record.region,
    storageKey: record.storageKey,
    mimeType: record.mimeType,
    sizeBytes: record.sizeBytes,
    expectedSizeBytes: record.expectedSizeBytes,
    checksumSha256: record.checksumSha256,
    expectedChecksumSha256: record.expectedChecksumSha256,
    uploadStatus: fromPrismaUploadStatus(record.uploadStatus),
    processingStatus: fromPrismaProcessingStatus(record.processingStatus),
    retentionClass: fromPrismaRetentionClass(record.retentionClass),
    encryptionRef: record.encryptionRef,
    retentionDeleteAt: record.retentionDeleteAt,
    legalHoldId: record.legalHoldId,
    legalHoldActive: record.legalHoldActive,
    completedAt: record.completedAt,
    deletedAt: record.deletedAt,
    deletionRequestedAt: record.deletionRequestedAt,
    providerMetadata: asRecord(record.providerMetadataJson),
    metadata: asRecord(record.metadataJson),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function mapUploadSession(record: MediaUploadSession): MediaUploadSessionRecord {
  return {
    id: record.id as MediaUploadSessionId,
    companyId: record.companyId as TenantId,
    mediaObjectId: record.mediaObjectId as MediaObjectId,
    kind: fromPrismaUploadKind(record.kind),
    status: fromPrismaUploadStatus(record.status),
    providerUploadId: record.providerUploadId,
    idempotencyKey: record.idempotencyKey,
    partSizeBytes: record.partSizeBytes,
    expectedPartCount: record.expectedPartCount,
    expiresAt: record.expiresAt,
    completedAt: record.completedAt,
    abortedAt: record.abortedAt,
    requestId: record.requestId,
    correlationId: record.correlationId,
    providerMetadata: asRecord(record.providerMetadataJson),
    metadata: asRecord(record.metadataJson),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function mapPart(record: MediaUploadPart): MediaUploadPartRecord {
  return {
    id: record.id,
    companyId: record.companyId as TenantId,
    uploadSessionId: record.uploadSessionId as MediaUploadSessionId,
    mediaObjectId: record.mediaObjectId as MediaObjectId,
    partNumber: record.partNumber,
    etag: record.etag,
    checksumSha256: record.checksumSha256,
    sizeBytes: record.sizeBytes,
    uploadedAt: record.uploadedAt,
    metadata: asRecord(record.metadataJson),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function toPrismaOwnerType(value: MediaOwnerType): MediaObject["ownerType"] {
  return value.toUpperCase() as MediaObject["ownerType"];
}

function fromPrismaOwnerType(value: MediaObject["ownerType"]): MediaOwnerType {
  return value.toLowerCase() as MediaOwnerType;
}

function toPrismaPurpose(value: MediaPurpose): MediaObject["purpose"] {
  return value.toUpperCase() as MediaObject["purpose"];
}

function fromPrismaPurpose(value: MediaObject["purpose"]): MediaPurpose {
  return value.toLowerCase() as MediaPurpose;
}

function fromPrismaUploadStatus(value: MediaObject["uploadStatus"]): MediaUploadStatus {
  return value.toLowerCase() as MediaUploadStatus;
}

function fromPrismaProcessingStatus(value: MediaObject["processingStatus"]): MediaProcessingStatus {
  return value.toLowerCase() as MediaProcessingStatus;
}

function toPrismaRetentionClass(value: MediaRetentionClass): MediaObject["retentionClass"] {
  return value.toUpperCase() as MediaObject["retentionClass"];
}

function fromPrismaRetentionClass(value: MediaObject["retentionClass"]): MediaRetentionClass {
  return value.toLowerCase() as MediaRetentionClass;
}

function toPrismaUploadKind(value: MediaUploadKind): MediaUploadSession["kind"] {
  return value.toUpperCase() as MediaUploadSession["kind"];
}

function fromPrismaUploadKind(value: MediaUploadSession["kind"]): MediaUploadKind {
  return value.toLowerCase() as MediaUploadKind;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toInputJson(value: Record<string, unknown>): Prisma.InputJsonObject {
  return value as Prisma.InputJsonObject;
}
