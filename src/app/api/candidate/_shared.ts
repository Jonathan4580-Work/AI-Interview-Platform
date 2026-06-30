import { z } from "zod";

import {
  candidateCookieNames,
  CandidatePortalService,
  type CandidateRequestContext,
  type CandidateSessionContext,
} from "@/modules/candidate-portal";
import { csrfFailed, enforceRateLimit, MemoryRateLimiter, rateLimitKey } from "@/server/api";

import type { ApiHandlerContext } from "@/server/api";
import type { NextRequest } from "next/server";

const candidateLimiter = new MemoryRateLimiter();

export const candidateTextSchema = z.string().trim().min(1).max(2_000);
export const contactEmailSchema = z.string().trim().email().max(320);

export function createCandidateRequestContext(
  request: NextRequest,
  context: ApiHandlerContext,
): CandidateRequestContext {
  return {
    requestId: context.requestContext.requestId,
    correlationId: context.requestContext.correlationId,
    ipAddress: firstForwardedIp(request.headers.get("x-forwarded-for")),
    userAgent: request.headers.get("user-agent"),
  };
}

export async function enforceCandidateRateLimit(
  request: NextRequest,
  scope: string,
  max = 20,
): Promise<void> {
  await enforceRateLimit({
    limiter: candidateLimiter,
    key: rateLimitKey([
      "candidate",
      scope,
      firstForwardedIp(request.headers.get("x-forwarded-for")),
      request.headers.get("user-agent"),
    ]),
    rule: { windowMs: 60_000, max },
  });
}

export async function requireCandidateSession(
  request: NextRequest,
  context: ApiHandlerContext,
  mutation = false,
): Promise<CandidateSessionContext> {
  const service = new CandidatePortalService();
  const session = await service.requireSession(
    request.cookies.get(candidateCookieNames.session)?.value,
    createCandidateRequestContext(request, context),
  );
  if (mutation) {
    const csrf = request.headers.get("x-candidate-csrf-token");
    try {
      service.assertCandidateCsrf(session, csrf);
    } catch {
      throw csrfFailed("Candidate request verification failed.");
    }
  }
  return session;
}

function firstForwardedIp(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  const first = value.split(",")[0] ?? "";
  const trimmed = first.trim();
  return trimmed.length === 0 ? null : trimmed;
}
