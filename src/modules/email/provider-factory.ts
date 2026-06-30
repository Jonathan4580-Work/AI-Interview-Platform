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

    if (input.smtpProfile === null) {
      throw new EmailDomainError("SMTP delivery requires an SMTP profile.");
    }

    return new SmtpEmailProvider(
      {
        host: input.smtpProfile.host,
        port: input.smtpProfile.port,
        secure: input.smtpProfile.secure,
        secretRef: input.smtpProfile.secretRef,
      },
      this.secretResolver,
    );
  }
}
