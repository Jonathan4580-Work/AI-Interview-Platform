import { prisma } from "@/infra/database";
import { DefaultEmailProviderFactory } from "@/modules/email";
import { apiSuccess, withApiHandler } from "@/server/api";

import { recordEmailApiAudit, redactSmtpProfile, requireEmailTenant } from "../../../_shared";

export const POST = withApiHandler(async (request, { requestContext }) => {
  const { auth, tenant } = await requireEmailTenant(request, "email_settings:manage", true);
  const smtpProfileId = request.nextUrl.pathname.split("/").at(-2);
  const smtpProfile = await prisma.smtpProfile.findFirstOrThrow({
    where: { companyId: tenant.companyId, id: smtpProfileId },
  });

  const provider = new DefaultEmailProviderFactory().createProvider({
    provider: "smtp",
    smtpProfile: {
      id: smtpProfile.id as never,
      companyId: smtpProfile.companyId as never,
      provider: "smtp",
      name: smtpProfile.name,
      host: smtpProfile.host,
      port: smtpProfile.port,
      secure: smtpProfile.secure,
      fromName: smtpProfile.fromName,
      fromEmail: smtpProfile.fromEmail,
      normalizedFromEmail: smtpProfile.normalizedFromEmail,
      replyToEmail: smtpProfile.replyToEmail,
      normalizedReplyToEmail: smtpProfile.normalizedReplyToEmail,
      secretRef: smtpProfile.secretRef,
      status: smtpProfile.status.toLowerCase() as never,
      domainVerificationStatus: smtpProfile.domainVerificationStatus.toLowerCase() as never,
      createdAt: smtpProfile.createdAt,
      updatedAt: smtpProfile.updatedAt,
      archivedAt: smtpProfile.archivedAt,
    },
  });
  await provider.testConnection();

  await recordEmailApiAudit({
    auth,
    tenant,
    request,
    requestContext,
    action: "email.smtp_profile_tested",
    resourceType: "smtp_profile",
    resourceId: smtpProfile.id,
    after: redactSmtpProfile(smtpProfile),
  });

  return apiSuccess(requestContext, { ok: true });
});
