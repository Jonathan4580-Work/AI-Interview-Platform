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
  applySecurityHeaders(response);

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
