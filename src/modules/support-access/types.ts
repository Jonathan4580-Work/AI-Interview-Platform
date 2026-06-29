import type { AuditRequestContext } from "@/modules/audit";
import type { TenantContext, TenantId } from "@/modules/tenant";
import type { Brand } from "@/shared";

export type SupportAccessSessionId = Brand<string, "SupportAccessSessionId">;
export type PlatformUserId = Brand<string, "PlatformUserId">;

export const supportAccessStatuses = [
  "requested",
  "active",
  "expired",
  "revoked",
  "denied",
] as const;

export type SupportAccessStatus = (typeof supportAccessStatuses)[number];

export const supportAccessReasonCodes = [
  "customer_support",
  "security_review",
  "compliance_review",
  "incident_response",
  "operations",
] as const;

export type SupportAccessReasonCode = (typeof supportAccessReasonCodes)[number];

export interface SupportAccessSession {
  readonly id: SupportAccessSessionId;
  readonly companyId: TenantId;
  readonly platformUserId: PlatformUserId;
  readonly status: SupportAccessStatus;
  readonly reasonCode: SupportAccessReasonCode;
  readonly reasonText: string;
  readonly approvedByPlatformUserId: PlatformUserId | null;
  readonly startedAt: Date | null;
  readonly expiresAt: Date;
  readonly endedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface StartSupportAccessSessionInput {
  readonly companyId: TenantId;
  readonly platformUserId: PlatformUserId;
  readonly approvedByPlatformUserId: PlatformUserId;
  readonly reasonCode: SupportAccessReasonCode;
  readonly reasonText: string;
  readonly expiresAt: Date;
  readonly request: AuditRequestContext;
}

export interface EndSupportAccessSessionInput {
  readonly sessionId: SupportAccessSessionId;
  readonly platformUserId: PlatformUserId;
  readonly reason: string;
  readonly request: AuditRequestContext;
  readonly endedAt?: Date;
}

export interface SupportAccessSessionStore {
  createActive(input: {
    readonly companyId: TenantId;
    readonly platformUserId: PlatformUserId;
    readonly approvedByPlatformUserId: PlatformUserId;
    readonly reasonCode: SupportAccessReasonCode;
    readonly reasonText: string;
    readonly startedAt: Date;
    readonly expiresAt: Date;
  }): Promise<SupportAccessSession>;

  findById(id: SupportAccessSessionId): Promise<SupportAccessSession | null>;

  end(input: {
    readonly id: SupportAccessSessionId;
    readonly status: Extract<SupportAccessStatus, "expired" | "revoked">;
    readonly endedAt: Date;
  }): Promise<SupportAccessSession>;

  listForCompany(tenant: TenantContext): Promise<readonly SupportAccessSession[]>;
}
