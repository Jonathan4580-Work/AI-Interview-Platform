import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("Phase 11 accessibility audit documentation", () => {
  it("records WCAG 2.2 AA scope and manual browser checks still required", () => {
    const audit = readFileSync(join(process.cwd(), "docs", "ACCESSIBILITY_AUDIT.md"), "utf8");

    expect(audit).toContain("WCAG 2.2 AA");
    expect(audit).toContain("Keyboard");
    expect(audit).toContain("Screen-reader");
    expect(audit).toContain("camera/microphone permission denial");
    expect(audit).toContain("Reduced-motion");
  });
});
