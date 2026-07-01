import { createHmac, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

export class WebhookSecurityError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "WebhookSecurityError";
  }
}

export function signWebhook(input: {
  readonly secret: string;
  readonly timestamp: number;
  readonly eventId: string;
  readonly body: string;
}): string {
  const canonical = `${String(input.timestamp)}.${input.eventId}.${input.body}`;
  return `sha256=${createHmac("sha256", input.secret).update(canonical).digest("hex")}`;
}

export function verifyWebhookSignature(input: {
  readonly signature: string;
  readonly secret: string;
  readonly timestamp: number;
  readonly eventId: string;
  readonly body: string;
  readonly now?: Date;
  readonly toleranceSeconds?: number;
}): void {
  const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000);
  const tolerance = input.toleranceSeconds ?? 300;
  if (Math.abs(nowSeconds - input.timestamp) > tolerance) {
    throw new WebhookSecurityError("Webhook timestamp is outside the replay window.");
  }

  const expected = signWebhook(input);
  if (!timingSafeStringEqual(expected, input.signature)) {
    throw new WebhookSecurityError("Webhook signature verification failed.");
  }
}

export function validateWebhookEndpoint(
  endpointUrl: string,
  options: { readonly production?: boolean } = {},
): URL {
  let parsed: URL;
  try {
    parsed = new URL(endpointUrl);
  } catch {
    throw new WebhookSecurityError("Webhook endpoint must be a valid URL.");
  }

  if (parsed.username.length > 0 || parsed.password.length > 0) {
    throw new WebhookSecurityError("Webhook endpoint must not include credentials.");
  }
  if (options.production === true && parsed.protocol !== "https:") {
    throw new WebhookSecurityError("Webhook endpoint must use HTTPS in production.");
  }
  if (!["https:", "http:"].includes(parsed.protocol)) {
    throw new WebhookSecurityError("Webhook endpoint protocol is not allowed.");
  }
  if (isUnsafeHost(parsed.hostname)) {
    throw new WebhookSecurityError("Webhook endpoint host is not allowed.");
  }

  return parsed;
}

export function validateWebhookRedirect(input: {
  readonly originalEndpoint: string;
  readonly redirectEndpoint: string;
  readonly production?: boolean;
}): URL {
  const original = validateWebhookEndpoint(input.originalEndpoint, {
    production: input.production,
  });
  const redirect = validateWebhookEndpoint(input.redirectEndpoint, {
    production: input.production,
  });

  if (redirect.protocol !== original.protocol) {
    throw new WebhookSecurityError("Webhook redirects must not downgrade or change protocol.");
  }
  return redirect;
}

export function validateWebhookResolvedAddresses(input: {
  readonly hostname: string;
  readonly addresses: readonly string[];
}): void {
  if (input.addresses.length === 0) {
    throw new WebhookSecurityError("Webhook endpoint DNS resolution returned no addresses.");
  }
  for (const address of input.addresses) {
    if (isUnsafeHost(address)) {
      throw new WebhookSecurityError(
        "Webhook endpoint resolved to a private or otherwise unsafe address.",
      );
    }
  }
}

export function assertWebhookReplayAllowed(input: {
  readonly eventId: string;
  readonly seenEventIds: ReadonlySet<string>;
}): void {
  if (input.seenEventIds.has(input.eventId)) {
    throw new WebhookSecurityError("Webhook event has already been processed.");
  }
}

function timingSafeStringEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.byteLength !== rightBuffer.byteLength) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function isUnsafeHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[/u, "").replace(/\]$/u, "");
  if (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized === "metadata.google.internal"
  ) {
    return true;
  }

  const ipKind = isIP(normalized);
  if (ipKind === 0) {
    return false;
  }

  if (ipKind === 4) {
    const parts = normalized.split(".").map((part) => Number.parseInt(part, 10));
    const [first = 0, second = 0] = parts;
    return (
      first === 0 ||
      first === 10 ||
      first === 127 ||
      (first === 100 && second >= 64 && second <= 127) ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 0) ||
      (first === 192 && second === 168) ||
      (first === 198 && (second === 18 || second === 19)) ||
      first >= 224
    );
  }

  if (normalized.startsWith("::ffff:")) {
    return isUnsafeHost(normalized.slice(7));
  }

  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  );
}
