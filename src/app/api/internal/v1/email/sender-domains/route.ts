import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

import { prisma } from "@/infra/database";
import { apiSuccess, parseJsonBody, withApiHandler } from "@/server/api";

import { normalizeDomain, recordEmailApiAudit, requireEmailTenant } from "../_shared";

const senderDomainSchema = z.object({
  domain: z.string().trim().min(4).max(253),
});

export const GET = withApiHandler(async (request, { requestContext }) => {
  const { tenant } = await requireEmailTenant(request, "sender_domains:read");
  const senderDomains = await prisma.verifiedSenderDomain.findMany({
    where: { companyId: tenant.companyId },
    orderBy: { createdAt: "desc" },
  });

  return apiSuccess(requestContext, { senderDomains });
});

export const POST = withApiHandler(async (request, { requestContext }) => {
  const { auth, tenant } = await requireEmailTenant(request, "sender_domains:manage", true);
  const body = await parseJsonBody(request, senderDomainSchema);
  const normalizedDomain = normalizeDomain(body.domain);
  const verificationToken = randomBytes(24).toString("base64url");
  const dnsTxtName = `_aptly-email.${normalizedDomain}`;
  const dnsTxtValue = `aptly-domain-verification=${verificationToken}`;
  const senderDomain = await prisma.verifiedSenderDomain.create({
    data: {
      companyId: tenant.companyId,
      domain: body.domain,
      normalizedDomain,
      verificationTokenHash: createHash("sha256").update(verificationToken).digest("hex"),
      dnsTxtName,
      dnsTxtValue,
    },
  });

  await recordEmailApiAudit({
    auth,
    tenant,
    request,
    requestContext,
    action: "email.sender_domain_created",
    resourceType: "verified_sender_domain",
    resourceId: senderDomain.id,
    after: {
      id: senderDomain.id,
      domain: senderDomain.normalizedDomain,
      status: senderDomain.status,
      dnsTxtName,
    },
  });

  return apiSuccess(
    requestContext,
    {
      senderDomain: {
        ...senderDomain,
        dnsTxtValue,
      },
    },
    { status: 201 },
  );
});
