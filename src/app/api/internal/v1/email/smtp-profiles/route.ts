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
} from "../_shared";

const smtpProfileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  host: z.string().trim().min(1).max(253),
  port: z.number().int().min(1).max(65535),
  secure: z.boolean().default(true),
  fromName: z.string().trim().min(1).max(120),
  fromEmail: emailAddressSchema,
  replyToEmail: emailAddressSchema.nullable().optional(),
  secretRef: secretRefSchema,
});

export const GET = withApiHandler(async (request, { requestContext }) => {
  const { tenant } = await requireEmailTenant(request, "email_settings:read");
  const smtpProfiles = await prisma.smtpProfile.findMany({
    where: { companyId: tenant.companyId },
    orderBy: { createdAt: "desc" },
  });

  return apiSuccess(requestContext, {
    smtpProfiles: smtpProfiles.map(redactSmtpProfile),
  });
});

export const POST = withApiHandler(async (request, { requestContext }) => {
  const { auth, tenant } = await requireEmailTenant(request, "email_settings:manage", true);
  const body = await parseJsonBody(request, smtpProfileSchema);
  const smtpProfile = await prisma.smtpProfile.create({
    data: {
      companyId: tenant.companyId,
      provider: "SMTP",
      name: body.name,
      host: body.host,
      port: body.port,
      secure: body.secure,
      fromName: body.fromName,
      fromEmail: body.fromEmail,
      normalizedFromEmail: normalizeEmailAddress(body.fromEmail),
      replyToEmail: body.replyToEmail ?? null,
      normalizedReplyToEmail:
        body.replyToEmail === undefined || body.replyToEmail === null
          ? null
          : normalizeEmailAddress(body.replyToEmail),
      secretRef: body.secretRef,
    },
  });

  await recordEmailApiAudit({
    auth,
    tenant,
    request,
    requestContext,
    action: "email.smtp_profile_created",
    resourceType: "smtp_profile",
    resourceId: smtpProfile.id,
    after: redactSmtpProfile(smtpProfile),
  });

  return apiSuccess(
    requestContext,
    { smtpProfile: redactSmtpProfile(smtpProfile) },
    { status: 201 },
  );
});
