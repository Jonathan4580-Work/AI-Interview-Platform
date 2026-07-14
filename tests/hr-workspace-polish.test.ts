import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("HR workspace polish", () => {
  it("turns the jobs page into an operational job workspace", () => {
    const page = source("src/app/(workspace)/jobs/page.tsx");

    expect(page).toContain("Open jobs");
    expect(page).toContain("Applications");
    expect(page).toContain("Published plans");
    expect(page).toContain("Needs plan");
    expect(page).toContain("Interview plan ready");
    expect(page).toContain("Open job");
    expect(page).toContain("Review plan");
    expect(page).toContain("summarizeJobs");
  });

  it("turns the interviews page into a progress and results workspace", () => {
    const page = source("src/app/(workspace)/interviews/page.tsx");

    expect(page).toContain("Active interviews");
    expect(page).toContain("Completed");
    expect(page).toContain("Processing");
    expect(page).toContain("Results ready");
    expect(page).toContain("View Results");
    expect(page).toContain("View Progress");
    expect(page).toContain("HR review");
    expect(page).toContain("summarizeInterviews");
  });

  it("keeps HR list pages free of mojibake separators", () => {
    const pages = [
      source("src/app/(workspace)/jobs/page.tsx"),
      source("src/app/(workspace)/interviews/page.tsx"),
      source("src/app/(workspace)/applications/page.tsx"),
    ];

    for (const page of pages) {
      expect(page).not.toContain("Â");
    }
  });
});
