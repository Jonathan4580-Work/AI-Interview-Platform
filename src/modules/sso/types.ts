import type { TenantId } from "@/modules/tenant";
import type { Brand } from "@/shared";

export type SsoConfigurationId = Brand<string, "SsoConfigurationId">;

export const ssoProviders = [
  "google_oidc",
  "microsoft_entra_oidc",
  "development_oidc",
  "saml_placeholder",
] as const;

export type SsoProvider = (typeof ssoProviders)[number];

export const ssoLoginPolicies = ["local_allowed", "sso_optional", "sso_required"] as const;
export type SsoLoginPolicy = (typeof ssoLoginPolicies)[number];

export interface SsoConfigurationRecord {
  readonly id: SsoConfigurationId;
  readonly companyId: TenantId;
  readonly provider: SsoProvider;
  readonly issuerUrl: string;
  readonly clientId: string;
  readonly clientSecretRef: string;
  readonly redirectUri: string;
  readonly loginPolicy: SsoLoginPolicy;
  readonly jitProvisioningEnabled: boolean;
  readonly breakGlassEnabled: boolean;
  readonly verifiedDomains: readonly string[];
}

export interface SsoConfigurationStore {
  findByDomain(normalizedDomain: string): Promise<SsoConfigurationRecord | null>;
}
