import {
  EmailDeliveryAttemptStatus as PrismaEmailDeliveryAttemptStatus,
  EmailDeliveryStatus as PrismaEmailDeliveryStatus,
  EmailEventType as PrismaEmailEventType,
  EmailProvider as PrismaEmailProvider,
  EmailTemplateKey as PrismaEmailTemplateKey,
  EmailTemplateStatus as PrismaEmailTemplateStatus,
  SenderDomainStatus as PrismaSenderDomainStatus,
  SmtpProfileStatus as PrismaSmtpProfileStatus,
  Prisma,
  type EmailDelivery,
  type EmailDeliveryAttempt,
  type EmailSettings,
  type EmailTemplate,
  type SmtpProfile,
} from "@prisma/client";

import { prisma } from "@/infra/database";
import type { TenantContext, TenantId } from "@/modules/tenant";
import { assertTenantRecord, assertTenantRecords } from "@/shared";

import type {
  EmailDeliveryAttemptRecord,
  EmailDeliveryId,
  EmailDeliveryRecord,
  EmailDeliveryStatus,
  EmailEventType,
  EmailProviderKind,
  EmailRepository,
  EmailSettingsRecord,
  EmailTemplateKey,
  EmailTemplateRecord,
  EmailTemplateStatus,
  SenderDomainStatus,
  SmtpProfileRecord,
  SmtpProfileStatus,
} from "./types";

export class PrismaEmailRepository implements EmailRepository {
  public async findSettings(tenant: TenantContext): Promise<EmailSettingsRecord | null> {
    const record = await prisma.emailSettings.findUnique({
      where: { companyId: tenant.companyId },
    });
    const tenantRecord = assertTenantRecord(tenant, record);
    return tenantRecord === null ? null : mapEmailSettings(tenantRecord);
  }

  public async upsertSettings(
    input: Parameters<EmailRepository["upsertSettings"]>[0],
  ): Promise<EmailSettingsRecord> {
    const record = await prisma.emailSettings.upsert({
      where: { companyId: input.companyId },
      create: {
        companyId: input.companyId,
        defaultSmtpProfileId: input.defaultSmtpProfileId,
        tenantEmailDisabledAt: input.tenantEmailDisabledAt ?? null,
        disabledReason: input.disabledReason ?? null,
        metadataJson: toJsonObject(input.metadata),
      },
      update: {
        defaultSmtpProfileId: input.defaultSmtpProfileId,
        tenantEmailDisabledAt: input.tenantEmailDisabledAt ?? null,
        disabledReason: input.disabledReason ?? null,
        metadataJson: toJsonObject(input.metadata),
      },
    });
    return mapEmailSettings(record);
  }

  public async findSmtpProfile(tenant: TenantContext, id: SmtpProfileRecord["id"]) {
    const record = await prisma.smtpProfile.findFirst({
      where: { companyId: tenant.companyId, id },
    });
    if (record !== null && record.companyId !== tenant.companyId) {
      throw new Error("Cross-tenant access denied.");
    }
    return record === null ? null : mapSmtpProfile(record);
  }

  public async listSmtpProfiles(tenant: TenantContext): Promise<readonly SmtpProfileRecord[]> {
    const records = await prisma.smtpProfile.findMany({
      where: { companyId: tenant.companyId },
      orderBy: { createdAt: "desc" },
    });
    return assertTenantRecords(tenant, records as (SmtpProfile & { companyId: string })[]).map(
      mapSmtpProfile,
    );
  }

  public async upsertSmtpProfile(
    input: Parameters<EmailRepository["upsertSmtpProfile"]>[0],
  ): Promise<SmtpProfileRecord> {
    const data = {
      companyId: input.companyId,
      provider: toPrismaProvider(input.provider),
      name: input.name,
      host: input.host,
      port: input.port,
      secure: input.secure,
      fromName: input.fromName,
      fromEmail: input.fromEmail,
      normalizedFromEmail: input.normalizedFromEmail,
      replyToEmail: input.replyToEmail,
      normalizedReplyToEmail: input.normalizedReplyToEmail,
      secretRef: input.secretRef,
      status: toPrismaSmtpProfileStatus(input.status),
      domainVerificationStatus: toPrismaSenderDomainStatus(input.domainVerificationStatus),
    };
    const record =
      input.id === undefined
        ? await prisma.smtpProfile.create({ data })
        : await prisma.smtpProfile.update({
            where: { companyId_id: { companyId: input.companyId, id: input.id } },
            data,
          });
    return mapSmtpProfile(record);
  }

