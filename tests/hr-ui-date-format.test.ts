import { describe, expect, it } from "vitest";

import { formatDate } from "@/app/(workspace)/_components/hr-ui";

describe("HR date formatting", () => {
  it("formats invitation timestamps in the staging default timezone with an offset", () => {
    expect(formatDate("2026-07-03T11:42:00.000Z")).toBe("Jul 3, 2026, 5:12 PM GMT+5:30");
  });
});
