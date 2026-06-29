import {
  PrivacyRequestStatus as PrismaPrivacyRequestStatus,
  PrivacyRequestType as PrismaPrivacyRequestType,
  type PrivacyRequest as PrismaPrivacyRequest,
} from "@prisma/client";

import { prisma } from "@/infra/database";

import type {
  PrivacyRequest,
  PrivacyRequestStatus,
  PrivacyRequestStore,
  PrivacyRequestType,
} from "./privacy-requests";

export class PrismaPrivacyRequestStore implements PrivacyRequestStore {
  public async create(
    input: Parameters<PrivacyRequestStore["create"]>[0],
  ): Promise<PrivacyRequest> {
    const record = await prisma.privacyRequest.create({
      data: {
        companyId: input.companyId,
        candidateId: input.candidateId,
        type: toPrismaPrivacyRequestType(input.type),
        requesterEmail: input.requesterEmail,
        reason: input.reason,
      },
    });

    return mapPrivacyRequest(record);
  }
}

function mapPrivacyRequest(record: PrismaPrivacyRequest): PrivacyRequest {
  return {
    id: record.id as PrivacyRequest["id"],
    companyId: record.companyId as PrivacyRequest["companyId"],
    candidateId: record.candidateId,
    type: fromPrismaPrivacyRequestType(record.type),
    status: fromPrismaPrivacyRequestStatus(record.status),
    requesterEmail: record.requesterEmail,
    reason: record.reason,
    completedAt: record.completedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function toPrismaPrivacyRequestType(type: PrivacyRequestType): PrismaPrivacyRequestType {
  switch (type) {
    case "access":
      return PrismaPrivacyRequestType.ACCESS;
    case "deletion":
      return PrismaPrivacyRequestType.DELETION;
    case "anonymization":
      return PrismaPrivacyRequestType.ANONYMIZATION;
    case "export":
      return PrismaPrivacyRequestType.EXPORT;
    case "correction":
      return PrismaPrivacyRequestType.CORRECTION;
  }
}

function fromPrismaPrivacyRequestType(type: PrismaPrivacyRequestType): PrivacyRequestType {
  switch (type) {
    case PrismaPrivacyRequestType.ACCESS:
      return "access";
    case PrismaPrivacyRequestType.DELETION:
      return "deletion";
    case PrismaPrivacyRequestType.ANONYMIZATION:
      return "anonymization";
    case PrismaPrivacyRequestType.EXPORT:
      return "export";
    case PrismaPrivacyRequestType.CORRECTION:
      return "correction";
  }
}

function fromPrismaPrivacyRequestStatus(status: PrismaPrivacyRequestStatus): PrivacyRequestStatus {
  switch (status) {
    case PrismaPrivacyRequestStatus.RECEIVED:
      return "received";
    case PrismaPrivacyRequestStatus.VERIFYING:
      return "verifying";
    case PrismaPrivacyRequestStatus.PROCESSING:
      return "processing";
    case PrismaPrivacyRequestStatus.COMPLETED:
      return "completed";
    case PrismaPrivacyRequestStatus.DENIED:
      return "denied";
  }
}
