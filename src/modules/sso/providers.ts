import type { SsoProvider } from "./types";

export interface SsoProviderMetadata {
  readonly provider: SsoProvider;
  readonly issuerUrl: string;
  readonly authorizationEndpoint: string;
  readonly tokenEndpoint: string;
  readonly jwksUri: string;
}

export interface SsoProviderAdapter {
  loadMetadata(provider: SsoProvider, issuerUrl: string): Promise<SsoProviderMetadata>;
}

export class DevelopmentSsoProviderAdapter implements SsoProviderAdapter {
  public loadMetadata(provider: SsoProvider, issuerUrl: string): Promise<SsoProviderMetadata> {
    const base = issuerUrl.replace(/\/$/, "");
    return Promise.resolve({
      provider,
      issuerUrl: base,
      authorizationEndpoint: `${base}/authorize`,
      tokenEndpoint: `${base}/token`,
      jwksUri: `${base}/.well-known/jwks.json`,
    });
  }
}
