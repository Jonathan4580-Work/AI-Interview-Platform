import { z } from "zod";

import { prisma } from "@/infra/database";
import { apiSuccess, parseJsonBody, withApiHandler } from "@/server/api";

import {
  emailAddressSchema,
  normalizeEmailAddress,
  recordEmailApiAudit,
  redactSmtpProfile,
  requireEmailTenant,
  secretRefSchema,
} from "../../_shared";

const smtpProfilePatchSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  host: z.string().trim().min(1).max(253).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  secure: z.boolean().optional(),
  fromName: z.string().trim().min(1).max(120).optional(),
  fromEmail: emailAddressSchema.optional(),
  replyToEmail: emailAddressSchema.nullable().optional(),
  secretRef: secretRefSchema.optional(),
  status: z.enum(["ACTIVE", "DISABLED", "ARCHIVED"]).optional(),
});

export const GET = withApiHandler(async (request, { requestContext }) => {
  const { tenant } = await requireEmailTenant(request, "email_settings:read");
  const smtpProfileId = request.nextUrl.pathname.split("/").at(-1);
  const smtpProfile = await prisma.smtpProfile.findFirstOrThrow({
    where: { companyId: tenant.companyId, id: smtpProfileId },
  });

  return apiSuccess(requestContext, { smtpProfile: redactSmtpProfile(smtpProfile) });
});

export const PATCH = withApiHandler(async (request, { requestContext }) => {
  const { auth, tenant } = await requireEmailTenant(request, "email_settings:manage", true);
  const smtpProfileId = request.nextUrl.pathname.split("/").at(-1);
  const body = await parseJsonBody(request, smtpProfilePatchSchema);
  const before = await prisma.smtpProfile.findFirstOrThrow({
    where: { companyId: tenant.companyId, id: smtpProfileId },
  });
  const smtpProfile = await prisma.smtpProfile.update({
    where: { companyId_id: { companyId: tenant.companyId, id: before.id } },
    data: {
      ...body,
      ...(body.fromEmail === undefined
        ? {}
        : { normalizedFromEmail: normalizeEmailAddress(body.fromEmail) }),
      ...(body.replyToEmail === undefined
        ? {}
        : {
            normalizedReplyToEmail:
              body.replyToEmail === null ? null : normalizeEmailAddress(body.replyToEmail),
          }),
      archivedAt: body.status === "ARCHIVED" ? new Date() : before.archivedAt,
    },
  });

  await recordEmailApiAudit({
    auth,
    tenant,
    request,
    requestContext,
    action:
      body.secretRef === undefined
        ? "email.smtp_profile_updated"
        : "email.smtp_profile_secret_reference_changed",
    resourceType: "smtp_profile",
    resourceId: smtpProfile.id,
    before: redactSmtpProfile(before),
    after: redactSmtpProfile(smtpProfile),
  });

  return apiSuccess(requestContext, { smtpProfile: redactSmtpProfile(smtpProfile) });
});
