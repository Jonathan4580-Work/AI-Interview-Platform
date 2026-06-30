import type { EmailTemplateKey, RenderedEmail } from "./types";

export class EmailTemplateError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "EmailTemplateError";
  }
}

export interface EmailTemplateDefinition {
  readonly key: EmailTemplateKey;
  readonly name: string;
  readonly schemaVersion: number;
  readonly subject: string;
  readonly htmlBody: string;
  readonly textBody: string;
  readonly variables: readonly string[];
}

export type EmailTemplateVariables = Readonly<
  Partial<Record<string, string | number | Date | null>>
>;

export function renderEmailTemplate(
  definition: EmailTemplateDefinition,
  variables: EmailTemplateVariables,
): RenderedEmail {
  const normalizedVariables = normalizeVariables(definition, variables);
  return {
    subject: renderText(definition.subject, normalizedVariables),
    html: renderHtml(definition.htmlBody, normalizedVariables),
    text: renderText(definition.textBody, normalizedVariables),
  };
}

function normalizeVariables(
  definition: EmailTemplateDefinition,
  variables: EmailTemplateVariables,
): Record<string, string> {
  const allowed = new Set(definition.variables);
  const normalized: Record<string, string> = {};

  for (const variable of definition.variables) {
    const value = variables[variable];
    if (value === undefined || value === null || String(value).trim().length === 0) {
      throw new EmailTemplateError(`Missing required email template variable: ${variable}.`);
    }
    normalized[variable] = normalizeVariableValue(value);
  }

  for (const variable of Object.keys(variables)) {
    if (!allowed.has(variable)) {
      throw new EmailTemplateError(`Unsupported email template variable: ${variable}.`);
    }
  }

  return normalized;
}

function normalizeVariableValue(value: string | number | Date): string {
  if (value instanceof Date) {
    return new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(value);
  }

  return String(value).trim();
}

function renderText(template: string, variables: Record<string, string>): string {
  return replaceVariables(template, variables, escapeText);
}

function renderHtml(template: string, variables: Record<string, string>): string {
  return replaceVariables(template, variables, escapeHtml);
}

function replaceVariables(
  template: string,
  variables: Record<string, string>,
  escape: (value: string) => string,
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, variable: string) => {
    const templateVariables: Partial<Record<string, string>> = variables;
    const value = templateVariables[variable];
    if (value === undefined) {
      throw new EmailTemplateError(`Unknown email template variable: ${variable}.`);
    }
    return escape(value);
  });
}

function escapeText(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
