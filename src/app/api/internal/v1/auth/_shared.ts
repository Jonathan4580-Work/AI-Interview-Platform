import { z } from "zod";

import { prisma } from "@/infra/database";
import { AuthService, PrismaAuthStore } from "@/modules/auth";
import { normalizeEmail } from "@/modules/identity";
import {
  assertCsrf,
  authCookieNames,
  enforceRateLimit,
  getClientIp,
  getRequestSecurityContext,
  MemoryRateLimiter,
  parseJsonBody,
  rateLimitKey,
  unauthenticated,
} from "@/server/api";

import type { AuthSubject } from "@/modules/auth";
import type { TenantId } from "@/modules/tenant";
import type { NextRequest } from "next/server";

export const authService = new AuthService(new PrismaAuthStore(prisma));
export const authRateLimiter = new MemoryRateLimiter();

export const loginSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("company"),
    companyId: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(1),
  }),
  z.object({
    type: z.literal("platform"),
    email: z.string().email(),
    password: z.string().min(1),
  }),
]);

export const passwordResetRequestSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("company"),
    companyId: z.string().min(1),
    email: z.string().email(),
  }),
  z.object({
    type: z.literal("platform"),
    email: z.string().email(),
  }),
]);

export const passwordResetConsumeSchema = z.object({
  token: z.string().min(32).max(512),
  newPassword: z.string().min(12).max(1024),
});

export const emailVerificationConfirmSchema = z.object({
  token: z.string().min(32).max(512),
});

export async function enforceAuthEndpointRateLimit(
  request: NextRequest,
  scope: string,
): Promise<void> {
  await enforceRateLimit({
    limiter: authRateLimiter,
    key: rateLimitKey(["auth", scope, getClientIp(request)]),
    rule: { windowMs: 60_000, max: 10 },
  });
}

export function requireRefreshToken(request: NextRequest): string {
  const refreshToken = request.cookies.get(authCookieNames.refresh)?.value;
  if (refreshToken === undefined) {
    throw unauthenticated();
  }
  return refreshToken;
}

export function requireSessionToken(request: NextRequest): string {
  const sessionToken = request.cookies.get(authCookieNames.session)?.value;
  if (sessionToken === undefined) {
    throw unauthenticated();
  }
  return sessionToken;
}

export function publicSubject(subject: AuthSubject): Record<string, string> {
  if (subject.type === "user") {
    return {
      type: "user",
      companyId: subject.companyId,
      userId: subject.userId,
      email: subject.email,
      name: subject.name,
      status: subject.status,
    };
  }

  return {
    type: "platform_user",
    platformUserId: subject.platformUserId,
    email: subject.email,
    name: subject.name,
    status: subject.status,
  };
}

export async function createPasswordResetFromRequest(request: NextRequest): Promise<void> {
  const body = await parseJsonBody(request, passwordResetRequestSchema);

  if (body.type === "company") {
    await authService.createCompanyPasswordReset({
      companyId: body.companyId as TenantId,
      email: normalizeEmail(body.email),
    });
    return;
  }

  await authService.createPlatformPasswordReset({ email: normalizeEmail(body.email) });
}

export function assertCsrfForAuthenticatedMutation(request: NextRequest): void {
  assertCsrf(request);
}

export { getRequestSecurityContext };
