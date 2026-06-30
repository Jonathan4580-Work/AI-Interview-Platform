import { env } from "@/config";
import { createRequestContext } from "@/shared";

import { applySensitiveNoStoreHeaders } from "./security";
import { apiErrorResponse } from "./response";

import type { NextRequest, NextResponse } from "next/server";
import type { RequestContext } from "@/shared";

export interface ApiHandlerContext {
  readonly requestContext: RequestContext;
}

export function withApiHandler(
  handler: (
    request: NextRequest,
    context: ApiHandlerContext,
  ) => Promise<NextResponse> | NextResponse,
): (request: NextRequest) => Promise<NextResponse> {
  return async (request) => {
    const requestContext = createRequestContext(request.headers, {
      requestIdHeader: env.REQUEST_ID_HEADER,
      correlationIdHeader: env.CORRELATION_ID_HEADER,
    });

    try {
      const response = await handler(request, { requestContext });
      response.headers.set(env.REQUEST_ID_HEADER, requestContext.requestId);
      response.headers.set(env.CORRELATION_ID_HEADER, requestContext.correlationId);
      applySensitiveNoStoreHeaders(response);
      return response;
    } catch (error) {
      const response = apiErrorResponse(error, requestContext);
      response.headers.set(env.REQUEST_ID_HEADER, requestContext.requestId);
      response.headers.set(env.CORRELATION_ID_HEADER, requestContext.correlationId);
      applySensitiveNoStoreHeaders(response);
      return response;
    }
  };
}
