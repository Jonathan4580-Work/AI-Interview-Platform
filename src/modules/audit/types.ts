import type { TenantId } from "@/modules/tenant";

export const auditActorTypes = ["platform_user", "user", "system"] as const;
export const auditRiskLevels = ["low", "medium", "high", "critical"] as const;

export type AuditActorType = (typeof auditActorTypes)[number];
export type AuditRiskLevel = (typeof auditRiskLevels)[number];

export interface AuditActor {
  readonly type: AuditActorType;
  readonly id: string | null;
}

export interface AuditRequestContext {
  readonly requestId: string | null;
  readonly correlationId: string | null;
  readonly sessionId: string | null;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
}

export interface AuditEventInput {
  readonly companyId?: TenantId | null;
  readonly actor: AuditActor;
  readonly request: AuditRequestContext;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId?: string | null;
  readonly reason?: string | null;
  readonly riskLevel?: AuditRiskLevel;
  readonly before?: unknown;
  readonly after?: unknown;
  readonly metadata?: unknown;
}

export interface PersistedAuditEventInput {
  readonly companyId: string | null;
  readonly actorType: AuditActorType;
  readonly actorId: string | null;
  readonly requestId: string | null;
  readonly correlationId: string | null;
  readonly sessionId: string | null;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId: string | null;
  readonly reason: string | null;
  readonly riskLevel: AuditRiskLevel;
  readonly before: unknown;
  readonly after: unknown;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly metadata: unknown;
}

export interface AuditEventStore {
  append(event: PersistedAuditEventInput): Promise<void>;
}
