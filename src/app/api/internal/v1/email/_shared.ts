import { z } from "zod";

import { createQueue } from "@/infra/queue";
import { prisma } from "@/infra/database";
import { AuditWriter, PrismaAuditEventStore } from "@/modules/audit";
import type { PermissionKey } from "@/modules/access-control";
import {
  DefaultEmailProviderFactory,
  EmailService,
  PrismaEmailRepository,
  type EmailDeliveryJob,
} from "@/modules/email";
import type { CompanyActor, CompanyUserId, TenantContext } from "@/modules/tenant";
import { assertCsrf, forbidden } from "@/server/api";
import {
  getAuthenticatedContext,
  requirePermissionForContext,
  requireTenantContext,
} from "@/server/auth";

import type { AuthenticatedContext } from "@/server/auth";
import type { RequestContext } from "@/shared";
import type { NextRequest } from "next/server";

export const emailAddressSchema = z.string().trim().email().max(320);
export const secretRefSchema = z
  .string()
  .trim()
  .min(1)
  .max(240)
  .regex(/^[a-zA-Z0-9/_:.-]+$/u);

export const emailTemplateKeySchema = z.enum([
  "INTERVIEW_INVITATION",
  "INTERVIEW_REMINDER",
  "INVITATION_EXPIRED",
  "EMAIL_VERIFICATION",
  "PASSWORD_RESET",
  "APPLICATION_DECISION",
]);

export async function requireEmailTenant(
  request: NextRequest,
  permission: PermissionKey,
  mutation = false,
): Promise<{ readonly auth: AuthenticatedContext; readonly tenant: TenantContext }> {
  if (mutation) {
    assertCsrf(request);
  }
  const auth = await getAuthenticatedContext(request);
  requirePermissionForContext(auth, permission);
  return {
    auth,
    tenant: requireTenantContext(auth, request),
  };
}

export async function recordEmailApiAudit(input: {
  readonly auth: AuthenticatedContext;
  readonly tenant: TenantContext;
  readonly request: NextRequest;
  readonly requestContext: RequestContext;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId?: string | null;
  readonly before?: unknown;
  readonly after?: unknown;
}): Promise<void> {
  await new AuditWriter(new PrismaAuditEventStore()).record({
    companyId: input.tenant.companyId,
    actor:
      input.auth.kind === "platform"
        ? { type: "platform_user", id: input.auth.subject.platformUserId }
        : { type: "user", id: input.auth.subject.userId },
    request: {
      requestId: input.requestContext.requestId,
      correlationId: input.requestContext.correlationId,
      sessionId: input.auth.session.id,
      ipAddress: input.request.headers.get("x-forwarded-for"),
      userAgent: input.request.headers.get("user-agent"),
    },
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId ?? null,
    riskLevel: "medium",
    before: input.before,
    after: input.after,
  });
}

export function normalizeEmailAddress(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeDomain(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (
    !/^(?=.{1,253}$)(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/u.test(normalized)
  ) {
    throw forbidden("Sender domain is invalid.");
  }
  return normalized;
}

export async function assertTenantEmailEnabled(companyId: string): Promise<void> {
  const settings = await prisma.emailSettings.findUnique({
    where: { companyId },
  });
  if (settings?.tenantEmailDisabledAt !== null && settings?.tenantEmailDisabledAt !== undefined) {
    throw forbidden("Tenant email delivery is disabled.");
  }
}

export function redactSmtpProfile(profile: unknown): unknown {
  if (profile === null || typeof profile !== "object") {
    return profile;
  }
  const record = profile as Record<string, unknown>;
  return {
    ...record,
    secretRef: "[redacted]",
  };
}

export function emailActorFromAuth(auth: AuthenticatedContext): CompanyActor {
  return auth.kind === "platform"
    ? { type: "platform_user", id: auth.subject.platformUserId }
    : { type: "user", id: auth.subject.userId as unknown as CompanyUserId };
}

export function createEmailApiService(): EmailService {
  return new EmailService(
    new PrismaEmailRepository(),
    new DefaultEmailProviderFactory(),
    createQueue("email") as import("bullmq").Queue<EmailDeliveryJob>,
    new AuditWriter(new PrismaAuditEventStore()),
  );
}
