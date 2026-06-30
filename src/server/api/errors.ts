export type ApiErrorCode =
  | "bad_request"
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "validation_failed"
  | "csrf_failed"
  | "internal_error";

export class ApiError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: ApiErrorCode,
    message: string,
    public readonly details: unknown = null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function badRequest(message: string, details: unknown = null): ApiError {
  return new ApiError(400, "bad_request", message, details);
}

export function unauthenticated(message = "Authentication is required."): ApiError {
  return new ApiError(401, "unauthenticated", message);
}

export function forbidden(message = "Permission denied."): ApiError {
  return new ApiError(403, "forbidden", message);
}

export function notFound(message = "Resource was not found."): ApiError {
  return new ApiError(404, "not_found", message);
}

export function conflict(message: string, details: unknown = null): ApiError {
  return new ApiError(409, "conflict", message, details);
}

export function rateLimited(message = "Too many requests."): ApiError {
  return new ApiError(429, "rate_limited", message);
}

export function csrfFailed(message = "CSRF validation failed."): ApiError {
  return new ApiError(403, "csrf_failed", message);
}

export function validationFailed(details: unknown): ApiError {
  return new ApiError(422, "validation_failed", "Request validation failed.", details);
}
