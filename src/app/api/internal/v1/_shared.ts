import { z } from "zod";

import { forbidden } from "@/server/api";
import {
  getAuthenticatedContext,
  requirePermissionForContext,
  requireTenantContext,
} from "@/server/auth";

import type { PermissionKey } from "@/modules/access-control";
import type { TenantContext } from "@/modules/tenant";
import type { NextRequest } from "next/server";

export const idParamSchema = z.string().min(1).max(128);

export const optionalTextSchema = z
  .string()
  .trim()
  .max(500)
  .transform((value) => (value.length === 0 ? null : value))
  .nullable()
  .optional();

export const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().min(1).max(256).optional(),
  sort: z.enum(["createdAt", "updatedAt", "name", "title", "position"]).default("createdAt"),
  direction: z.enum(["asc", "desc"]).default("desc"),
  status: z.string().min(1).max(32).optional(),
});

export async function requireTenantWithPermission(
  request: NextRequest,
  permission: PermissionKey,
): Promise<TenantContext> {
  const auth = await getAuthenticatedContext(request);
  requirePermissionForContext(auth, permission);
  return requireTenantContext(auth, request);
}

export async function requirePlatformPermission(
  request: NextRequest,
  permission: PermissionKey,
): Promise<void> {
  const auth = await getAuthenticatedContext(request);
  if (auth.kind !== "platform") {
    throw forbidden("Platform administrator access is required.");
  }
  requirePermissionForContext(auth, permission);
}

export function slugifyApiValue(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return slug.length === 0 ? "record" : slug;
}

export function parseIdParam(value: string): string {
  return idParamSchema.parse(value);
}
