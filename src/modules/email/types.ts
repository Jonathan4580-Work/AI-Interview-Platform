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
  | "password_reset";

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
