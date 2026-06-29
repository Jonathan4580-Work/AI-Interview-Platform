const sensitiveKeys = new Set([
  "authorization",
  "cookie",
  "password",
  "secret",
  "secretref",
  "signedurl",
  "token",
  "tokenhash",
]);

export function redactAuditValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactAuditValue(item));
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        sensitiveKeys.has(key.toLowerCase()) ? "[redacted]" : redactAuditValue(entry),
      ]),
    );
  }

  return value;
}
