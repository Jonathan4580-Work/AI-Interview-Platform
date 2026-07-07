"use client";

import { useState } from "react";
import Link from "next/link";

import { candidatePost } from "@/components/candidate/candidate-api";
import { CandidateShell } from "@/components/candidate/candidate-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function ReadyClient() {
  const [confirmed, setConfirmed] = useState(false);

  async function confirm() {
    const result = await candidatePost("/api/candidate/ready");
    setConfirmed(result.ok);
  }

  return (
    <CandidateShell
      currentStep="interview"
      title="Ready to start"
      description="Confirm when your camera, microphone, and environment are ready. The interview room opens next."
      actions={<Button onClick={() => void confirm()}>Confirm readiness</Button>}
    >
      {confirmed ? (
        <Alert variant="success">
          <AlertTitle>Readiness confirmed</AlertTitle>
          <AlertDescription>
            You can continue to the interview room when you are ready.
          </AlertDescription>
        </Alert>
      ) : (
        <p className="text-sm text-muted-foreground">
          Confirm when your camera, microphone, and environment are ready.
        </p>
      )}
      {confirmed ? (
        <Button asChild>
          <Link href="/candidate/interview">Open interview room</Link>
        </Button>
      ) : null}
    </CandidateShell>
  );
}
