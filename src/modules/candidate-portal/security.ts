import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import type { CandidateCsrfToken, CandidateSessionToken } from "./types";

const TOKEN_BYTES = 32;
const HASH_ENCODING = "base64url";

export function createCandidateOpaqueToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function createInvitationToken(): string {
  return createCandidateOpaqueToken();
}

export function createCandidateSessionToken(): CandidateSessionToken {
  return createCandidateOpaqueToken() as CandidateSessionToken;
}

export function createCandidateCsrfToken(): CandidateCsrfToken {
  return createCandidateOpaqueToken() as CandidateCsrfToken;
}

export function hashCandidateToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest(HASH_ENCODING);
}

export function hashIpAddress(value: string | null): string | null {
  if (value === null || value.trim().length === 0) {
    return null;
  }
  return createHash("sha256").update(value.trim(), "utf8").digest(HASH_ENCODING);
}

export function tokenHashPrefix(token: string): string {
  return hashCandidateToken(token).slice(0, 16);
}

export function isWellFormedToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{32,160}$/u.test(token);
}

export function timingSafeHashEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.byteLength !== rightBuffer.byteLength) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}
