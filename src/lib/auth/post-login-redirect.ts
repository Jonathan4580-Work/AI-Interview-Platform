import type { AuthenticatedSubject } from "@/lib/auth/session-client";

export const companyPostLoginPath = "/";
export const platformPostLoginPath = "/settings/integrations";
export const invalidPostLoginPath = "/auth-error";

export function getPostLoginRedirect(subject: AuthenticatedSubject): string {
  if (subject.type === "user") {
    return companyPostLoginPath;
  }
  if (subject.type === "platform_user") {
    return platformPostLoginPath;
  }

  return invalidPostLoginPath;
}
