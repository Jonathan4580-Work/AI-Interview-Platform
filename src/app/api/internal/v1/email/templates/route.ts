import { z } from "zod";

import { prisma } from "@/infra/database";
import { getDefaultEmailTemplate } from "@/modules/email";
import { apiSuccess, parseJsonBody, withApiHandler } from "@/server/api";

import { emailTemplateKeySchema, recordEmailApiAudit, requireEmailTenant } from "../_shared";

const emailTemplateSchema = z.object({
  key: emailTemplateKeySchema,
  name: z.string().trim().min(2).max(160),
  subject: z.string().trim().min(1).max(240),
  htmlBody: z.string().trim().min(1).max(40_000),
  textBody: z.string().trim().min(1).max(20_000),
  version: z.number().int().min(1),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
});

export const GET = withApiHandler(async (request, { requestContext }) => {
  const { tenant } = await requireEmailTenant(request, "email_templates:read");
  const templates = await prisma.emailTemplate.findMany({
    where: {
      OR: [{ companyId: tenant.companyId }, { companyId: null }],
    },
    orderBy: [{ key: "asc" }, { version: "desc" }],
  });

  return apiSuccess(requestContext, { templates });
});

export const POST = withApiHandler(async (request, { requestContext }) => {
  const { auth, tenant } = await requireEmailTenant(request, "email_templates:manage", true);
  const body = await parseJsonBody(request, emailTemplateSchema);
  assertAllowedTemplateVariables(body.key, body.subject, body.htmlBody, body.textBody);
  const template = await prisma.emailTemplate.create({
    data: {
      companyId: tenant.companyId,
      key: body.key,
      name: body.name,
      subject: body.subject,
      htmlBody: body.htmlBody,
      textBody: body.textBody,
      schemaVersion: 1,
      version: body.version,
      status: body.status,
      publishedAt: body.status === "PUBLISHED" ? new Date() : null,
      archivedAt: body.status === "ARCHIVED" ? new Date() : null,
    },
  });

  await recordEmailApiAudit({
    auth,
    tenant,
    request,
    requestContext,
    action: "email.template_created",
    resourceType: "email_template",
    resourceId: template.id,
    after: templateAuditSnapshot(template),
  });

  return apiSuccess(requestContext, { template }, { status: 201 });
});

function assertAllowedTemplateVariables(
  key: z.infer<typeof emailTemplateKeySchema>,
  ...templates: readonly string[]
): void {
  const allowed = new Set(getDefaultEmailTemplate(key.toLowerCase() as never).variables);
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
