import { DefaultEmailProviderFactory } from "@/modules/email/provider-factory";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (value === undefined || value.length === 0) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

async function main(): Promise<void> {
  if (process.env.APP_ENV !== "development") {
    throw new Error("Local SMTP smoke requires APP_ENV=development.");
  }

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
    to: {
      email: required("LOCAL_SMTP_TEST_RECIPIENT"),
      name: "Aptly local tester",
    },
    subject: "Aptly local SMTP smoke test",
    html: "<p>This is a local Aptly SMTP smoke test.</p>",
    text: "This is a local Aptly SMTP smoke test.",
    headers: {
      "X-Aptly-Smoke-Test": "local-smtp",
    },
  });

  console.log(
    [
      "Local SMTP smoke PASSED",
      `Provider: ${result.provider}`,
      `Provider message ID: ${result.providerMessageId ?? "not returned"}`,
      `Accepted recipients: ${String(result.accepted.length)}`,
      `Rejected recipients: ${String(result.rejected.length)}`,
      "",
    ].join("\n"),
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown local SMTP smoke failure.";
  console.error(`Local SMTP smoke FAILED: ${message}`);
  process.exitCode = 1;
});
