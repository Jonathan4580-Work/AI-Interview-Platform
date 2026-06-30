import { NextRequest, NextResponse } from "next/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { AuthenticationError, PasswordPolicyError } from "@/modules/auth";
import {
  apiSuccess,
  applySecurityHeaders,
  assertCsrf,
  authCookieNames,
  csrfCookieOptions,
  enforceRateLimit,
  MemoryRateLimiter,
  normalizeApiError,
  parseWithSchema,
  rateLimitKey,
  secureCookieOptions,
  toOffsetPagination,
  validationFailed,
  withApiHandler,
} from "@/server/api";

import type { ApiErrorResponse, ApiSuccessResponse } from "@/server/api";

const requestContext = {
  requestId: "req_123",
  correlationId: "corr_123",
};

describe("API foundation", () => {
  it("wraps successful responses in the standard response envelope", async () => {
    const response = apiSuccess(requestContext, { id: "resource_1" });
    const body = (await response.json()) as ApiSuccessResponse<{ readonly id: string }>;

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      data: { id: "resource_1" },
      meta: requestContext,
    });
  });

  it("normalizes handler errors with request metadata", async () => {
    const handler = withApiHandler(() => {
      throw validationFailed({ name: ["Required"] });
    });
    const request = new NextRequest("http://localhost/api/internal/v1/test", {
      headers: {
        "x-request-id": "req_abc",
        "x-correlation-id": "corr_abc",
      },
    });

    const response = await handler(request);
    const body = (await response.json()) as ApiErrorResponse;

    expect(response.status).toBe(422);
    expect(response.headers.get("x-request-id")).toBe("req_abc");
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("validation_failed");
    expect(body.meta).toEqual({
      requestId: "req_abc",
      correlationId: "corr_abc",
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("pragma")).toBe("no-cache");
  });

  it("validates request input through schemas", () => {
    const schema = z.object({ name: z.string().min(2) });

    expect(parseWithSchema({ name: "Aptly" }, schema)).toEqual({ name: "Aptly" });
    expect(() => parseWithSchema({ name: "" }, schema)).toThrow("Request validation failed.");
  });

  it("computes offset pagination safely", () => {
    expect(toOffsetPagination({ page: 3, pageSize: 25 })).toEqual({
      page: 3,
      pageSize: 25,
      skip: 50,
      take: 25,
    });
  });

  it("enforces CSRF double-submit protection for unsafe requests", () => {
    const request = new NextRequest("http://localhost/api/internal/v1/test", {
      method: "POST",
      headers: {
        cookie: `${authCookieNames.csrf}=token_1`,
        "x-csrf-token": "token_1",
      },
    });

    expect(() => {
      assertCsrf(request);
    }).not.toThrow();
    expect(() => {
      assertCsrf(new NextRequest("http://localhost/api/internal/v1/test", { method: "POST" }));
    }).toThrow("CSRF validation failed.");
  });

  it("uses secure cookie defaults without exposing auth cookies to scripts", () => {
    expect(secureCookieOptions(60)).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60,
    });
    expect(csrfCookieOptions(60)).toMatchObject({
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60,
    });
    expect(authCookieNames.session.startsWith("__Host-")).toBe(
      process.env.NODE_ENV === "production",
    );
  });

  it("maps auth and password policy errors without leaking internals", () => {
    const authError = normalizeApiError(new AuthenticationError("Session has expired."));
    const passwordError = normalizeApiError(new PasswordPolicyError("Password is too weak."));

    expect(authError.status).toBe(401);
    expect(authError.message).toBe("Authentication failed.");
    expect(passwordError.status).toBe(422);
    expect(passwordError.message).toBe("Password is too weak.");
  });

  it("enforces rate limit rules by key", async () => {
    const limiter = new MemoryRateLimiter();
    const key = rateLimitKey(["auth", "203.0.113.10"]);
    const now = new Date("2026-06-30T00:00:00.000Z");

    await expect(
      enforceRateLimit({ limiter, key, rule: { windowMs: 60_000, max: 1 }, now }),
    ).resolves.toBeDefined();
    await expect(
      enforceRateLimit({ limiter, key, rule: { windowMs: 60_000, max: 1 }, now }),
    ).rejects.toThrow("Too many requests.");
  });

  it("bounds in-memory rate limit buckets to avoid unbounded growth", async () => {
    const limiter = new MemoryRateLimiter({ maxBuckets: 2 });
    const now = new Date("2026-06-30T00:00:00.000Z");

    await enforceRateLimit({ limiter, key: "one", rule: { windowMs: 60_000, max: 5 }, now });
    await enforceRateLimit({ limiter, key: "two", rule: { windowMs: 60_000, max: 5 }, now });
    await enforceRateLimit({ limiter, key: "three", rule: { windowMs: 60_000, max: 5 }, now });

    await expect(
      enforceRateLimit({ limiter, key: "one", rule: { windowMs: 60_000, max: 1 }, now }),
    ).resolves.toBeDefined();
  });

  it("hashes oversized rate limit key components", () => {
    const key = rateLimitKey(["auth", "a".repeat(200)]);

    expect(key).toMatch(/^auth:sha256:[a-f0-9]{64}$/);
    expect(key).not.toContain("a".repeat(129));
  });

  it("applies baseline security headers", () => {
    const response = NextResponse.next();

    applySecurityHeaders(response);

    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("cross-origin-opener-policy")).toBe("same-origin");
    expect(response.headers.get("cross-origin-resource-policy")).toBe("same-origin");
    expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(response.headers.get("content-security-policy")).toContain("media-src 'none'");
    expect(response.headers.get("permissions-policy")).toContain("camera=()");
  });

  it("allows camera and microphone only for candidate readiness surfaces", () => {
    const response = NextResponse.next();

    applySecurityHeaders(response, { allowCandidateMedia: true });

    expect(response.headers.get("permissions-policy")).toContain("camera=(self)");
    expect(response.headers.get("permissions-policy")).toContain("microphone=(self)");
    expect(response.headers.get("content-security-policy")).toContain("media-src 'self' blob:");
  });
});
