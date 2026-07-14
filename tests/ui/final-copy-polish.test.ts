import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { normalizeLabel } from "@/app/(workspace)/_components/hr-ui";

describe("final product copy polish", () => {
  it("formats raw operational labels into user-facing labels", () => {
    expect(normalizeLabel("availability.request_sent")).toBe("Availability Request Sent");
    expect(normalizeLabel("NOT_RECOMMENDED")).toBe("Not Recommended");
    expect(normalizeLabel("INSUFFICIENT_EVIDENCE")).toBe("Insufficient Evidence");
    expect(normalizeLabel("cv_uploaded")).toBe("CV Uploaded");
    expect(normalizeLabel("hr_interview.slot_created")).toBe("HR Interview Slot Created");
  });

  it("keeps HR surfaces free of rough raw labels", () => {
    const surfaces = [
      "src/app/(workspace)/dashboard/page.tsx",
      "src/app/(workspace)/applications/page.tsx",
      "src/app/(workspace)/jobs/[jobId]/page.tsx",
      "src/app/(workspace)/interviews/[interviewSessionId]/page.tsx",
      "src/app/(workspace)/applications/[applicationId]/verification/page.tsx",
    ]
      .map(read)
      .join("\n");

    expect(surfaces).not.toContain("AI:");
    expect(surfaces).not.toContain("No stage");
    expect(surfaces).not.toContain("NOT_RECOMMENDED");
    expect(surfaces).not.toContain("Availability Request_sent");
    expect(surfaces).not.toContain("Slot_created");
  });

  it("keeps candidate support and readiness labels polished", () => {
    const candidateSurfaces = [
      "src/app/candidate/applications/page.tsx",
      "src/app/candidate/readiness/readiness-client.tsx",
      "src/app/candidate/support-forms.tsx",
    ]
      .map(read)
      .join("\n");

    expect(candidateSurfaces).toContain("formatCandidateLabel");
    expect(candidateSurfaces).not.toContain('replaceAll("_", " ").toLowerCase()');
  });
});

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}
