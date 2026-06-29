import {
  SupportAccessStatus as PrismaSupportAccessStatus,
  type SupportAccessSession as PrismaSupportAccessSession,
} from "@prisma/client";

import { prisma } from "@/infra/database";
import { assertTenantRecords } from "@/shared/repositories";

import type { TenantContext } from "@/modules/tenant";
import type {
  SupportAccessReasonCode,
  SupportAccessSession,
  SupportAccessSessionId,
  SupportAccessSessionStore,
  SupportAccessStatus,
} from "./types";

export class PrismaSupportAccessSessionStore implements SupportAccessSessionStore {
  public async createActive(
    input: Parameters<SupportAccessSessionStore["createActive"]>[0],
  ): Promise<SupportAccessSession> {
    const record = await prisma.supportAccessSession.create({
      data: {
        companyId: input.companyId,
        platformUserId: input.platformUserId,
        approvedByPlatformUserId: input.approvedByPlatformUserId,
        status: PrismaSupportAccessStatus.ACTIVE,
        reasonCode: input.reasonCode,
        reasonText: input.reasonText,
        startedAt: input.startedAt,
        expiresAt: input.expiresAt,
      },
    });

    return mapSupportAccessSession(record);
  }

  public async findById(id: SupportAccessSessionId): Promise<SupportAccessSession | null> {
    const record = await prisma.supportAccessSession.findUnique({
      where: { id },
    });

    return record === null ? null : mapSupportAccessSession(record);
  }

  public async end(
    input: Parameters<SupportAccessSessionStore["end"]>[0],
  ): Promise<SupportAccessSession> {
    const record = await prisma.supportAccessSession.update({
      where: { id: input.id },
      data: {
        status: toPrismaSupportAccessStatus(input.status),
        endedAt: input.endedAt,
      },
    });

    return mapSupportAccessSession(record);
  }

  public async listForCompany(tenant: TenantContext): Promise<readonly SupportAccessSession[]> {
    const records = await prisma.supportAccessSession.findMany({
      where: {
        companyId: tenant.companyId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return assertTenantRecords(tenant, records).map(mapSupportAccessSession);
  }
}

function mapSupportAccessSession(record: PrismaSupportAccessSession): SupportAccessSession {
  return {
    id: record.id as SupportAccessSession["id"],
    companyId: record.companyId as SupportAccessSession["companyId"],
    platformUserId: record.platformUserId as SupportAccessSession["platformUserId"],
    status: fromPrismaSupportAccessStatus(record.status),
    reasonCode: record.reasonCode as SupportAccessReasonCode,
    reasonText: record.reasonText,
    approvedByPlatformUserId:
      record.approvedByPlatformUserId as SupportAccessSession["approvedByPlatformUserId"],
    startedAt: record.startedAt,
    expiresAt: record.expiresAt,
    endedAt: record.endedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function fromPrismaSupportAccessStatus(
  status: PrismaSupportAccessStatus,
): SupportAccessStatus {
  switch (status) {
    case PrismaSupportAccessStatus.REQUESTED:
      return "requested";
    case PrismaSupportAccessStatus.ACTIVE:
      return "active";
    case PrismaSupportAccessStatus.EXPIRED:
      return "expired";
    case PrismaSupportAccessStatus.REVOKED:
      return "revoked";
    case PrismaSupportAccessStatus.DENIED:
      return "denied";
  }
}

function toPrismaSupportAccessStatus(
  status: Extract<SupportAccessStatus, "expired" | "revoked">,
): PrismaSupportAccessStatus {
  switch (status) {
    case "expired":
      return PrismaSupportAccessStatus.EXPIRED;
    case "revoked":
      return PrismaSupportAccessStatus.REVOKED;
  }
}
