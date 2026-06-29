import { describe, expect, it } from "vitest";

import { AuditWriter, redactAuditValue } from "@/modules/audit";
import { createTenantContext } from "@/modules/tenant";

import type { AuditEventStore, PersistedAuditEventInput } from "@/modules/audit";

class RecordingAuditStore implements AuditEventStore {
  public readonly events: PersistedAuditEventInput[] = [];

  public append(event: PersistedAuditEventInput): Promise<void> {
    this.events.push(event);
    return Promise.resolve();
  }
}

describe("audit module", () => {
  it("redacts sensitive nested audit values", () => {
    expect(
      redactAuditValue({
        safe: "value",
        Token: "secret-token",
        nested: {
          signedUrl: "https://example.com/private",
        },
      }),
    ).toEqual({
      safe: "value",
      Token: "[redacted]",
      nested: {
        signedUrl: "[redacted]",
      },
    });
  });

  it("appends audit events with request and actor context", async () => {
    const store = new RecordingAuditStore();
    const writer = new AuditWriter(store);
    const tenant = createTenantContext("cm0tenant001");

    await writer.record({
      companyId: tenant.companyId,
      actor: {
        type: "user",
        id: "user-1",
      },
      request: {
        requestId: "req-1",
        correlationId: "corr-1",
        sessionId: "sess-1",
        ipAddress: "127.0.0.1",
        userAgent: "vitest",
      },
      action: "tenant.read",
      resourceType: "tenant",
      resourceId: tenant.companyId,
      metadata: {
        token: "secret-token",
      },
    });

    expect(store.events).toHaveLength(1);
    expect(store.events[0]).toMatchObject({
      companyId: "cm0tenant001",
      actorType: "user",
      actorId: "user-1",
      requestId: "req-1",
      correlationId: "corr-1",
      action: "tenant.read",
      riskLevel: "low",
      metadata: {
        token: "[redacted]",
      },
    });
  });
});
