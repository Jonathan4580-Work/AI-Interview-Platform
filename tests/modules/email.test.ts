import { describe, expect, it } from "vitest";

import {
  EmailTemplateError,
  EnvironmentSmtpSecretResolver,
  PreviewEmailProvider,
  getDefaultEmailTemplate,
  renderEmailTemplate,
} from "@/modules/email";

describe("email template rendering", () => {
  it("escapes untrusted variables in html while preserving plain text", () => {
    const rendered = renderEmailTemplate(getDefaultEmailTemplate("interview_invitation"), {
      companyName: "Acme <script>",
      recipientName: "Ada",
      supportEmail: "help@example.com",
      actionUrl: "https://example.com/interview?token=<unsafe>",
      expirationDate: new Date("2026-07-01T10:30:00.000Z"),
      jobTitle: "Engineer",
      estimatedDuration: "35 minutes",
      interviewWindow: "June 30 to July 1",
    });

    expect(rendered.subject).toContain("Acme <script>");
    expect(rendered.html).toContain("Acme &lt;script&gt;");
    expect(rendered.html).toContain("token=&lt;unsafe&gt;");
    expect(rendered.html).not.toContain("<script>");
    expect(rendered.text).toContain("Acme <script>");
    expect(rendered.text).toContain("Webcam and microphone access will be required");
  });

  it("rejects missing and unsupported variables", () => {
    const template = getDefaultEmailTemplate("password_reset");

    expect(() =>
      renderEmailTemplate(template, {
        companyName: "Aptly",
        recipientName: "Ada",
        supportEmail: "help@example.com",
        actionUrl: "https://example.com/reset",
        expirationDate: null,
      }),
    ).toThrow(EmailTemplateError);

    expect(() =>
      renderEmailTemplate(template, {
        companyName: "Aptly",
        recipientName: "Ada",
        supportEmail: "help@example.com",
        actionUrl: "https://example.com/reset",
        expirationDate: "Tomorrow",
        rawHtml: "<b>unsafe</b>",
      }),
    ).toThrow(EmailTemplateError);
  });
});

describe("preview email provider", () => {
  it("accepts messages without contacting external SMTP infrastructure", async () => {
    const provider = new PreviewEmailProvider();
    const result = await provider.send({
      from: { email: "no-reply@aptly.test", name: "Aptly" },
      to: { email: "candidate@example.com", name: "Candidate" },
      subject: "Preview",
      html: "<p>Hello</p>",
      text: "Hello",
    });

    expect(result.provider).toBe("preview");
    expect(result.providerMessageId).toMatch(/^preview_/u);
    expect(result.accepted).toEqual(["candidate@example.com"]);
    expect(result.rejected).toEqual([]);
  });
});

describe("SMTP secret resolver", () => {
  it("resolves only configured secret references", async () => {
    const resolver = new EnvironmentSmtpSecretResolver({
      NODE_ENV: "test",
      SMTP_SECRET_REF: "tenant/acme/smtp",
      SMTP_USERNAME: "mailer",
      SMTP_PASSWORD: "secret",
    });

    await expect(resolver.resolve("tenant/acme/smtp")).resolves.toEqual({
      username: "mailer",
      password: "secret",
    });
    await expect(resolver.resolve("tenant/other/smtp")).rejects.toThrow(
      "SMTP secret reference is not available.",
    );
  });
});
