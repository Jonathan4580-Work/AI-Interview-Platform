import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { env } from "@/config/env";

const TOKEN_VERSION = "av1";

export interface AvailabilityTokenInput {
  readonly requestId: string;
  readonly companyId: string;
  readonly applicationId: string;
  readonly tokenSalt: string;
}

export function createAvailabilityRequestToken(input: AvailabilityTokenInput): string {
  const signature = createHmac("sha256", tokenSecret())
    .update(`${input.requestId}:${input.companyId}:${input.applicationId}:${input.tokenSalt}`)
    .digest("base64url");
  return `${TOKEN_VERSION}.${input.requestId}.${signature}`;
}

export function parseAvailabilityRequestToken(
  token: string,
): { readonly requestId: string } | null {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== TOKEN_VERSION || parts[1].length === 0) {
    return null;
  }
  return { requestId: parts[1] };
}

export function hashAvailabilityRequestToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function verifyAvailabilityRequestToken(input: {
  readonly token: string;
  readonly expectedHash: string;
  readonly request: AvailabilityTokenInput;
}): boolean {
  const expectedToken = createAvailabilityRequestToken(input.request);
  const actualHash = Buffer.from(hashAvailabilityRequestToken(input.token), "hex");
  const expectedHash = Buffer.from(input.expectedHash, "hex");
  if (actualHash.length !== expectedHash.length) return false;
  const hashMatches = timingSafeEqual(actualHash, expectedHash);
  const tokenMatches = input.token === expectedToken;
  return hashMatches && tokenMatches;
}

export function createAvailabilityRequestUrl(token: string): string {
  const base = env.CANDIDATE_APP_URL ?? env.APP_URL;
  return `${base.replace(/\/$/u, "")}/candidate/availability/${encodeURIComponent(token)}`;
}

function tokenSecret(): string {
  return (
    env.TOKEN_PEPPER_SECRET_REF ??
    env.SESSION_SECRET_REF ??
    "development-availability-request-token-secret"
  );
}
