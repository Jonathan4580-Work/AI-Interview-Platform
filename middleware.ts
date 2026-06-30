import { NextResponse } from "next/server";

import { env } from "@/config";
import { applySecurityHeaders } from "@/server/api";
import { createRequestContext } from "@/shared";

import type { NextRequest } from "next/server";

export function middleware(request: NextRequest): NextResponse {
  const context = createRequestContext(request.headers, {
    requestIdHeader: env.REQUEST_ID_HEADER,
    correlationIdHeader: env.CORRELATION_ID_HEADER,
  });

  if (
    request.nextUrl.pathname === "/candidate/entry" &&
    request.nextUrl.searchParams.has("token")
  ) {
    const redirectUrl = request.nextUrl.clone();
    const token = redirectUrl.searchParams.get("token") ?? "";
    redirectUrl.searchParams.delete("token");
    redirectUrl.hash = `token=${encodeURIComponent(token)}`;
    const redirect = NextResponse.redirect(redirectUrl, 303);
    redirect.headers.set(env.REQUEST_ID_HEADER, context.requestId);
    redirect.headers.set(env.CORRELATION_ID_HEADER, context.correlationId);
    redirect.headers.set("cache-control", "no-store");
    applySecurityHeaders(redirect, { allowCandidateMedia: true });
    return redirect;
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(env.REQUEST_ID_HEADER, context.requestId);
  requestHeaders.set(env.CORRELATION_ID_HEADER, context.correlationId);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set(env.REQUEST_ID_HEADER, context.requestId);
  response.headers.set(env.CORRELATION_ID_HEADER, context.correlationId);
  applySecurityHeaders(response, {
    allowCandidateMedia: request.nextUrl.pathname.startsWith("/candidate"),
  });

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
