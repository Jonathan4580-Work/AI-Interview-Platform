import type { RequestContext } from "@/shared";

export interface ErrorReport {
  readonly name: string;
  readonly message: string;
  readonly stack: string | null;
  readonly requestId: string | null;
  readonly correlationId: string | null;
}

export function createErrorReport(error: unknown, context?: RequestContext): ErrorReport {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack ?? null,
      requestId: context?.requestId ?? null,
      correlationId: context?.correlationId ?? null,
    };
  }

  return {
    name: "UnknownError",
    message: "An unknown error was thrown.",
    stack: null,
    requestId: context?.requestId ?? null,
    correlationId: context?.correlationId ?? null,
  };
}
