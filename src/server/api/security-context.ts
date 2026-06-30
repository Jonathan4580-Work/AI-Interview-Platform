import type { NextRequest } from "next/server";
import type { RequestSecurityContext } from "@/modules/auth";

export function getRequestSecurityContext(request: NextRequest): RequestSecurityContext {
  return {
    ipAddress: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
  };
}

export function getClientIp(request: NextRequest): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor !== null) {
    return forwardedFor.split(",")[0]?.trim() || null;
  }

  return request.headers.get("x-real-ip");
}
