import { describe, expect, it } from "vitest";

import {
  DevelopmentSsoProviderAdapter,
  SsoDomainError,
  SsoSecurityError,
  SsoTenantDiscoveryService,
  assertLocalLoginAllowed,
  assertOAuthState,
  createOAuthTransientState,
  createPkceChallenge,
  validateAccountLinking,
  validateRedirectUri,
} from "@/modules/sso";
import { toTenantId } from "@/modules/tenant";

import type {
  SsoConfigurationId,
  SsoConfigurationRecord,
  SsoConfigurationStore,
} from "@/modules/sso";

describe("SSO foundation", () => {
  it("generates OAuth state, nonce, and PKCE challenge", () => {
    const state = createOAuthTransientState(new Date("2026-07-01T00:00:00.000Z"));

    expect(state.state).toHaveLength(43);
    expect(state.nonce).toHaveLength(43);
    expect(state.codeVerifier).toHaveLength(43);
    expect(state.codeChallenge).toBe(createPkceChallenge(state.codeVerifier));
    expect(() => {
      assertOAuthState({
        expectedState: state.state,
        actualState: state.state,
        expectedNonce: state.nonce,
        actualNonce: state.nonce,
      });
    }).not.toThrow();
    expect(() => {
      assertOAuthState({
        expectedState: state.state,
        actualState: "wrong",
        expectedNonce: state.nonce,
        actualNonce: state.nonce,
      });
    }).toThrow(SsoSecurityError);
  });

  it("validates redirect URI origins without requiring real provider credentials", () => {
    expect(
      validateRedirectUri({
        redirectUri: "https://app.aptly.test/api/internal/v1/sso/callback",
        allowedOrigins: ["https://app.aptly.test"],
      }).origin,
    ).toBe("https://app.aptly.test");

    expect(() =>
      validateRedirectUri({
        redirectUri: "https://evil.example.com/callback",
        allowedOrigins: ["https://app.aptly.test"],
      }),
    ).toThrow(SsoSecurityError);
  });

  it("discovers tenant SSO by verified email domain", async () => {
    const service = new SsoTenantDiscoveryService(
      new MemorySsoStore([
        {
          id: "sso_1" as SsoConfigurationId,
          companyId,
          provider: "development_oidc",
          issuerUrl: "https://sso.example.com",
          clientId: "client",
          clientSecretRef: "secret://tenant/sso",
          redirectUri: "https://app.aptly.test/callback",
          loginPolicy: "sso_required",
          jitProvisioningEnabled: true,
          breakGlassEnabled: true,
          verifiedDomains: ["example.com"],
        },
      ]),
    );

    const config = await service.discoverByEmail(" Recruiter@Example.com ");

    expect(config?.companyId).toBe(companyId);
    expect(config?.provider).toBe("development_oidc");
  });

  it("keeps break-glass local admin access while respecting required SSO", () => {
    expect(() => {
      assertLocalLoginAllowed({
        loginPolicy: "sso_required",
        isCompanyAdmin: false,
        breakGlassEnabled: true,
      });
    }).toThrow(SsoDomainError);
    expect(() => {
      assertLocalLoginAllowed({
        loginPolicy: "sso_required",
        isCompanyAdmin: true,
        breakGlassEnabled: true,
      });
    }).not.toThrow();
  });

  it("validates safe account linking and development provider metadata", async () => {
    expect(() => {
      validateAccountLinking({
        ssoEmail: "recruiter@example.com",
        existingUserEmail: "recruiter@example.com",
        verifiedDomain: "example.com",
      });
    }).not.toThrow();
    expect(() => {
      validateAccountLinking({
        ssoEmail: "other@example.com",
        existingUserEmail: "recruiter@example.com",
        verifiedDomain: "example.com",
      });
    }).toThrow(SsoDomainError);

    const metadata = await new DevelopmentSsoProviderAdapter().loadMetadata(
      "development_oidc",
      "https://sso.example.com/",
    );

    expect(metadata.authorizationEndpoint).toBe("https://sso.example.com/authorize");
  });
});

const companyId = toTenantId("csso00001");

class MemorySsoStore implements SsoConfigurationStore {
  public constructor(private readonly configs: readonly SsoConfigurationRecord[]) {}

  public findByDomain(normalizedDomain: string): Promise<SsoConfigurationRecord | null> {
    return Promise.resolve(
      this.configs.find((config) => config.verifiedDomains.includes(normalizedDomain)) ?? null,
    );
  }
}
