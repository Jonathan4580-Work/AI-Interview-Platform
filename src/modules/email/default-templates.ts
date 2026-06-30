import type { EmailTemplateDefinition } from "./template-renderer";
import type { EmailTemplateKey } from "./types";

const sharedVariables = [
  "companyName",
  "recipientName",
  "supportEmail",
  "actionUrl",
  "expirationDate",
] as const;

export const defaultEmailTemplates: readonly EmailTemplateDefinition[] = [
  {
    key: "interview_invitation",
    name: "Interview invitation",
    schemaVersion: 1,
    variables: [...sharedVariables, "jobTitle", "estimatedDuration", "interviewWindow"],
    subject: "Interview invitation from {{companyName}} for {{jobTitle}}",
    htmlBody: baseHtml(`
      <p>Hello {{recipientName}},</p>
      <p>{{companyName}} has invited you to complete a browser-based interview for {{jobTitle}}.</p>
      <p>The interview is designed to be completed on a desktop or laptop in a quiet environment with stable internet. You will be asked to allow webcam and microphone access before the interview begins.</p>
      <p>Estimated duration: {{estimatedDuration}}.</p>
      <p>Interview window: {{interviewWindow}}.</p>
      <p>This invitation expires on {{expirationDate}}.</p>
      <p><a class="button" href="{{actionUrl}}">Start interview setup</a></p>
      <p>If the button does not work, copy and paste this link into your browser:<br><span class="link">{{actionUrl}}</span></p>
      <p>For help, contact {{supportEmail}}.</p>
    `),
    textBody: [
      "Hello {{recipientName}},",
      "",
      "{{companyName}} has invited you to complete a browser-based interview for {{jobTitle}}.",
      "Use a desktop or laptop in a quiet environment with stable internet. Webcam and microphone access will be required before the interview begins.",
      "",
      "Estimated duration: {{estimatedDuration}}.",
      "Interview window: {{interviewWindow}}.",
      "This invitation expires on {{expirationDate}}.",
      "",
      "Start interview setup: {{actionUrl}}",
      "",
      "For help, contact {{supportEmail}}.",
    ].join("\n"),
  },
  {
    key: "interview_reminder",
    name: "Interview reminder",
    schemaVersion: 1,
    variables: [...sharedVariables, "jobTitle"],
    subject: "Reminder: {{companyName}} interview for {{jobTitle}}",
    htmlBody: baseHtml(`
      <p>Hello {{recipientName}},</p>
      <p>This is a reminder to complete your interview with {{companyName}} for {{jobTitle}}.</p>
      <p>Please use a desktop or laptop, choose a quiet environment, and confirm you have stable internet before starting.</p>
      <p>Your invitation expires on {{expirationDate}}.</p>
      <p><a class="button" href="{{actionUrl}}">Continue interview setup</a></p>
      <p>For help, contact {{supportEmail}}.</p>
    `),
    textBody: [
      "Hello {{recipientName}},",
      "",
      "This is a reminder to complete your interview with {{companyName}} for {{jobTitle}}.",
      "Please use a desktop or laptop, choose a quiet environment, and confirm you have stable internet before starting.",
      "",
      "Your invitation expires on {{expirationDate}}.",
      "Continue interview setup: {{actionUrl}}",
      "",
      "For help, contact {{supportEmail}}.",
    ].join("\n"),
  },
  {
    key: "invitation_expired",
    name: "Invitation expired",
    schemaVersion: 1,
    variables: [...sharedVariables, "jobTitle"],
    subject: "Interview invitation expired for {{jobTitle}}",
    htmlBody: baseHtml(`
      <p>Hello {{recipientName}},</p>
      <p>Your interview invitation from {{companyName}} for {{jobTitle}} expired on {{expirationDate}}.</p>
      <p>If you believe this was a mistake or need a new invitation, contact {{supportEmail}}.</p>
    `),
    textBody: [
      "Hello {{recipientName}},",
      "",
      "Your interview invitation from {{companyName}} for {{jobTitle}} expired on {{expirationDate}}.",
      "If you believe this was a mistake or need a new invitation, contact {{supportEmail}}.",
    ].join("\n"),
  },
  {
    key: "email_verification",
    name: "Email verification",
    schemaVersion: 1,
    variables: sharedVariables,
    subject: "Verify your Aptly email address",
    htmlBody: baseHtml(`
      <p>Hello {{recipientName}},</p>
      <p>Please verify your email address for Aptly.</p>
      <p>This verification link expires on {{expirationDate}}.</p>
      <p><a class="button" href="{{actionUrl}}">Verify email</a></p>
      <p>If you did not request this, contact {{supportEmail}}.</p>
    `),
    textBody: [
      "Hello {{recipientName}},",
      "",
      "Please verify your email address for Aptly.",
      "This verification link expires on {{expirationDate}}.",
      "",
      "Verify email: {{actionUrl}}",
      "",
      "If you did not request this, contact {{supportEmail}}.",
    ].join("\n"),
  },
  {
    key: "password_reset",
    name: "Password reset",
    schemaVersion: 1,
    variables: sharedVariables,
    subject: "Reset your Aptly password",
    htmlBody: baseHtml(`
      <p>Hello {{recipientName}},</p>
      <p>Use the secure link below to reset your Aptly password.</p>
      <p>This password reset link expires on {{expirationDate}}.</p>
      <p><a class="button" href="{{actionUrl}}">Reset password</a></p>
      <p>If you did not request this, contact {{supportEmail}}.</p>
    `),
    textBody: [
      "Hello {{recipientName}},",
      "",
      "Use the secure link below to reset your Aptly password.",
      "This password reset link expires on {{expirationDate}}.",
      "",
      "Reset password: {{actionUrl}}",
      "",
      "If you did not request this, contact {{supportEmail}}.",
    ].join("\n"),
  },
];

export function getDefaultEmailTemplate(key: EmailTemplateKey): EmailTemplateDefinition {
  const template = defaultEmailTemplates.find((candidate) => candidate.key === key);
  if (template === undefined) {
    throw new Error(`Default email template is not registered: ${key}.`);
  }
  return template;
}

function baseHtml(content: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <title>Aptly</title>
    <style>
      body { margin: 0; padding: 0; background: #f7f7f5; color: #20201d; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      .container { max-width: 640px; margin: 0 auto; padding: 32px 20px; }
      .panel { background: #ffffff; border: 1px solid #e6e4df; border-radius: 8px; padding: 32px; }
      .brand { font-size: 18px; font-weight: 650; margin-bottom: 24px; color: #20201d; }
      p { margin: 0 0 16px; font-size: 15px; line-height: 1.55; }
      .button { display: inline-block; padding: 12px 18px; border-radius: 6px; background: #1f4f46; color: #ffffff !important; text-decoration: none; font-weight: 650; }
      .link { color: #1f4f46; word-break: break-all; }
      .footer { color: #66645f; font-size: 12px; margin-top: 20px; }
      @media (max-width: 520px) { .container { padding: 20px 12px; } .panel { padding: 24px 18px; } }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="panel" role="article" aria-label="Aptly email">
        <div class="brand">Aptly</div>
        ${content}
      </div>
      <p class="footer">This message was sent by Aptly on behalf of the hiring company.</p>
    </div>
  </body>
</html>`;
}
