"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { candidatePost } from "@/components/candidate/candidate-api";
import { CandidateShell } from "@/components/candidate/candidate-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface CheckResult {
  readonly type: string;
  readonly status: "PASS" | "WARNING" | "FAIL";
  readonly details: Record<string, unknown>;
}

export function DeviceReadiness() {
  const router = useRouter();
  const [checks, setChecks] = useState<readonly CheckResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function runChecks() {
    const next: CheckResult[] = [];
    next.push({
      type: "SECURE_CONTEXT",
      status: window.isSecureContext ? "PASS" : "FAIL",
      details: {},
    });
    next.push({
      type: "MEDIA_DEVICES",
      status: "mediaDevices" in navigator ? "PASS" : "FAIL",
      details: {},
    });
    next.push({
      type: "BROWSER",
      status: "mediaDevices" in navigator ? "PASS" : "FAIL",
      details: { userAgent: navigator.userAgent },
    });
    next.push({
      type: "DEVICE",
      status: /Mobi|Android/u.test(navigator.userAgent) ? "WARNING" : "PASS",
      details: {},
    });
    next.push({
      type: "SCREEN_SIZE",
      status: window.innerWidth < 900 ? "WARNING" : "PASS",
      details: { width: window.innerWidth, height: window.innerHeight },
    });
    next.push({
      type: "NETWORK",
      status: "onLine" in navigator && navigator.onLine ? "PASS" : "WARNING",
      details: {},
    });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      next.push({ type: "CAMERA", status: "PASS", details: { previewAvailable: true } });
      next.push({ type: "MICROPHONE", status: "PASS", details: { inputAvailable: true } });
      stream.getTracks().forEach((track) => {
        track.stop();
      });
    } catch {
      next.push({ type: "CAMERA", status: "FAIL", details: { reason: "permission_denied" } });
      next.push({ type: "MICROPHONE", status: "FAIL", details: { reason: "permission_denied" } });
    }
    next.push({
      type: "AUDIO_OUTPUT",
      status: "WARNING",
      details: { selectableOutput: "setSinkId" in HTMLMediaElement.prototype },
    });
    setChecks(next);
    const result = await candidatePost("/api/candidate/readiness", { checks: next });
    if (!result.ok) {
      setError(result.error ?? "Readiness results could not be saved.");
    }
  }

  const hasFailure = checks.some((check) => check.status === "FAIL");

  return (
    <CandidateShell
      title="Device readiness"
      description="Check browser support, permissions, connection basics, and device guidance before you continue."
      actions={
        <>
          <Button variant="secondary" onClick={() => void runChecks()}>
            Run checks
          </Button>
          <Button
            disabled={checks.length === 0 || hasFailure}
            onClick={() => {
              router.push("/candidate/instructions");
            }}
          >
            Continue
          </Button>
        </>
      }
    >
      {error ? (
        <Alert variant="warning">
          <AlertTitle>Results not saved</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-2">
        {checks.map((check) => (
          <div
            key={check.type}
            className="flex items-center justify-between rounded-md border border-border p-3 text-sm"
          >
            <span>{check.type.replaceAll("_", " ").toLowerCase()}</span>
            <Badge
              variant={
                check.status === "PASS"
                  ? "success"
                  : check.status === "WARNING"
                    ? "warning"
                    : "danger"
              }
            >
              {check.status}
            </Badge>
          </div>
        ))}
      </div>
      {hasFailure ? (
        <Alert variant="danger">
          <AlertTitle>Permission recovery needed</AlertTitle>
          <AlertDescription>
            Allow camera and microphone access in your browser settings, then retry.
          </AlertDescription>
        </Alert>
      ) : null}
    </CandidateShell>
  );
}
