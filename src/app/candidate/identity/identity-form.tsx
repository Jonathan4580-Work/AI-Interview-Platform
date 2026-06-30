"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { candidatePost } from "@/components/candidate/candidate-api";
import { CandidateShell } from "@/components/candidate/candidate-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

export function IdentityForm() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [name, setName] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      if (videoRef.current !== null) {
        videoRef.current.srcObject = stream;
      }
      setCameraReady(true);
    } catch {
      router.push("/candidate/permission-denied");
    }
  }

  async function submit() {
    if (name.trim().length === 0) {
      setError("Enter your name as it should appear for the hiring team.");
      return;
    }
    const snapshot = {
      storageRef: `candidate-snapshots/pending/${crypto.randomUUID()}`,
      contentType: "image/jpeg",
      sizeBytes: 1,
      checksumSha256: "0".repeat(64),
    };
    const result = await candidatePost("/api/candidate/identity", {
      selfAttestedName: name,
      confirmedName: name,
      snapshot: cameraReady ? snapshot : null,
    });
    if (!result.ok) {
      setError(result.error ?? "Identity confirmation could not be saved.");
      return;
    }
    router.push("/candidate/readiness");
  }

  return (
    <CandidateShell
      title="Confirm your identity"
      description="Confirm your name and allow a webcam snapshot metadata record. The media upload system is not active in this phase."
      actions={
        <>
          <Button variant="secondary" onClick={() => void startCamera()}>
            Enable camera
          </Button>
          <Button onClick={() => void submit()}>Save and continue</Button>
        </>
      }
    >
      {error ? (
        <Alert variant="warning">
          <AlertTitle>Check details</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <FormField label="Full name" htmlFor="candidate-name" required>
        <Input
          id="candidate-name"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
          }}
        />
      </FormField>
      <video
        ref={videoRef}
        className="aspect-video w-full rounded-md border border-border bg-muted"
        autoPlay
        muted
        playsInline
        aria-label="Camera preview"
      />
    </CandidateShell>
  );
}
