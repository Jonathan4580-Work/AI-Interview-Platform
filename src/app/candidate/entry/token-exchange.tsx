"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { CandidateShell } from "@/components/candidate/candidate-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function CandidateEntryClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Opening your secure interview link.");

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/u, ""));
    const token = hashParams.get("token") ?? searchParams.get("token");
    window.history.replaceState(null, "", "/candidate/entry");
    if (token === null || token.trim().length === 0) {
      router.replace("/candidate/link-expired");
      return;
    }

    void fetch("/api/candidate/exchange", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (response) => {
        const payload = (await response.json()) as {
          readonly ok: boolean;
          readonly data?: {
            readonly accepted?: boolean;
            readonly reason?: string;
            readonly nextPath?: string;
          };
        };
        if (!response.ok || !payload.ok || payload.data?.accepted !== true) {
          const reason = payload.data?.reason;
          const path =
            reason === "revoked"
              ? "/candidate/link-revoked"
              : reason === "completed"
                ? "/candidate/completed"
                : reason === "in_progress"
                  ? "/candidate/in-progress"
                  : "/candidate/link-expired";
          router.replace(path);
          return;
        }
        router.replace(payload.data.nextPath ?? "/candidate/welcome");
      })
      .catch(() => {
        setMessage("We could not open this link. Please check your connection and try again.");
      });
  }, [router, searchParams]);

  return (
    <CandidateShell
      title="Preparing your interview"
      description="We are validating your secure link and setting up a private browser session."
    >
      <Alert variant="info">
        <AlertTitle>Please keep this tab open</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    </CandidateShell>
  );
}
