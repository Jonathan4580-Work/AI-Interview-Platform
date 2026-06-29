import { describe, expect, it } from "vitest";

import { createRequestContext } from "@/shared";

describe("request context", () => {
  it("uses inbound request and correlation ids when present", () => {
    const context = createRequestContext(
      {
        get(name: string) {
          return {
            "x-request-id": "req-1",
            "x-correlation-id": "corr-1",
          }[name] ?? null;
        },
      },
      {
        requestIdHeader: "x-request-id",
        correlationIdHeader: "x-correlation-id",
      },
    );

    expect(context).toEqual({
      requestId: "req-1",
      correlationId: "corr-1",
    });
  });

  it("uses request id as correlation id when correlation id is absent", () => {
    const context = createRequestContext(
      {
        get(name: string) {
          return name === "x-request-id" ? "req-1" : null;
        },
      },
      {
        requestIdHeader: "x-request-id",
        correlationIdHeader: "x-correlation-id",
      },
    );

    expect(context).toEqual({
      requestId: "req-1",
      correlationId: "req-1",
    });
  });

  it("generates ids when inbound ids are absent", () => {
    const context = createRequestContext(
      {
        get() {
          return null;
        },
      },
      {
        requestIdHeader: "x-request-id",
        correlationIdHeader: "x-correlation-id",
      },
    );

    expect(context.requestId).toHaveLength(36);
    expect(context.correlationId).toBe(context.requestId);
  });
});
