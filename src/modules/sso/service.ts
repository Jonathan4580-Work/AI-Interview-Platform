import { normalizeEmail } from "@/modules/identity";

import type { SsoConfigurationRecord, SsoConfigurationStore } from "./types";

export class SsoDomainError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "SsoDomainError";
  }
}

export class SsoTenantDiscoveryService {
  public constructor(private readonly store: SsoConfigurationStore) {}

  public async discoverByEmail(email: string): Promise<SsoConfigurationRecord | null> {
    const normalized = normalizeEmail(email);
    const atIndex = normalized.lastIndexOf("@");
    if (atIndex < 0 || atIndex === normalized.length - 1) {
      throw new SsoDomainError("Email address domain is required for SSO discovery.");
    }
    const domain = normalized.slice(atIndex + 1);
    return this.store.findByDomain(domain);
  }
}

export function assertLocalLoginAllowed(input: {
  readonly loginPolicy: SsoConfigurationRecord["loginPolicy"];
  readonly isCompanyAdmin: boolean;
  readonly breakGlassEnabled: boolean;
}): void {
  if (input.loginPolicy !== "sso_required") {
    return;
  }
  if (input.isCompanyAdmin && input.breakGlassEnabled) {
    return;
  }
  throw new SsoDomainError("Local authentication is disabled by tenant SSO policy.");
}

export function validateAccountLinking(input: {
  readonly ssoEmail: string;
  readonly existingUserEmail: string;
  readonly verifiedDomain: string;
}): void {
  const ssoEmail = normalizeEmail(input.ssoEmail);
  const existingUserEmail = normalizeEmail(input.existingUserEmail);
  if (ssoEmail !== existingUserEmail) {
    throw new SsoDomainError("SSO account linking requires an exact email match.");
  }
  if (!ssoEmail.endsWith(`@${input.verifiedDomain.toLowerCase()}`)) {
    throw new SsoDomainError("SSO account email is not in a verified tenant domain.");
  }
}
