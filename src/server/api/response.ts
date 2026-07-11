import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AuthenticationError, PasswordPolicyError } from "@/modules/auth";
import { CandidatePortalError } from "@/modules/candidate-portal";
import { ExportRequestError } from "@/modules/exports";
import { InterviewDomainError } from "@/modules/interviews";
import { MediaDomainError } from "@/modules/media";
import { MonitoringDomainError } from "@/modules/monitoring";
import { AggregateReportDomainError, CandidateComparisonDomainError } from "@/modules/reporting";
import { WorkflowDomainError } from "@/modules/workflows";

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
    serializeForJson({
      ok: true,
      data,
      meta: {
        requestId: context.requestId,
        correlationId: context.correlationId,
        ...(init.pagination === undefined ? {} : { pagination: init.pagination }),
      },
    }) as ApiSuccessResponse<TData>,
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
    serializeForJson({
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
    }) as ApiErrorResponse,
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
  if (error instanceof CandidatePortalError) {
    if (error.code === "session_required") {
      return new ApiError(401, "unauthenticated", "Candidate session is required.");
    }
    if (error.code === "csrf_failed") {
      return new ApiError(403, "csrf_failed", "Request verification failed.");
    }
    if (error.code === "invalid_link") {
      return new ApiError(400, "bad_request", "Interview link cannot be used.");
    }
    if (error.code === "validation_failed") {
      return new ApiError(422, "validation_failed", error.message);
    }
    return new ApiError(409, "conflict", error.message);
  }
  if (error instanceof WorkflowDomainError || error instanceof MediaDomainError) {
    return new ApiError(409, "conflict", error.message);
  }
  if (error instanceof InterviewDomainError) {
    if (error.code === "not_found") {
      return new ApiError(404, "not_found", "Interview session was not found.");
    }
    if (error.code === "validation_failed") {
      return new ApiError(422, "validation_failed", error.message);
    }
    return new ApiError(409, "conflict", error.message);
  }
  if (error instanceof MonitoringDomainError) {
    if (error.code === "not_found") {
      return new ApiError(404, "not_found", "Monitoring resource was not found.");
    }
    if (error.code === "validation_failed") {
      return new ApiError(422, "validation_failed", error.message);
    }
    if (error.code === "forbidden") {
      return new ApiError(403, "forbidden", "Monitoring is not available for this session.");
    }
    return new ApiError(409, "conflict", error.message);
  }
  if (
    error instanceof AggregateReportDomainError ||
    error instanceof CandidateComparisonDomainError ||
    error instanceof ExportRequestError
  ) {
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

function serializeForJson(value: unknown): unknown {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeForJson(item));
  }

  if (typeof value === "object" && value !== null) {
    const output: Record<string, unknown> = {};

    for (const [key, nestedValue] of Object.entries(value)) {
      output[key] = serializeForJson(nestedValue);
    }

    return output;
  }

  return value;
}
