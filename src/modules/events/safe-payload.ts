const restrictedKeyFragments = [
  "secret",
  "password",
  "token",
  "transcript",
  "prompt",
  "evidence",
  "providerpayload",
  "providerresponse",
  "mediaurl",
  "signedurl",
  "note",
  "accommodation",
  "identitysnapshot",
] as const;

const restrictedStringMarkers = ["http://", "https://", "bearer ", "-----begin", "password"];

export class EventPayloadSafetyError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "EventPayloadSafetyError";
  }
}

export function assertSafeEventPayload(
  payload: unknown,
): asserts payload is Record<string, unknown> {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    throw new EventPayloadSafetyError("Event payload must be an object.");
  }

  inspectValue(payload, "$");
}

export function createEventPayloadAllowlist<TAllowedKey extends string>(
  allowedKeys: readonly TAllowedKey[],
): (payload: Readonly<Record<string, unknown>>) => Readonly<Record<TAllowedKey, unknown>> {
  const allowed = new Set<string>(allowedKeys);
  return (payload) => {
    assertSafeEventPayload(payload);
    const extra = Object.keys(payload).filter((key) => !allowed.has(key));
    if (extra.length > 0) {
      throw new EventPayloadSafetyError(
        `Event payload contains non-allowlisted keys: ${extra.join(", ")}.`,
      );
    }
    return payload;
  };
}

function inspectValue(value: unknown, path: string): void {
  if (Array.isArray(value)) {
    if (value.length > 100) {
      throw new EventPayloadSafetyError(`Event payload array is too large at ${path}.`);
    }
    value.forEach((item, index) => {
      inspectValue(item, `${path}[${String(index)}]`);
    });
    return;
  }

  if (value !== null && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      const normalizedKey = normalizeKey(key);
      if (restrictedKeyFragments.some((fragment) => normalizedKey.includes(fragment))) {
        throw new EventPayloadSafetyError(
          `Event payload contains restricted key at ${path}.${key}.`,
        );
      }
      inspectValue(entry, `${path}.${key}`);
    }
    return;
  }

  if (typeof value === "string") {
    if (value.length > 500) {
      throw new EventPayloadSafetyError(`Event payload string is too large at ${path}.`);
    }
    const normalized = value.toLowerCase();
    if (restrictedStringMarkers.some((marker) => normalized.includes(marker))) {
      throw new EventPayloadSafetyError(`Event payload contains restricted value at ${path}.`);
    }
  }
}

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}
