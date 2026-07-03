import { NextResponse } from "next/server";

import type { CandidateCsrfToken, CandidateSessionToken } from "./types";

export const candidateCookieNames = {
  session: `${cookiePrefix()}aptly_candidate_session`,
  csrf: `${cookiePrefix()}aptly_candidate_csrf`,
} as const;

const candidateCookiePath = "/";

export function setCandidateCookies(
  response: NextResponse,
  input: {
    readonly sessionToken: CandidateSessionToken;
    readonly csrfToken: CandidateCsrfToken;
    readonly maxAgeSeconds: number;
  },
): void {
  response.cookies.set(candidateCookieNames.session, input.sessionToken, {
    httpOnly: true,
    secure: shouldUseSecureCookies(),
    sameSite: "lax",
    path: candidateCookiePath,
    maxAge: input.maxAgeSeconds,
  });
  response.cookies.set(candidateCookieNames.csrf, input.csrfToken, {
    httpOnly: false,
    secure: shouldUseSecureCookies(),
    sameSite: "lax",
    path: candidateCookiePath,
    maxAge: input.maxAgeSeconds,
  });
}

export function clearCandidateCookies(response: NextResponse): void {
  response.cookies.set(candidateCookieNames.session, "", {
    httpOnly: true,
    secure: shouldUseSecureCookies(),
    sameSite: "lax",
    path: candidateCookiePath,
    maxAge: 0,
  });
  response.cookies.set(candidateCookieNames.csrf, "", {
    httpOnly: false,
    secure: shouldUseSecureCookies(),
    sameSite: "lax",
    path: candidateCookiePath,
    maxAge: 0,
  });
}

function shouldUseSecureCookies(): boolean {
  return process.env.NODE_ENV === "production";
}

function cookiePrefix(): "" | "__Host-" {
  return shouldUseSecureCookies() ? "__Host-" : "";
}
