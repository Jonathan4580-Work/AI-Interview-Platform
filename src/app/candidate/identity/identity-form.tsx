"use client";

import { useEffect, useRef, useState } from "react";
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
  const streamRef = useRef<MediaStream | null>(null);
  const [name, setName] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });
    };
  }, []);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
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
    const snapshot = cameraReady ? await captureSnapshotMetadata(videoRef.current) : null;
    const result = await candidatePost("/api/candidate/identity", {
      selfAttestedName: name,
      confirmedName: name,
      snapshot,
    });
    if (!result.ok) {
      setError(result.error ?? "Identity confirmation could not be saved.");
      return;
    }
    router.push("/candidate/readiness");
  }

  return (
    <CandidateShell
      currentStep="identity"
      title="Confirm your identity"
      description="Confirm your name and enable the camera preview so the hiring team can connect this interview to the right candidate."
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

async function captureSnapshotMetadata(video: HTMLVideoElement | null): Promise<{
  readonly storageRef: string;
  readonly contentType: "image/jpeg";
  readonly sizeBytes: number;
  readonly checksumSha256: string;
} | null> {
  if (video === null || video.videoWidth === 0 || video.videoHeight === 0) {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext("2d");
  if (context === null) {
    return null;
  }
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.82);
  });
  if (blob === null) {
    return null;
  }
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return {
    storageRef: `candidate-snapshots/pending/${crypto.randomUUID()}`,
    contentType: "image/jpeg",
    sizeBytes: blob.size,
    checksumSha256: Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join(""),
  };
}
