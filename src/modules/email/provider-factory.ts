import { env } from "@/config";

import { PreviewEmailProvider, SmtpEmailProvider } from "./providers";
import { EnvironmentSmtpSecretResolver } from "./secret-resolver";
import { EmailDomainError, type EmailProviderFactory } from "./service";

import type { EmailProvider, SmtpProfileRecord, SmtpSecretResolver } from "./types";

export class DefaultEmailProviderFactory implements EmailProviderFactory {
  public constructor(
    private readonly secretResolver: SmtpSecretResolver = new EnvironmentSmtpSecretResolver(),
  ) {}

  public createProvider(input: {
    readonly provider: "smtp" | "preview";
    readonly smtpProfile: SmtpProfileRecord | null;
  }): EmailProvider {
    if (input.provider === "preview" || env.EMAIL_DELIVERY_MODE === "preview") {
      return new PreviewEmailProvider();
    }

    const smtpProfile = input.smtpProfile ?? createEnvironmentSmtpProfile();

    return new SmtpEmailProvider(
      {
        host: smtpProfile.host,
        port: smtpProfile.port,
        secure: smtpProfile.secure,
        secretRef: smtpProfile.secretRef,
      },
      this.secretResolver,
    );
  }
}

function createEnvironmentSmtpProfile(): SmtpProfileRecord {
  if (
    env.SMTP_HOST === undefined ||
    env.SMTP_PORT === undefined ||
    env.SMTP_FROM_EMAIL === undefined
  ) {
    throw new EmailDomainError("SMTP delivery requires SMTP environment configuration.");
  }

  const now = new Date(0);
  return {
    id: "environment-smtp" as SmtpProfileRecord["id"],
    companyId: null,
    provider: "smtp",
    name: "Environment SMTP",
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    fromName: env.SMTP_FROM_NAME,
    fromEmail: env.SMTP_FROM_EMAIL,
    normalizedFromEmail: env.SMTP_FROM_EMAIL.trim().toLowerCase(),
    replyToEmail: env.SMTP_REPLY_TO_EMAIL ?? null,
    normalizedReplyToEmail: env.SMTP_REPLY_TO_EMAIL?.trim().toLowerCase() ?? null,
    secretRef: env.SMTP_SECRET_REF,
    status: "active",
    domainVerificationStatus: "verified",
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  };
}
