import { authCookieNames, csrfCookieOptions, secureCookieOptions } from "@/server/api";

import type { NextResponse } from "next/server";

const sessionMaxAgeSeconds = 60 * 60 * 8;
const refreshMaxAgeSeconds = 60 * 60 * 24 * 30;

export function setAuthCookies(
  response: NextResponse,
  tokens: {
    readonly sessionToken: string;
    readonly refreshToken: string;
    readonly csrfToken: string;
  },
): void {
  response.cookies.set(
    authCookieNames.session,
    tokens.sessionToken,
    secureCookieOptions(sessionMaxAgeSeconds),
  );
  response.cookies.set(
    authCookieNames.refresh,
    tokens.refreshToken,
    secureCookieOptions(refreshMaxAgeSeconds),
  );
  response.cookies.set(
    authCookieNames.csrf,
    tokens.csrfToken,
    csrfCookieOptions(sessionMaxAgeSeconds),
  );
}

export function clearAuthCookies(response: NextResponse): void {
  response.cookies.set(authCookieNames.session, "", { ...secureCookieOptions(0), maxAge: 0 });
  response.cookies.set(authCookieNames.refresh, "", { ...secureCookieOptions(0), maxAge: 0 });
  response.cookies.set(authCookieNames.csrf, "", { ...csrfCookieOptions(0), maxAge: 0 });
}
