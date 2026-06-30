import { csrfFailed } from "./errors";

import type { NextRequest, NextResponse } from "next/server";

export const authCookieNames = {
  session: "__Host-aptly_session",
  refresh: "__Host-aptly_refresh",
  csrf: "__Host-aptly_csrf",
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
    secure: process.env.NODE_ENV === "production",
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
    secure: process.env.NODE_ENV === "production",
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
  if (cookieToken === undefined || headerToken === null || cookieToken !== headerToken) {
    throw csrfFailed();
  }
}

export function applySecurityHeaders(response: NextResponse): void {
  response.headers.set("x-content-type-options", "nosniff");
  response.headers.set("x-frame-options", "DENY");
  response.headers.set("referrer-policy", "no-referrer");
  response.headers.set(
    "permissions-policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  );
  response.headers.set(
    "content-security-policy",
    "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'",
  );

  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "strict-transport-security",
      "max-age=63072000; includeSubDomains; preload",
    );
  }
}
