import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AuthenticationError, PasswordPolicyError } from "@/modules/auth";

import { ApiError, validationFailed } from "./errors";

import type { RequestContext } from "@/shared";

export interface ApiResponseMeta {
  readonly requestId: string;
  readonly correlationId: string;
  readonly pagination?: unknown;
}

export interface ApiSuccessResponse<TData> {
  readonly ok: true;
  readonly data: TData;
  readonly meta: ApiResponseMeta;
}

export interface ApiErrorResponse {
  readonly ok: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details: unknown;
  };
  readonly meta: ApiResponseMeta;
}

export function apiSuccess<TData>(
  context: RequestContext,
  data: TData,
  init: {
    readonly status?: number;
    readonly pagination?: unknown;
    readonly headers?: HeadersInit;
  } = {},
): NextResponse<ApiSuccessResponse<TData>> {
  return NextResponse.json(
    {
      ok: true,
      data,
      meta: {
        requestId: context.requestId,
        correlationId: context.correlationId,
        ...(init.pagination === undefined ? {} : { pagination: init.pagination }),
      },
    },
    {
      status: init.status ?? 200,
      headers: init.headers,
    },
  );
}

export function apiErrorResponse(
  error: unknown,
  context: RequestContext,
): NextResponse<ApiErrorResponse> {
  const normalized = normalizeApiError(error);

  return NextResponse.json(
    {
      ok: false,
      error: {
        code: normalized.code,
        message: normalized.message,
        details: normalized.details,
      },
      meta: {
        requestId: context.requestId,
        correlationId: context.correlationId,
      },
    },
    { status: normalized.status },
  );
}

export function normalizeApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  if (error instanceof ZodError) {
    return validationFailed(error.flatten());
  }
  if (error instanceof AuthenticationError) {
    return new ApiError(401, "unauthenticated", "Authentication failed.");
  }
  if (error instanceof PasswordPolicyError) {
    return new ApiError(422, "validation_failed", error.message);
  }
  if (isPrismaKnownError(error, "P2025")) {
    return new ApiError(404, "not_found", "Resource was not found.");
  }
  if (isPrismaKnownError(error, "P2002")) {
    return new ApiError(409, "conflict", "Resource conflicts with an existing record.");
  }

  return new ApiError(500, "internal_error", "An unexpected error occurred.");
}

function isPrismaKnownError(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { readonly code?: unknown }).code === code
  );
}
