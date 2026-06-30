import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const algorithm = "scrypt";
const version = 1;
const keyLength = 64;
const cost = 16384;
const blockSize = 8;
const parallelization = 1;
const maxPasswordLength = 1024;

export class PasswordPolicyError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "PasswordPolicyError";
  }
}

export function hashPassword(password: string): string {
  assertPasswordPolicy(password);

  const salt = randomBytes(16).toString("base64url");
  const derivedKey = deriveKey(password, salt);

  return `${algorithm}$v=${String(version)}$N=${String(cost)},r=${String(blockSize)},p=${String(parallelization)}$${salt}$${derivedKey.toString("base64url")}`;
}

export function verifyPassword(password: string, passwordHash: string): boolean {
  if (password.length > maxPasswordLength) {
    return false;
  }

  const parsed = parsePasswordHash(passwordHash);
  if (parsed === null) {
    return false;
  }

  const candidateKey = deriveKey(password, parsed.salt);
  if (candidateKey.byteLength !== parsed.key.byteLength) {
    return false;
  }

  return timingSafeEqual(candidateKey, parsed.key);
}

export function assertPasswordPolicy(password: string): void {
  if (password.length < 12) {
    throw new PasswordPolicyError("Password must be at least 12 characters.");
  }
  if (password.length > maxPasswordLength) {
    throw new PasswordPolicyError("Password is too long.");
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    throw new PasswordPolicyError(
      "Password must include lowercase, uppercase, and numeric characters.",
    );
  }
}

function deriveKey(password: string, salt: string): Buffer {
  return scryptSync(password, salt, keyLength, {
    N: cost,
    r: blockSize,
    p: parallelization,
    maxmem: 32 * 1024 * 1024,
  });
}

function parsePasswordHash(value: string): { readonly salt: string; readonly key: Buffer } | null {
  const parts = value.split("$");
  if (parts.length !== 5 || parts[0] !== algorithm || parts[1] !== `v=${String(version)}`) {
    return null;
  }
  if (parts[2] !== `N=${String(cost)},r=${String(blockSize)},p=${String(parallelization)}`) {
    return null;
  }

  const salt = parts[3];
  const encodedKey = parts[4];
  if (salt.length === 0 || encodedKey.length === 0) {
    return null;
  }

  try {
    return { salt, key: Buffer.from(encodedKey, "base64url") };
  } catch {
    return null;
  }
}
