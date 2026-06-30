import nodemailer, { type Transporter } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

import type {
  EmailAddress,
  EmailProvider,
  EmailProviderMessage,
  EmailProviderSendResult,
  SmtpSecretResolver,
} from "./types";
import { EmailProviderError } from "./types";

export interface SmtpProviderConfig {
  readonly host: string;
  readonly port: number;
  readonly secure: boolean;
  readonly secretRef: string;
}

export class SmtpEmailProvider implements EmailProvider {
  public readonly kind = "smtp" as const;

  public constructor(
    private readonly config: SmtpProviderConfig,
    private readonly secretResolver: SmtpSecretResolver,
  ) {}

  public async send(message: EmailProviderMessage): Promise<EmailProviderSendResult> {
    const transport = await this.createTransport();

    try {
      const result: SMTPTransport.SentMessageInfo = await transport.sendMail({
        from: formatAddress(message.from),
        replyTo: message.replyTo === null ? undefined : formatAddress(message.replyTo),
        to: formatAddress(message.to),
        subject: message.subject,
        html: message.html,
        text: message.text,
        headers: message.headers,
      });

      return {
        provider: this.kind,
        providerMessageId: typeof result.messageId === "string" ? result.messageId : null,
        accepted: normalizeAddressList(result.accepted),
        rejected: normalizeAddressList(result.rejected),
        responseCode: typeof result.response === "string" ? result.response : null,
      };
    } catch (error) {
      throw normalizeSmtpError(error);
    }
  }

  public async testConnection(): Promise<void> {
    const transport = await this.createTransport();
    try {
      await transport.verify();
    } catch (error) {
      throw normalizeSmtpError(error);
    }
  }

  private async createTransport(): Promise<Transporter<SMTPTransport.SentMessageInfo>> {
    const secret = await this.secretResolver.resolve(this.config.secretRef);
    return nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth:
        secret.username === null && secret.password === null
          ? undefined
          : {
              user: secret.username ?? "",
              pass: secret.password ?? "",
            },
    });
  }
}

export class PreviewEmailProvider implements EmailProvider {
  public readonly kind = "preview" as const;

  public send(message: EmailProviderMessage): Promise<EmailProviderSendResult> {
    return Promise.resolve({
      provider: this.kind,
      providerMessageId: `preview_${hashPreviewMessage(message)}`,
      accepted: [message.to.email],
      rejected: [],
      responseCode: "preview",
    });
  }

  public testConnection(): Promise<void> {
    return Promise.resolve();
  }
}

function formatAddress(address: EmailAddress | undefined | null): string | undefined {
  if (address === undefined || address === null) {
    return undefined;
  }
  return address.name === undefined || address.name === null || address.name.trim().length === 0
    ? address.email
    : `"${address.name.replace(/"/g, "'")}" <${address.email}>`;
}

function normalizeAddressList(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function normalizeSmtpError(error: unknown): EmailProviderError {
  if (error instanceof EmailProviderError) {
    return error;
  }

  const code = readErrorCode(error);
  return new EmailProviderError({
    code,
    message: isTemporarySmtpCode(code)
      ? "SMTP provider deferred the message."
      : "SMTP provider rejected the request.",
    temporary: isTemporarySmtpCode(code),
  });
}

function readErrorCode(error: unknown): string {
  if (typeof error !== "object" || error === null) {
    return "SMTP_UNKNOWN";
  }
  const record = error as Record<string, unknown>;
  const responseCode = record.responseCode;
  if (typeof responseCode === "number") {
    return `SMTP_${String(responseCode)}`;
  }
  if (typeof record.code === "string" && record.code.trim().length > 0) {
    return record.code.trim().slice(0, 80);
  }
  return "SMTP_UNKNOWN";
}

function isTemporarySmtpCode(code: string): boolean {
  return /^SMTP_4\d\d$/u.test(code) || code === "ETIMEDOUT" || code === "ECONNECTION";
}

function hashPreviewMessage(message: EmailProviderMessage): string {
  const source = `${message.to.email}|${message.subject}|${String(message.text.length)}`;
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}
