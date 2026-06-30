import type { TenantContext } from "@/modules/tenant";

export const permissionKeys = [
  "tenant:read",
  "tenant:manage",
  "users:read",
  "users:manage",
  "roles:read",
  "roles:manage",
  "audit:write",
  "audit:read",
  "support_access:read",
  "support_access:manage",
  "legal_holds:read",
  "legal_holds:manage",
  "privacy_requests:read",
  "privacy_requests:manage",
  "exports:read",
  "exports:manage",
  "entitlements:read",
  "entitlements:manage",
  "departments:read",
  "departments:manage",
  "teams:read",
  "teams:manage",
  "locations:read",
  "locations:manage",
  "jobs:read",
  "jobs:manage",
  "job_templates:read",
  "job_templates:manage",
  "pipelines:read",
  "pipelines:manage",
  "interview_plans:read",
  "interview_plans:manage",
  "candidates:read",
  "candidates:manage",
  "applications:read",
  "applications:manage",
  "invitations:read",
  "invitations:manage",
  "candidate_sessions:read",
  "candidate_sessions:manage",
  "candidate_notes:read",
  "candidate_notes:manage",
  "candidate_readiness:read",
  "candidate_readiness:manage",
  "candidate_accommodations:read",
  "candidate_accommodations:manage",
  "scheduling:read",
  "scheduling:manage",
  "notifications:read",
  "notifications:manage",
  "email_settings:read",
  "email_settings:manage",
  "email_templates:read",
  "email_templates:manage",
  "email_deliveries:read",
  "email_deliveries:manage",
  "sender_domains:read",
  "sender_domains:manage",
  "workflows:read",
  "workflows:manage",
  "media:read",
  "media:manage",
  "media:delete",
  "queues:read",
  "queues:manage",
] as const;

export type PermissionKey = (typeof permissionKeys)[number];

export interface PermissionSet {
  readonly permissions: ReadonlySet<PermissionKey>;
}

export interface AccessPolicyInput {
  readonly tenant: TenantContext;
  readonly permissionSet: PermissionSet;
  readonly required: PermissionKey;
}

export interface AccessDecision {
  readonly allowed: boolean;
  readonly reason: "permission_granted" | "permission_missing";
}
