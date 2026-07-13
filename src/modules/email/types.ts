import type { AuditRequestContext } from "@/modules/audit";
import type { CompanyActor, TenantContext, TenantId } from "@/modules/tenant";
import type { Brand } from "@/shared";

export type EmailSettingsId = Brand<string, "EmailSettingsId">;
export type SmtpProfileId = Brand<string, "SmtpProfileId">;
export type VerifiedSenderDomainId = Brand<string, "VerifiedSenderDomainId">;
export type EmailTemplateId = Brand<string, "EmailTemplateId">;
export type EmailDeliveryId = Brand<string, "EmailDeliveryId">;
export type EmailDeliveryAttemptId = Brand<string, "EmailDeliveryAttemptId">;

export type EmailProviderKind = "smtp" | "preview";
export type SmtpProfileStatus = "active" | "disabled" | "archived";
export type SenderDomainStatus = "pending" | "verified" | "failed" | "revoked";
export type EmailTemplateStatus = "draft" | "published" | "archived";
export type EmailDeliveryAttemptStatus = "sending" | "sent" | "deferred" | "failed";
export type EmailEventType = "delivered" | "deferred" | "bounced" | "complained" | "failed";

export type EmailTemplateKey =
  | "interview_invitation"
  | "interview_reminder"
  | "invitation_expired"
  | "email_verification"
  | "password_reset"
  | "application_decision";

export type EmailDeliveryStatus =
  | "pending"
  | "queued"
  | "sending"
  | "sent"
  | "delivered"
  | "deferred"
  | "bounced"
  | "complained"
  | "failed"
  | "cancelled";

export interface EmailMutationContext {
  readonly tenant: TenantContext;
  readonly actor: CompanyActor;
  readonly request: AuditRequestContext;
  readonly supportAccessSessionId?: string | null;
}

export interface EmailSettingsRecord {
  readonly id: EmailSettingsId;
  readonly companyId: TenantId;
  readonly defaultSmtpProfileId: SmtpProfileId | null;
  readonly tenantEmailDisabledAt: Date | null;
  readonly disabledReason: string | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface SmtpProfileRecord {
  readonly id: SmtpProfileId;
  readonly companyId: TenantId | null;
  readonly provider: EmailProviderKind;
  readonly name: string;
  readonly host: string;
  readonly port: number;
  readonly secure: boolean;
  readonly fromName: string;
  readonly fromEmail: string;
  readonly normalizedFromEmail: string;
  readonly replyToEmail: string | null;
  readonly normalizedReplyToEmail: string | null;
  readonly secretRef: string;
  readonly status: SmtpProfileStatus;
  readonly domainVerificationStatus: SenderDomainStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly archivedAt: Date | null;
}

export interface VerifiedSenderDomainRecord {
  readonly id: VerifiedSenderDomainId;
  readonly companyId: TenantId;
  readonly domain: string;
  readonly normalizedDomain: string;
  readonly status: SenderDomainStatus;
  readonly verificationTokenHash: string;
  readonly dnsTxtName: string;
  readonly dnsTxtValue: string;
  readonly failureReason: string | null;
  readonly verifiedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface EmailTemplateRecord {
  readonly id: EmailTemplateId;
  readonly companyId: TenantId | null;
  readonly key: EmailTemplateKey;
  readonly name: string;
  readonly subject: string;
  readonly htmlBody: string;
  readonly textBody: string;
  readonly schemaVersion: number;
  readonly version: number;
  readonly status: EmailTemplateStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly publishedAt: Date | null;
  readonly archivedAt: Date | null;
}

export interface EmailDeliveryRecord {
  readonly id: EmailDeliveryId;
  readonly companyId: TenantId;
  readonly notificationIntentId: string | null;
  readonly templateId: EmailTemplateId | null;
  readonly templateKey: EmailTemplateKey;
  readonly templateVersion: number | null;
  readonly smtpProfileId: SmtpProfileId | null;
  readonly recipientEmail: string;
  readonly normalizedRecipientEmail: string;
  readonly recipientName: string | null;
  readonly subject: string;
  readonly status: EmailDeliveryStatus;
  readonly idempotencyKey: string | null;
  readonly provider: EmailProviderKind;
  readonly providerMessageId: string | null;
  readonly queuedAt: Date | null;
  readonly sendingAt: Date | null;
  readonly sentAt: Date | null;
  readonly deliveredAt: Date | null;
  readonly deferredAt: Date | null;
  readonly bouncedAt: Date | null;
  readonly complainedAt: Date | null;
  readonly failedAt: Date | null;
  readonly cancelledAt: Date | null;
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface EmailDeliveryAttemptRecord {
  readonly id: EmailDeliveryAttemptId;
  readonly companyId: TenantId;
  readonly deliveryId: EmailDeliveryId;
  readonly attemptNumber: number;
  readonly status: EmailDeliveryAttemptStatus;
  readonly provider: EmailProviderKind;
  readonly providerMessageId: string | null;
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
  readonly startedAt: Date;
  readonly completedAt: Date | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
}

export interface RenderedEmail {
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

export interface EmailAddress {
  readonly email: string;
  readonly name?: string | null;
}

export interface EmailProviderMessage {
  readonly from: EmailAddress;
  readonly replyTo?: EmailAddress | null;
  readonly to: EmailAddress;
  readonly subject: string;
  readonly html: string;
  readonly text: string;
  readonly headers?: Readonly<Record<string, string>>;
}

export interface EmailProviderSendResult {
  readonly provider: EmailProviderKind;
  readonly providerMessageId: string | null;
  readonly accepted: readonly string[];
  readonly rejected: readonly string[];
  readonly responseCode: string | null;
}

export interface EmailProviderErrorDetails {
  readonly code: string;
  readonly message: string;
  readonly temporary: boolean;
}

export class EmailProviderError extends Error {
  public readonly details: EmailProviderErrorDetails;