  public async findTemplate(
    input: Parameters<EmailRepository["findTemplate"]>[0],
  ): Promise<EmailTemplateRecord | null> {
    const records = await prisma.emailTemplate.findMany({
      where: {
        key: toPrismaTemplateKey(input.key),
        OR: [{ companyId: input.tenant.companyId }, { companyId: null }],
        status: PrismaEmailTemplateStatus.PUBLISHED,
        ...(input.version === undefined || input.version === null
          ? {}
          : { version: input.version }),
      },
      orderBy: [{ companyId: "desc" }, { version: "desc" }],
      take: 1,
    });
    if (records.length === 0) {
      return null;
    }
    return mapEmailTemplate(records[0]);
  }

  public async upsertTemplate(
    input: Parameters<EmailRepository["upsertTemplate"]>[0],
  ): Promise<EmailTemplateRecord> {
    const existing = await prisma.emailTemplate.findFirst({
      where: {
        companyId: input.companyId,
        key: toPrismaTemplateKey(input.key),
        version: input.version,
      },
    });
    const data = {
      companyId: input.companyId,
      key: toPrismaTemplateKey(input.key),
      name: input.name,
      subject: input.subject,
      htmlBody: input.htmlBody,
      textBody: input.textBody,
      schemaVersion: input.schemaVersion,
      version: input.version,
      status: toPrismaTemplateStatus(input.status),
      publishedAt: input.publishedAt ?? null,
      archivedAt: input.archivedAt ?? null,
    };
    const record =
      existing === null
        ? await prisma.emailTemplate.create({ data })
        : await prisma.emailTemplate.update({ where: { id: existing.id }, data });
    return mapEmailTemplate(record);
  }

  public async createDelivery(
    input: Parameters<EmailRepository["createDelivery"]>[0],
  ): Promise<EmailDeliveryRecord> {
    const record = await prisma.emailDelivery.create({
      data: {
        companyId: input.companyId,
        notificationIntentId: input.notificationIntentId,
        templateId: input.templateId,
        templateKey: toPrismaTemplateKey(input.templateKey),
        templateVersion: input.templateVersion,
        smtpProfileId: input.smtpProfileId,
        recipientEmail: input.recipientEmail,
        normalizedRecipientEmail: input.normalizedRecipientEmail,
        recipientName: input.recipientName,
        subject: input.subject,
        idempotencyKey: input.idempotencyKey,
        provider: toPrismaProvider(input.provider),
        metadataJson: toJsonObject(input.metadata),
      },
    });
    return mapEmailDelivery(record);
  }

  public async findDelivery(tenant: TenantContext, id: EmailDeliveryId) {
    const record = await prisma.emailDelivery.findFirst({
      where: { companyId: tenant.companyId, id },
    });
    const tenantRecord = assertTenantRecord(tenant, record);
    return tenantRecord === null ? null : mapEmailDelivery(tenantRecord);
  }

  public async findDeliveryByIdempotency(input: {
    readonly companyId: TenantId;
    readonly idempotencyKey: string;
  }): Promise<EmailDeliveryRecord | null> {
    const record = await prisma.emailDelivery.findFirst({
      where: { companyId: input.companyId, idempotencyKey: input.idempotencyKey },
    });
    return record === null ? null : mapEmailDelivery(record);
  }

  public async updateDeliveryStatus(
    input: Parameters<EmailRepository["updateDeliveryStatus"]>[0],
  ): Promise<EmailDeliveryRecord | null> {
    const data = deliveryStatusUpdateData(input);
    const result = await prisma.emailDelivery.updateMany({
      where: {
        companyId: input.companyId,
        id: input.deliveryId,
        status: { in: input.fromStatuses.map(toPrismaDeliveryStatus) },
      },
      data,
    });
    if (result.count !== 1) {
      return null;
    }
    const record = await prisma.emailDelivery.findUniqueOrThrow({
      where: { companyId_id: { companyId: input.companyId, id: input.deliveryId } },
    });
    return mapEmailDelivery(record);
  }

  public async createAttempt(
    input: Parameters<EmailRepository["createAttempt"]>[0],
  ): Promise<EmailDeliveryAttemptRecord> {
    const record = await prisma.emailDeliveryAttempt.create({
      data: {
        companyId: input.companyId,
        deliveryId: input.deliveryId,
        attemptNumber: input.attemptNumber,
        status: toPrismaAttemptStatus(input.status),
        provider: toPrismaProvider(input.provider),
        providerMessageId: input.providerMessageId,
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
        startedAt: input.startedAt,
        completedAt: input.completedAt,
        metadataJson: toJsonObject(input.metadata),
      },
    });
    return mapEmailAttempt(record);
  }

