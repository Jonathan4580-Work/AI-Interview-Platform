import type { SmtpSecret, SmtpSecretResolver } from "./types";

export class SmtpSecretResolutionError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "SmtpSecretResolutionError";
  }
}

export class EnvironmentSmtpSecretResolver implements SmtpSecretResolver {
  public constructor(private readonly source: NodeJS.ProcessEnv = process.env) {}

  public resolve(secretRef: string): Promise<SmtpSecret> {
    const expectedRef = this.source.SMTP_SECRET_REF;
    if (expectedRef !== undefined && secretRef !== expectedRef) {
      const scoped = this.resolveScopedSecret(secretRef);
      if (scoped !== null) {
        return Promise.resolve(scoped);
      }
      return Promise.reject(
        new SmtpSecretResolutionError("SMTP secret reference is not available."),
      );
    }

    return Promise.resolve({
      username: normalizeOptionalSecret(this.source.SMTP_USERNAME),
      password: this.source.SMTP_PASSWORD ?? null,
    });
  }

  private resolveScopedSecret(secretRef: string): SmtpSecret | null {
    const key = secretRef.toUpperCase().replace(/[^A-Z0-9]/g, "_");
    const username = this.source[`SMTP_SECRET_${key}_USERNAME`];
    const password = this.source[`SMTP_SECRET_${key}_PASSWORD`];
    if (username === undefined && password === undefined) {
      return null;
    }

    return {
      username: normalizeOptionalSecret(username),
      password: password ?? null,
    };
  }
}

function normalizeOptionalSecret(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}