  public constructor(details: EmailProviderErrorDetails) {
    super(details.message);
    this.name = "EmailProviderError";
    this.details = details;
  }
}

export interface EmailProvider {
  readonly kind: EmailProviderKind;
  send(message: EmailProviderMessage): Promise<EmailProviderSendResult>;
  testConnection(): Promise<void>;
}

export interface SmtpSecret {
  readonly username: string | null;
  readonly password: string | null;
}

export interface SmtpSecretResolver {
  resolve(secretRef: string): Promise<SmtpSecret>;
}

export interface EmailRepository {
  findSettings(tenant: TenantContext): Promise<EmailSettingsRecord | null>;
  upsertSettings(input: {
    readonly companyId: TenantId;
    readonly defaultSmtpProfileId: SmtpProfileId | null;
    readonly tenantEmailDisabledAt?: Date | null;
    readonly disabledReason?: string | null;
    readonly metadata: Record<string, unknown>;
  }): Promise<EmailSettingsRecord>;
  findSmtpProfile(tenant: TenantContext, id: SmtpProfileId): Promise<SmtpProfileRecord | null>;
  listSmtpProfiles(tenant: TenantContext): Promise<readonly SmtpProfileRecord[]>;
  upsertSmtpProfile(input: {
    readonly companyId: TenantId;
    readonly id?: SmtpProfileId;
    readonly provider: EmailProviderKind;
    readonly name: string;
    readonly host: string;
    readonly port: number;
    readonly secure: boolean;
    readonly fromName: string;
    readonly fromEmail: string;
    readonly normalizedFromEmail: string;
    readonly replyToEmail: string | null;
    readonly normalizedReplyToEmail: string | null;
    readonly secretRef: string;
    readonly status: SmtpProfileStatus;
    readonly domainVerificationStatus: SenderDomainStatus;
  }): Promise<SmtpProfileRecord>;
  findTemplate(input: {
    readonly tenant: TenantContext;
    readonly key: EmailTemplateKey;
    readonly version?: number | null;
  }): Promise<EmailTemplateRecord | null>;
  upsertTemplate(input: {
    readonly companyId: TenantId | null;
    readonly key: EmailTemplateKey;
    readonly name: string;
    readonly subject: string;
    readonly htmlBody: string;
    readonly textBody: string;
    readonly schemaVersion: number;
    readonly version: number;
    readonly status: EmailTemplateStatus;
    readonly publishedAt?: Date | null;
    readonly archivedAt?: Date | null;
  }): Promise<EmailTemplateRecord>;
  createDelivery(input: {
    readonly companyId: TenantId;
    readonly notificationIntentId: string | null;
    readonly templateId: EmailTemplateId | null;
    readonly templateKey: EmailTemplateKey;
    readonly templateVersion: number | null;
    readonly smtpProfileId: SmtpProfileId | null;
    readonly recipientEmail: string;
    readonly normalizedRecipientEmail: string;
    readonly recipientName: string | null;
    readonly subject: string;
    readonly idempotencyKey: string | null;
    readonly provider: EmailProviderKind;
    readonly metadata: Record<string, unknown>;
  }): Promise<EmailDeliveryRecord>;
  findDelivery(tenant: TenantContext, id: EmailDeliveryId): Promise<EmailDeliveryRecord | null>;
  findDeliveryByIdempotency(input: {
    readonly companyId: TenantId;
    readonly idempotencyKey: string;
  }): Promise<EmailDeliveryRecord | null>;
  updateDeliveryStatus(input: {
    readonly companyId: TenantId;
    readonly deliveryId: EmailDeliveryId;
    readonly fromStatuses: readonly EmailDeliveryStatus[];
    readonly toStatus: EmailDeliveryStatus;
    readonly providerMessageId?: string | null;
    readonly errorCode?: string | null;
    readonly errorMessage?: string | null;
    readonly at: Date;
  }): Promise<EmailDeliveryRecord | null>;
  createAttempt(input: {
    readonly companyId: TenantId;
    readonly deliveryId: EmailDeliveryId;
    readonly attemptNumber: number;
    readonly status: EmailDeliveryAttemptStatus;
    readonly provider: EmailProviderKind;
    readonly providerMessageId: string | null;
    readonly errorCode: string | null;
    readonly errorMessage: string | null;
    readonly startedAt: Date;
    readonly completedAt: Date | null;
    readonly metadata: Record<string, unknown>;
  }): Promise<EmailDeliveryAttemptRecord>;
  countAttempts(tenant: TenantContext, deliveryId: EmailDeliveryId): Promise<number>;
  recordEvent(input: {
    readonly companyId: TenantId;
    readonly deliveryId: EmailDeliveryId;
    readonly type: EmailEventType;
    readonly provider: EmailProviderKind;
    readonly providerMessageId: string | null;
    readonly reasonCode: string | null;
    readonly reasonText: string | null;
    readonly occurredAt: Date;
    readonly metadata: Record<string, unknown>;
  }): Promise<void>;
}
