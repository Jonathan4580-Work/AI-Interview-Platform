import { z } from "zod";

import { prisma } from "@/infra/database";
import { apiSuccess, parseJsonBody, withApiHandler } from "@/server/api";

import { recordEmailApiAudit, requireEmailTenant } from "../../_shared";

const senderDomainPatchSchema = z.object({
  status: z.enum(["PENDING", "VERIFIED", "FAILED", "REVOKED"]),
  failureReason: z.string().trim().max(500).nullable().optional(),
});

export const GET = withApiHandler(async (request, { requestContext }) => {
  const { tenant } = await requireEmailTenant(request, "sender_domains:read");
  const domainId = request.nextUrl.pathname.split("/").at(-1);
  const senderDomain = await prisma.verifiedSenderDomain.findFirstOrThrow({
    where: { companyId: tenant.companyId, id: domainId },
  });

  return apiSuccess(requestContext, { senderDomain });
});

export const PATCH = withApiHandler(async (request, { requestContext }) => {
  const { auth, tenant } = await requireEmailTenant(request, "sender_domains:manage", true);
  const domainId = request.nextUrl.pathname.split("/").at(-1);
  const body = await parseJsonBody(request, senderDomainPatchSchema);
  const before = await prisma.verifiedSenderDomain.findFirstOrThrow({
    where: { companyId: tenant.companyId, id: domainId },
  });
  const senderDomain = await prisma.verifiedSenderDomain.update({
    where: { companyId_id: { companyId: tenant.companyId, id: before.id } },
    data: {
      status: body.status,
      failureReason: body.failureReason ?? null,
      verifiedAt: body.status === "VERIFIED" ? new Date() : before.verifiedAt,
    },
  });

  await recordEmailApiAudit({
    auth,
    tenant,
    request,
    requestContext,
    action: "email.sender_domain_status_changed",
    resourceType: "verified_sender_domain",
    resourceId: senderDomain.id,
    before: {
      id: before.id,
      status: before.status,
      failureReason: before.failureReason,
    },
    after: {
      id: senderDomain.id,
      status: senderDomain.status,
      failureReason: senderDomain.failureReason,
    },
  });

  return apiSuccess(requestContext, { senderDomain });
});
