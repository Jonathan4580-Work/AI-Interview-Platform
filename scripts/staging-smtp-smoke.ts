import { stdout as output } from "node:process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { DefaultEmailProviderFactory } from "../src/modules/email/provider-factory";

function assertStagingOnly(): void {
  if (process.env.APP_ENV !== "staging") {
    throw new Error("SMTP smoke requires APP_ENV=staging.");
  }
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (value === undefined || value.length === 0) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

async function run(): Promise<void> {
  assertStagingOnly();
  const recipient = required("STAGING_SMTP_TEST_RECIPIENT");
  const provider = new DefaultEmailProviderFactory().createProvider({
    provider: "smtp",
    smtpProfile: null,
  });
  const result = await provider.send({
    from: {
      email: required("SMTP_FROM_EMAIL"),
      name: process.env.SMTP_FROM_NAME?.trim() ?? "Aptly",
    },
    replyTo:
      process.env.SMTP_REPLY_TO_EMAIL === undefined
        ? null
        : { email: process.env.SMTP_REPLY_TO_EMAIL.trim() },
    to: { email: recipient, name: "Aptly staging tester" },
    subject: "Aptly staging SMTP smoke test",
    html: "<p>This is a staging-only Aptly SMTP smoke test.</p>",
    text: "This is a staging-only Aptly SMTP smoke test.",
    headers: {
      "X-Aptly-Smoke-Test": "staging-smtp",
    },
  });

  output.write(
    [
      "SMTP smoke PASSED",
      `Provider: ${result.provider}`,
      `Provider message ID: ${result.providerMessageId ?? "not returned"}`,
      `Accepted recipients: ${String(result.accepted.length)}`,
      `Rejected recipients: ${String(result.rejected.length)}`,
      "",
    ].join("\n"),
  );
}

const executedPath = resolve(process.argv[1] ?? "");
if (fileURLToPath(import.meta.url) === executedPath) {
  run().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown SMTP smoke failure.";
    console.error(`SMTP smoke FAILED: ${message}`);
    process.exitCode = 1;
  });
}
