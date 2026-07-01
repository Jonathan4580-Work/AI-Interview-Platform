import { z } from "zod";

import { MemoryRateLimiter, enforceRateLimit, getClientIp, rateLimitKey } from "@/server/api";

import { requireTenantMutationPermission, requireTenantWithPermission } from "../_shared";

import type { PermissionKey } from "@/modules/access-control";
import type { TenantContext } from "@/modules/tenant";
import type { NextRequest } from "next/server";

const phase12RateLimiter = new MemoryRateLimiter({ maxBuckets: 5_000 });

export const secretReferenceSchema = z
  .string()
  .trim()
  .min(1)
  .max(240)
  .regex(
    /^secret:\/\/[a-zA-Z0-9/_:.-]+$/u,
    "Secret references must use managed secret identifiers.",
  );

export const providerNameSchema = z.string().trim().min(1).max(80);

export async function requirePhase12Tenant(
  request: NextRequest,
  permission: PermissionKey,
  mutation = false,
): Promise<TenantContext> {
  await enforceRateLimit({
    limiter: phase12RateLimiter,
    key: rateLimitKey(["phase12", permission, getClientIp(request)]),
    rule: { windowMs: 60_000, max: mutation ? 60 : 180 },
  });

  return mutation
    ? requireTenantMutationPermission(request, permission)
    : requireTenantWithPermission(request, permission);
}

export function phase12Status(
  resource: string,
  companyId: string,
): {
  readonly resource: string;
  readonly companyId: string;
  readonly phase: "phase_12";
  readonly productionDeployment: false;
} {
  return {
    resource,
    companyId,
    phase: "phase_12",
    productionDeployment: false,
  };
}
