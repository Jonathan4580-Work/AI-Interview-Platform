export const platformSupportRoles = [
  "support",
  "compliance",
  "operations",
  "super_admin",
] as const;

export type PlatformSupportRole = (typeof platformSupportRoles)[number];

export const supportAccessPermissions = {
  request: "platform.support_access.request",
  approve: "platform.support_access.approve",
  end: "platform.support_access.end",
  viewHistory: "platform.support_access.view_history",
} as const;
