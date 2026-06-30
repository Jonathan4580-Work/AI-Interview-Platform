import { z } from "zod";

import { prisma } from "@/infra/database";
import { getDefaultEmailTemplate } from "@/modules/email";
import { apiSuccess, parseJsonBody, withApiHandler } from "@/server/api";

import { recordEmailApiAudit, requireEmailTenant } from "../../_shared";

const templatePatchSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  subject: z.string().trim().min(1).max(240).optional(),
  htmlBody: z.string().trim().min(1).max(40_000).optional(),
  textBody: z.string().trim().min(1).max(20_000).optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
});

export const GET = withApiHandler(async (request, { requestContext }) => {
  const { tenant } = await requireEmailTenant(request, "email_templates:read");
  const templateId = request.nextUrl.pathname.split("/").at(-1);
  const template = await prisma.emailTemplate.findFirstOrThrow({
    where: { id: templateId, OR: [{ companyId: tenant.companyId }, { companyId: null }] },
  });

  return apiSuccess(requestContext, { template });
});

export const PATCH = withApiHandler(async (request, { requestContext }) => {
  const { auth, tenant } = await requireEmailTenant(request, "email_templates:manage", true);
  const templateId = request.nextUrl.pathname.split("/").at(-1);
  const body = await parseJsonBody(request, templatePatchSchema);
  const before = await prisma.emailTemplate.findFirstOrThrow({
    where: { companyId: tenant.companyId, id: templateId },
  });
  assertAllowedTemplateVariables(
    before.key,
    body.subject ?? before.subject,
    body.htmlBody ?? before.htmlBody,
    body.textBody ?? before.textBody,
  );
  const template = await prisma.emailTemplate.update({
    where: { companyId_id: { companyId: tenant.companyId, id: before.id } },
    data: {
      ...body,
      publishedAt: body.status === "PUBLISHED" ? new Date() : before.publishedAt,
      archivedAt: body.status === "ARCHIVED" ? new Date() : before.archivedAt,
    },
  });

  await recordEmailApiAudit({
    auth,
    tenant,
    request,
    requestContext,
    action:
      body.status === "PUBLISHED"
        ? "email.template_published"
        : body.status === "ARCHIVED"
          ? "email.template_archived"
          : "email.template_updated",
    resourceType: "email_template",
    resourceId: template.id,
    before: templateAuditSnapshot(before),
    after: templateAuditSnapshot(template),
  });

  return apiSuccess(requestContext, { template });
});

function assertAllowedTemplateVariables(key: unknown, ...templates: readonly string[]): void {
  const allowed = new Set(getDefaultEmailTemplate(String(key).toLowerCase() as never).variables);
  for (const template of templates) {
    for (const match of template.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/gu)) {
      const variable = match[1];
      if (!allowed.has(variable)) {
        throw new Error(`Unsupported email template variable: ${variable}.`);
      }
    }
  }
}

function templateAuditSnapshot(template: {
  readonly id: string;
  readonly key: unknown;
  readonly version: number;
  readonly status: unknown;
  readonly subject: string;
}): Record<string, unknown> {
  return {
    id: template.id,
    key: template.key,
    version: template.version,
    status: template.status,
    subject: template.subject,
  };
}
