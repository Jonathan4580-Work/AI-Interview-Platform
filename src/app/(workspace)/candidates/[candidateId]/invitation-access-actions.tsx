"use client";

import { useState } from "react";
import { Copy, ExternalLink, MailOpen } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { InvitationPreviewSummary } from "@/server/hr-workspace/invitation-preview";

interface InvitationAccessActionsProps {
  readonly invitationId: string;
  readonly summary: InvitationPreviewSummary | null;
}

interface CandidateLinkResponse {
  readonly ok: boolean;
  readonly data?: {
    readonly candidateUrl?: string;
  };
}

export function InvitationAccessActions({ invitationId, summary }: InvitationAccessActionsProps) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  if (!summary?.linkAvailable) {
    return null;
  }

  const previewHref = `/api/internal/v1/invitations/${encodeURIComponent(invitationId)}/preview`;
  const candidateHref = `/api/internal/v1/invitations/${encodeURIComponent(
    invitationId,
  )}/candidate-link?mode=redirect`;

  async function copyCandidateLink() {
    setCopyState("idle");
    try {
      const response = await fetch(
        `/api/internal/v1/invitations/${encodeURIComponent(invitationId)}/candidate-link`,
        {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
        },
      );
      const body = (await response.json()) as CandidateLinkResponse;
      const candidateUrl = body.data?.candidateUrl;
      if (!response.ok || !body.ok || typeof candidateUrl !== "string") {
        throw new Error("Candidate link was not returned.");
      }
      await navigator.clipboard.writeText(candidateUrl);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
      {summary.previewAvailable ? (
        <Button asChild size="sm" variant="secondary">
          <a href={previewHref} target="_blank" rel="noreferrer">
            <MailOpen aria-hidden="true" />
            View email preview
          </a>
        </Button>
      ) : null}
      <Button asChild size="sm" variant="secondary">
        <a href={candidateHref} target="_blank" rel="noreferrer">
          <ExternalLink aria-hidden="true" />
          Open candidate experience
        </a>
      </Button>
      <Button type="button" size="sm" variant="secondary" onClick={() => void copyCandidateLink()}>
        <Copy aria-hidden="true" />
        {copyState === "copied"
          ? "Copied"
          : copyState === "failed"
            ? "Copy failed"
            : "Copy candidate link"}
      </Button>
    </div>
  );
}
