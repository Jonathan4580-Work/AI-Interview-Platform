import { z } from "zod";

import { prisma } from "@/infra/database";
import { apiSuccess, parseJsonBody, withApiHandler } from "@/server/api";

import { recordEmailApiAudit, requireEmailTenant } from "../_shared";

const settingsSchema = z.object({
  defaultSmtpProfileId: z.string().trim().min(1).max(128).nullable().optional(),
  tenantEmailDisabled: z.boolean().optional(),
  disabledReason: z.string().trim().max(500).nullable().optional(),
});

export const GET = withApiHandler(async (request, { requestContext }) => {
  const { tenant } = await requireEmailTenant(request, "email_settings:read");
  const settings = await prisma.emailSettings.findUnique({
    where: { companyId: tenant.companyId },
  });

  return apiSuccess(requestContext, { settings });
});

export const PATCH = withApiHandler(async (request, { requestContext }) => {
  const { auth, tenant } = await requireEmailTenant(request, "email_settings:manage", true);
  const body = await parseJsonBody(request, settingsSchema);
  const before = await prisma.emailSettings.findUnique({
    where: { companyId: tenant.companyId },
  });
  const tenantEmailDisabledAt =
    body.tenantEmailDisabled === undefined
      ? (before?.tenantEmailDisabledAt ?? null)
      : body.tenantEmailDisabled
        ? new Date()
        : null;

  const settings = await prisma.emailSettings.upsert({
    where: { companyId: tenant.companyId },
    create: {
      companyId: tenant.companyId,
      defaultSmtpProfileId: body.defaultSmtpProfileId ?? null,
      tenantEmailDisabledAt,
      disabledReason: body.disabledReason ?? null,
      metadataJson: { schemaVersion: 1 },
    },
    update: {
      ...(body.defaultSmtpProfileId === undefined
        ? {}
        : { defaultSmtpProfileId: body.defaultSmtpProfileId }),
      tenantEmailDisabledAt,
      disabledReason: body.disabledReason ?? null,
    },
  });

  await recordEmailApiAudit({
    auth,
    tenant,
    request,
    requestContext,
    action: tenantEmailDisabledAt === null ? "email.settings_updated" : "email.tenant_disabled",
    resourceType: "email_settings",
    resourceId: settings.id,
    before,
    after: settings,
  });

  return apiSuccess(requestContext, { settings });
});
