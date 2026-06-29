import type { NormalizedEmail } from "./types";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string): NormalizedEmail {
  const normalized = email.trim().toLowerCase();

  if (!emailPattern.test(normalized)) {
    throw new Error("Invalid email address.");
  }

  return normalized as NormalizedEmail;
}
