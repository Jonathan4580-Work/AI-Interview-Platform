import { timingSafeEqual } from "node:crypto";

import { csrfFailed } from "./errors";

import type { NextRequest, NextResponse } from "next/server";

export const authCookieNames = {
  session: `${cookiePrefix()}aptly_session`,
  refresh: `${cookiePrefix()}aptly_refresh`,
  csrf: `${cookiePrefix()}aptly_csrf`,
} as const;

const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function secureCookieOptions(maxAgeSeconds: number): {
  readonly httpOnly: true;
  readonly secure: boolean;
  readonly sameSite: "lax";
  readonly path: "/";
  readonly maxAge: number;
} {
  return {
    httpOnly: true,
    secure: shouldUseSecureCookies(),
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export function csrfCookieOptions(maxAgeSeconds: number): {
  readonly httpOnly: false;
  readonly secure: boolean;
  readonly sameSite: "lax";
  readonly path: "/";
  readonly maxAge: number;
} {
  return {
    httpOnly: false,
    secure: shouldUseSecureCookies(),
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export function assertCsrf(request: NextRequest): void {
  if (!unsafeMethods.has(request.method)) {
    return;
  }

  const cookieToken = request.cookies.get(authCookieNames.csrf)?.value;
  const headerToken = request.headers.get("x-csrf-token");
  if (
    cookieToken === undefined ||
    headerToken === null ||
    !timingSafeStringEqual(cookieToken, headerToken)
  ) {
    throw csrfFailed();
  }
}

export function applySecurityHeaders(
  response: NextResponse,
  options: { readonly allowCandidateMedia?: boolean } = {},
): void {
  response.headers.set("x-content-type-options", "nosniff");
  response.headers.set("x-frame-options", "DENY");
  response.headers.set("x-dns-prefetch-control", "off");
  response.headers.set("referrer-policy", "no-referrer");
  response.headers.set("cross-origin-opener-policy", "same-origin");
  response.headers.set("cross-origin-resource-policy", "same-origin");
  response.headers.set(
    "permissions-policy",
    options.allowCandidateMedia === true
      ? "camera=(self), microphone=(self), geolocation=(), payment=(), usb=()"
      : "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  );
  response.headers.set(
    "content-security-policy",
    createContentSecurityPolicy(options.allowCandidateMedia === true),
  );

  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "strict-transport-security",
      "max-age=63072000; includeSubDomains; preload",
    );
  }
}

export function applySensitiveNoStoreHeaders(response: NextResponse): void {
  response.headers.set("cache-control", "no-store");
  response.headers.set("pragma", "no-cache");
  response.headers.set("expires", "0");
}

function shouldUseSecureCookies(): boolean {
  return process.env.NODE_ENV === "production";
}

function cookiePrefix(): "" | "__Host-" {
  return shouldUseSecureCookies() ? "__Host-" : "";
}

function createContentSecurityPolicy(allowCandidateMedia: boolean): string {
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "connect-src 'self'",
    allowCandidateMedia ? "media-src 'self' blob:" : "media-src 'none'",
  ];

  if (process.env.NODE_ENV === "production") {
    directives.push("upgrade-insecure-requests");
  }

  return directives.join("; ");
}

function timingSafeStringEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.byteLength !== rightBuffer.byteLength) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}
