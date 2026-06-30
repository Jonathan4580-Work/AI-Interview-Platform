const sensitiveKeys = new Set([
  "authorization",
  "body",
  "cookie",
  "emailbody",
  "evidenceexcerpt",
  "evidencetext",
  "exporturl",
  "htmlbody",
  "mediaurl",
  "password",
  "prompt",
  "promptcontent",
  "providerpayload",
  "providerresponse",
  "rawprompt",
  "rawresponse",
  "recordingurl",
  "secret",
  "secretref",
  "signedurl",
  "signeddownloadurl",
  "signeduploadurl",
  "textbody",
  "token",
  "tokenhash",
  "transcript",
  "transcriptbody",
  "transcripttext",
]);

export function redactAuditValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactAuditValue(item));
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        sensitiveKeys.has(normalizeAuditKey(key)) ? "[redacted]" : redactAuditValue(entry),
      ]),
    );
  }

  return value;
}

function normalizeAuditKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}
