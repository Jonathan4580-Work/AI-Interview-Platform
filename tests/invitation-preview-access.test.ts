import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  getInvitationDeliveryLabel,
  isInvitationLinkUsable,
} from "@/server/hr-workspace/invitation-preview";

const root = process.cwd();

describe("invitation preview access", () => {
  it("uses preview-specific delivery language", () => {
    expect(getInvitationDeliveryLabel("PREVIEW", "SENT")).toBe("Preview generated");
    expect(getInvitationDeliveryLabel("SMTP", "SENT")).toBe("Email sent");
    expect(getInvitationDeliveryLabel("SMTP", "DELIVERED")).toBe("Email delivered");
  });

  it("denies expired, revoked, consumed, and terminal invitations", () => {
    const future = new Date("2026-07-05T00:00:00.000Z");
    const now = new Date("2026-07-02T00:00:00.000Z");
    expect(
      isInvitationLinkUsable(
        {
          status: "SENT",
          expiresAt: future,
          tokenConsumedAt: null,
          tokenRevokedAt: null,
        },
        now,
      ),
    ).toBe(true);
    expect(
      isInvitationLinkUsable(
        {
          status: "SENT",
          expiresAt: new Date("2026-07-01T00:00:00.000Z"),
          tokenConsumedAt: null,
          tokenRevokedAt: null,
        },
        now,
      ),
    ).toBe(false);
    expect(
      isInvitationLinkUsable(
        {
          status: "SENT",
          expiresAt: future,
          tokenConsumedAt: now,
          tokenRevokedAt: null,
        },
        now,
      ),
    ).toBe(false);
    expect(
      isInvitationLinkUsable(
        {
          status: "SENT",
          expiresAt: future,
          tokenConsumedAt: null,
          tokenRevokedAt: now,
        },
        now,
      ),
    ).toBe(false);
    expect(
      isInvitationLinkUsable(
        {
          status: "CANCELLED",
          expiresAt: future,
          tokenConsumedAt: null,
          tokenRevokedAt: null,
        },
        now,
      ),
    ).toBe(false);
  });

  it("keeps broad candidate page data free of raw candidate links", () => {
    const pageSource = readFileSync(
      join(root, "src/app/(workspace)/candidates/[candidateId]/page.tsx"),
      "utf8",
    );
    expect(pageSource).toContain("listInvitationPreviewSummaries");
    expect(pageSource).not.toContain("candidateUrl");
    expect(pageSource).not.toContain("actionUrl");
  });

  it("requires invitation permission and avoids token-bearing audit metadata in access routes", () => {
    const previewRoute = readFileSync(
      join(root, "src/app/api/internal/v1/invitations/[invitationId]/preview/route.ts"),
      "utf8",
    );
    const linkRoute = readFileSync(
      join(root, "src/app/api/internal/v1/invitations/[invitationId]/candidate-link/route.ts"),
      "utf8",
    );
    expect(previewRoute).toContain('requirePermissionForContext(auth, "invitations:read")');
    expect(linkRoute).toContain('requirePermissionForContext(auth, "invitations:read")');
    expect(previewRoute).toContain("invitation.email_preview.viewed");
    expect(linkRoute).toContain("invitation.candidate_link.accessed");
    expect(previewRoute).not.toContain("candidateUrl:");
    expect(linkRoute).not.toContain("url: access.candidateUrl");
    expect(linkRoute).not.toContain("metadata: access.candidateUrl");
  });

  it("renders preview and copy/open actions only through narrow access endpoints", () => {
    const actionsSource = readFileSync(
      join(root, "src/app/(workspace)/candidates/[candidateId]/invitation-access-actions.tsx"),
      "utf8",
    );
    expect(actionsSource).toContain("View email preview");
    expect(actionsSource).toContain("Open candidate experience");
    expect(actionsSource).toContain("Copy candidate link");
    expect(actionsSource).toContain("/candidate-link?mode=redirect");
    expect(actionsSource).not.toContain("actionUrl");
  });
});
