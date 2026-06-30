import { createHash, randomBytes } from "node:crypto";

export interface OAuthTransientState {
  readonly state: string;
  readonly nonce: string;
  readonly codeVerifier: string;
  readonly codeChallenge: string;
  readonly createdAt: Date;
}

export class SsoSecurityError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "SsoSecurityError";
  }
}

export function createOAuthTransientState(now: Date = new Date()): OAuthTransientState {
  const codeVerifier = base64Url(randomBytes(32));
  return {
    state: base64Url(randomBytes(32)),
    nonce: base64Url(randomBytes(32)),
    codeVerifier,
    codeChallenge: createPkceChallenge(codeVerifier),
    createdAt: now,
  };
}

export function createPkceChallenge(codeVerifier: string): string {
  return base64Url(createHash("sha256").update(codeVerifier).digest());
}

export function assertOAuthState(input: {
  readonly expectedState: string;
  readonly actualState: string | null;
  readonly expectedNonce: string;
  readonly actualNonce: string | null;
}): void {
  if (input.actualState === null || input.actualState !== input.expectedState) {
    throw new SsoSecurityError("OAuth state validation failed.");
  }
  if (input.actualNonce === null || input.actualNonce !== input.expectedNonce) {
    throw new SsoSecurityError("OAuth nonce validation failed.");
  }
}

export function validateRedirectUri(input: {
  readonly redirectUri: string;
  readonly allowedOrigins: readonly string[];
}): URL {
  const parsed = new URL(input.redirectUri);
  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
    throw new SsoSecurityError("SSO redirect URI must use HTTPS except for local development.");
  }
  if (!input.allowedOrigins.includes(parsed.origin)) {
    throw new SsoSecurityError("SSO redirect URI origin is not allowed.");
  }
  return parsed;
}

function base64Url(bytes: Buffer): string {
  return bytes.toString("base64url");
}
