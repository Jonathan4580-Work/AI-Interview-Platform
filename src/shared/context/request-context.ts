import { randomUUID } from "node:crypto";

export interface RequestContext {
  readonly requestId: string;
  readonly correlationId: string;
}

export interface RequestContextHeaders {
  get(name: string): string | null;
}

export interface RequestContextHeaderNames {
  readonly requestIdHeader: string;
  readonly correlationIdHeader: string;
}

export function createRequestContext(
  headers: RequestContextHeaders,
  headerNames: RequestContextHeaderNames,
): RequestContext {
  const requestId = headers.get(headerNames.requestIdHeader) ?? randomUUID();
  const correlationId = headers.get(headerNames.correlationIdHeader) ?? requestId;

  return {
    requestId: sanitizeContextId(requestId),
    correlationId: sanitizeContextId(correlationId),
  };
}

function sanitizeContextId(value: string): string {
  const trimmed = value.trim();

  if (/^[a-zA-Z0-9_.:-]{1,128}$/.test(trimmed)) {
    return trimmed;
  }

  return randomUUID();
}