  public async countAttempts(tenant: TenantContext, deliveryId: EmailDeliveryId): Promise<number> {
    return prisma.emailDeliveryAttempt.count({
      where: { companyId: tenant.companyId, deliveryId },
    });
  }

  public async recordEvent(input: Parameters<EmailRepository["recordEvent"]>[0]): Promise<void> {
    await prisma.emailEvent.create({
      data: {
        companyId: input.companyId,
        deliveryId: input.deliveryId,
        type: toPrismaEventType(input.type),
        provider: toPrismaProvider(input.provider),
        providerMessageId: input.providerMessageId,
        reasonCode: input.reasonCode,
        reasonText: input.reasonText,
        occurredAt: input.occurredAt,
        metadataJson: toJsonObject(input.metadata),
      },
    });
  }
}

function mapEmailSettings(record: EmailSettings): EmailSettingsRecord {
  return {
    id: record.id as EmailSettingsRecord["id"],
    companyId: record.companyId as TenantId,
    defaultSmtpProfileId:
      record.defaultSmtpProfileId as EmailSettingsRecord["defaultSmtpProfileId"],
    tenantEmailDisabledAt: record.tenantEmailDisabledAt,
    disabledReason: record.disabledReason,
    metadata: readObject(record.metadataJson),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function mapSmtpProfile(record: SmtpProfile): SmtpProfileRecord {
  return {
    id: record.id as SmtpProfileRecord["id"],
    companyId: record.companyId as SmtpProfileRecord["companyId"],
    provider: fromPrismaProvider(record.provider),
    name: record.name,
    host: record.host,
    port: record.port,
    secure: record.secure,
    fromName: record.fromName,
    fromEmail: record.fromEmail,
    normalizedFromEmail: record.normalizedFromEmail,
    replyToEmail: record.replyToEmail,
    normalizedReplyToEmail: record.normalizedReplyToEmail,
    secretRef: record.secretRef,
    status: fromPrismaSmtpProfileStatus(record.status),
    domainVerificationStatus: fromPrismaSenderDomainStatus(record.domainVerificationStatus),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    archivedAt: record.archivedAt,
  };
}

function mapEmailTemplate(record: EmailTemplate): EmailTemplateRecord {
  return {
    id: record.id as EmailTemplateRecord["id"],
    companyId: record.companyId as EmailTemplateRecord["companyId"],
    key: fromPrismaTemplateKey(record.key),
    name: record.name,
    subject: record.subject,
    htmlBody: record.htmlBody,
    textBody: record.textBody,
    schemaVersion: record.schemaVersion,
    version: record.version,
    status: fromPrismaTemplateStatus(record.status),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    publishedAt: record.publishedAt,
    archivedAt: record.archivedAt,
  };
}

function mapEmailDelivery(record: EmailDelivery): EmailDeliveryRecord {
  return {
    id: record.id as EmailDeliveryRecord["id"],
    companyId: record.companyId as TenantId,
    notificationIntentId: record.notificationIntentId,
    templateId: record.templateId as EmailDeliveryRecord["templateId"],
    templateKey: fromPrismaTemplateKey(record.templateKey),
    templateVersion: record.templateVersion,
    smtpProfileId: record.smtpProfileId as EmailDeliveryRecord["smtpProfileId"],
    recipientEmail: record.recipientEmail,
    normalizedRecipientEmail: record.normalizedRecipientEmail,
    recipientName: record.recipientName,
    subject: record.subject,
    status: fromPrismaDeliveryStatus(record.status),
    idempotencyKey: record.idempotencyKey,
    provider: fromPrismaProvider(record.provider),
    providerMessageId: record.providerMessageId,
    queuedAt: record.queuedAt,
    sendingAt: record.sendingAt,
    sentAt: record.sentAt,
    deliveredAt: record.deliveredAt,
    deferredAt: record.deferredAt,
    bouncedAt: record.bouncedAt,
    complainedAt: record.complainedAt,
    failedAt: record.failedAt,
    cancelledAt: record.cancelledAt,
    errorCode: record.errorCode,
    errorMessage: record.errorMessage,
    metadata: readObject(record.metadataJson),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function mapEmailAttempt(record: EmailDeliveryAttempt): EmailDeliveryAttemptRecord {
  return {
    id: record.id as EmailDeliveryAttemptRecord["id"],
    companyId: record.companyId as TenantId,
    deliveryId: record.deliveryId as EmailDeliveryAttemptRecord["deliveryId"],
    attemptNumber: record.attemptNumber,
    status: fromPrismaAttemptStatus(record.status),
    provider: fromPrismaProvider(record.provider),
    providerMessageId: record.providerMessageId,
    errorCode: record.errorCode,
    errorMessage: record.errorMessage,
    startedAt: record.startedAt,
    completedAt: record.completedAt,
    metadata: readObject(record.metadataJson),
    createdAt: record.createdAt,
  };
}

function deliveryStatusUpdateData(
  input: Parameters<EmailRepository["updateDeliveryStatus"]>[0],
): Prisma.EmailDeliveryUpdateManyMutationInput {
  const atField = statusTimestampField(input.toStatus);
  return {
    status: toPrismaDeliveryStatus(input.toStatus),
    providerMessageId: input.providerMessageId,
    errorCode: input.errorCode,
    errorMessage: input.errorMessage,
    ...(atField === null ? {} : { [atField]: input.at }),
  };
}

function statusTimestampField(status: EmailDeliveryStatus): keyof EmailDelivery | null {
  switch (status) {
    case "queued":
      return "queuedAt";
    case "sending":
      return "sendingAt";
    case "sent":
      return "sentAt";
    case "delivered":
      return "deliveredAt";
    case "deferred":
      return "deferredAt";
    case "bounced":
      return "bouncedAt";
    case "complained":
      return "complainedAt";
    case "failed":
      return "failedAt";
    case "cancelled":
      return "cancelledAt";
    case "pending":
      return null;
  }
}

function toJsonObject(value: Record<string, unknown>): Prisma.InputJsonObject {
  return value as Prisma.InputJsonObject;
}

function readObject(value: Prisma.JsonValue): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : {};
}

function toPrismaProvider(value: EmailProviderKind): PrismaEmailProvider {
  return value === "smtp" ? PrismaEmailProvider.SMTP : PrismaEmailProvider.PREVIEW;
}

function fromPrismaProvider(value: PrismaEmailProvider): EmailProviderKind {
  return value === PrismaEmailProvider.SMTP ? "smtp" : "preview";
}

function toPrismaSmtpProfileStatus(value: SmtpProfileStatus): PrismaSmtpProfileStatus {
  return PrismaSmtpProfileStatus[value.toUpperCase() as keyof typeof PrismaSmtpProfileStatus];
}

function fromPrismaSmtpProfileStatus(value: PrismaSmtpProfileStatus): SmtpProfileStatus {
  return value.toLowerCase() as SmtpProfileStatus;
}

function toPrismaSenderDomainStatus(value: SenderDomainStatus): PrismaSenderDomainStatus {
  return PrismaSenderDomainStatus[value.toUpperCase() as keyof typeof PrismaSenderDomainStatus];
}

function fromPrismaSenderDomainStatus(value: PrismaSenderDomainStatus): SenderDomainStatus {
  return value.toLowerCase() as SenderDomainStatus;
}

function toPrismaTemplateKey(value: EmailTemplateKey): PrismaEmailTemplateKey {
  return PrismaEmailTemplateKey[value.toUpperCase() as keyof typeof PrismaEmailTemplateKey];
}

function fromPrismaTemplateKey(value: PrismaEmailTemplateKey): EmailTemplateKey {
  return value.toLowerCase() as EmailTemplateKey;
}

function toPrismaTemplateStatus(value: EmailTemplateStatus): PrismaEmailTemplateStatus {
  return PrismaEmailTemplateStatus[value.toUpperCase() as keyof typeof PrismaEmailTemplateStatus];
}

function fromPrismaTemplateStatus(value: PrismaEmailTemplateStatus): EmailTemplateStatus {
  return value.toLowerCase() as EmailTemplateStatus;
}

function toPrismaDeliveryStatus(value: EmailDeliveryStatus): PrismaEmailDeliveryStatus {
  return PrismaEmailDeliveryStatus[value.toUpperCase() as keyof typeof PrismaEmailDeliveryStatus];
}

function fromPrismaDeliveryStatus(value: PrismaEmailDeliveryStatus): EmailDeliveryStatus {
  return value.toLowerCase() as EmailDeliveryStatus;
}

function toPrismaAttemptStatus(
  value: EmailDeliveryAttemptRecord["status"],
): PrismaEmailDeliveryAttemptStatus {
  return PrismaEmailDeliveryAttemptStatus[
    value.toUpperCase() as keyof typeof PrismaEmailDeliveryAttemptStatus
  ];
}

function fromPrismaAttemptStatus(
  value: PrismaEmailDeliveryAttemptStatus,
): EmailDeliveryAttemptRecord["status"] {
  return value.toLowerCase() as EmailDeliveryAttemptRecord["status"];
}

function toPrismaEventType(value: EmailEventType): PrismaEmailEventType {
  return PrismaEmailEventType[value.toUpperCase() as keyof typeof PrismaEmailEventType];
}
