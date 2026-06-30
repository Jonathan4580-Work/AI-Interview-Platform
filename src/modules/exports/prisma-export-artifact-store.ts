import {
  ExportAccessEventType as PrismaExportAccessEventType,
  ExportArtifactStatus as PrismaExportArtifactStatus,
  type ExportAccessLog as PrismaExportAccessLog,
  type ExportArtifact as PrismaExportArtifact,
} from "@prisma/client";

import { prisma } from "@/infra/database";

import type {
  ExportAccessEventType,
  ExportAccessLog,
  ExportArtifact,
  ExportArtifactStatus,
  ExportArtifactStore,
} from "./types";

export class PrismaExportArtifactStore implements ExportArtifactStore {
  public async createArtifact(
    input: Parameters<ExportArtifactStore["createArtifact"]>[0],
  ): Promise<ExportArtifact> {
    const record = await prisma.exportArtifact.create({
      data: {
        companyId: input.companyId,
        exportRequestId: input.exportRequestId,
        status: PrismaExportArtifactStatus.READY,
        storageProvider: input.storageProvider,
        bucket: input.bucket,
        storageKey: input.storageKey,
        fileName: input.fileName,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        checksumSha256: input.checksumSha256,
        retentionDeleteAt: input.retentionDeleteAt,
        expiresAt: input.expiresAt,
        metadataJson: input.metadata,
      },
    });

    return mapArtifact(record);
  }

  public async findArtifact(
    input: Parameters<ExportArtifactStore["findArtifact"]>[0],
  ): Promise<ExportArtifact | null> {
    const record = await prisma.exportArtifact.findUnique({
      where: {
        companyId_id: {
          companyId: input.companyId,
          id: input.artifactId,
        },
      },
    });

    return record === null ? null : mapArtifact(record);
  }

  public async recordAccess(
    input: Parameters<ExportArtifactStore["recordAccess"]>[0],
  ): Promise<ExportAccessLog> {
    const record = await prisma.exportAccessLog.create({
      data: {
        companyId: input.companyId,
        exportRequestId: input.exportRequestId,
        exportArtifactId: input.exportArtifactId,
        actorUserId: input.actorUserId,
        eventType: toPrismaAccessEventType(input.eventType),
        requestId: input.requestId,
        correlationId: input.correlationId,
        expiresAt: input.expiresAt,
        metadataJson: input.metadata,
      },
    });

    return mapAccessLog(record);
  }
}

function mapArtifact(record: PrismaExportArtifact): ExportArtifact {
  return {
    id: record.id as ExportArtifact["id"],
    companyId: record.companyId as ExportArtifact["companyId"],
    exportRequestId: record.exportRequestId as ExportArtifact["exportRequestId"],
    status: fromPrismaArtifactStatus(record.status),
    storageProvider: record.storageProvider,
    bucket: record.bucket,
    storageKey: record.storageKey,
    fileName: record.fileName,
    contentType: record.contentType,
    sizeBytes: record.sizeBytes,
    checksumSha256: record.checksumSha256,
    retentionDeleteAt: record.retentionDeleteAt,
    expiresAt: record.expiresAt,
    legalHoldId: record.legalHoldId,
    legalHoldActive: record.legalHoldActive,
    metadata: record.metadataJson as ExportArtifact["metadata"],
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function mapAccessLog(record: PrismaExportAccessLog): ExportAccessLog {
  return {
    id: record.id,
    companyId: record.companyId as ExportAccessLog["companyId"],
    exportRequestId: record.exportRequestId as ExportAccessLog["exportRequestId"],
    exportArtifactId: record.exportArtifactId as ExportAccessLog["exportArtifactId"],
    actorUserId: record.actorUserId,
    eventType: fromPrismaAccessEventType(record.eventType),
    requestId: record.requestId,
    correlationId: record.correlationId,
    issuedAt: record.issuedAt,
    expiresAt: record.expiresAt,
    metadata: record.metadataJson as ExportAccessLog["metadata"],
  };
}

function fromPrismaArtifactStatus(status: PrismaExportArtifactStatus): ExportArtifactStatus {
  return status.toLocaleLowerCase() as ExportArtifactStatus;
}

function toPrismaAccessEventType(type: ExportAccessEventType): PrismaExportAccessEventType {
  return PrismaExportAccessEventType[
    type.toUpperCase() as keyof typeof PrismaExportAccessEventType
  ];
}

function fromPrismaAccessEventType(type: PrismaExportAccessEventType): ExportAccessEventType {
  return type.toLocaleLowerCase() as ExportAccessEventType;
}
