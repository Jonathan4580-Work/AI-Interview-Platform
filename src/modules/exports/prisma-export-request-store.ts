import {
  ExportRequestStatus as PrismaExportRequestStatus,
  ExportRequestType as PrismaExportRequestType,
  type ExportRequest as PrismaExportRequest,
} from "@prisma/client";

import { prisma } from "@/infra/database";

import type {
  ExportRequest,
  ExportRequestStatus,
  ExportRequestStore,
  ExportRequestType,
} from "./types";

export class PrismaExportRequestStore implements ExportRequestStore {
  public async create(input: Parameters<ExportRequestStore["create"]>[0]): Promise<ExportRequest> {
    const record = await prisma.exportRequest.create({
      data: {
        companyId: input.companyId,
        requestedByUserId: input.requestedByUserId,
        type: toPrismaExportRequestType(input.type),
        resourceType: input.resourceType,
        resourceId: input.resourceId,
      },
    });

    return mapExportRequest(record);
  }
}

function mapExportRequest(record: PrismaExportRequest): ExportRequest {
  return {
    id: record.id as ExportRequest["id"],
    companyId: record.companyId as ExportRequest["companyId"],
    requestedByUserId: record.requestedByUserId as ExportRequest["requestedByUserId"],
    type: fromPrismaExportRequestType(record.type),
    status: fromPrismaExportRequestStatus(record.status),
    resourceType: record.resourceType,
    resourceId: record.resourceId,
    storageKey: record.storageKey,
    expiresAt: record.expiresAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function toPrismaExportRequestType(type: ExportRequestType): PrismaExportRequestType {
  switch (type) {
    case "candidate_report":
      return PrismaExportRequestType.CANDIDATE_REPORT;
    case "role_summary":
      return PrismaExportRequestType.ROLE_SUMMARY;
    case "audit_export":
      return PrismaExportRequestType.AUDIT_EXPORT;
    case "tenant_export":
      return PrismaExportRequestType.TENANT_EXPORT;
    case "compliance_export":
      return PrismaExportRequestType.COMPLIANCE_EXPORT;
  }
}

function fromPrismaExportRequestType(type: PrismaExportRequestType): ExportRequestType {
  switch (type) {
    case PrismaExportRequestType.CANDIDATE_REPORT:
      return "candidate_report";
    case PrismaExportRequestType.ROLE_SUMMARY:
      return "role_summary";
    case PrismaExportRequestType.AUDIT_EXPORT:
      return "audit_export";
    case PrismaExportRequestType.TENANT_EXPORT:
      return "tenant_export";
    case PrismaExportRequestType.COMPLIANCE_EXPORT:
      return "compliance_export";
  }
}

function fromPrismaExportRequestStatus(status: PrismaExportRequestStatus): ExportRequestStatus {
  switch (status) {
    case PrismaExportRequestStatus.PENDING:
      return "pending";
    case PrismaExportRequestStatus.PROCESSING:
      return "processing";
    case PrismaExportRequestStatus.READY:
      return "ready";
    case PrismaExportRequestStatus.FAILED:
      return "failed";
    case PrismaExportRequestStatus.EXPIRED:
      return "expired";
  }
}
