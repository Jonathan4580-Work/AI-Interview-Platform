import { describe, expect, it } from "vitest";

import { createHealthSnapshot } from "@/modules/observability";

describe("health snapshots", () => {
  it("reports ok when all dependencies are ok", () => {
    expect(
      createHealthSnapshot([
        {
          name: "database",
          state: "ok",
        },
      ]),
    ).toEqual({
      state: "ok",
      dependencies: [
        {
          name: "database",
          state: "ok",
        },
      ],
    });
  });

  it("reports degraded when any dependency is degraded", () => {
    expect(
      createHealthSnapshot([
        {
          name: "database",
          state: "ok",
        },
        {
          name: "redis",
          state: "degraded",
        },
      ]).state,
    ).toBe("degraded");
  });
});
