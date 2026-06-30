import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export class ScimSecurityError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ScimSecurityError";
  }
}

export function createScimBearerToken(): string {
  return `scim_${randomBytes(32).toString("base64url")}`;
}

export function hashScimBearerToken(
  token: string,
  salt: string = randomBytes(16).toString("hex"),
): string {
  if (!token.startsWith("scim_") || token.length < 40) {
    throw new ScimSecurityError("SCIM bearer token is malformed.");
  }
  const hash = scryptSync(token, salt, 32).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyScimBearerToken(token: string, storedHash: string): boolean {
  const parts = storedHash.split(":");
  if (parts.length !== 3) {
    return false;
  }
  const [algorithm, salt] = parts;
  if (algorithm !== "scrypt") {
    return false;
  }
  const actual = hashScimBearerToken(token, salt);
  return timingSafeStringEqual(actual, storedHash);
}

function timingSafeStringEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.byteLength !== rightBuffer.byteLength) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}
