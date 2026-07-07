"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { candidatePost } from "@/components/candidate/candidate-api";
import { CandidateShell } from "@/components/candidate/candidate-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

const consentTypes = [
  ["INTERVIEW_PARTICIPATION", "I agree to participate in this browser-based interview."],
  ["CAMERA_USE", "I agree to allow camera access during preparation and the interview."],
  ["MICROPHONE_USE", "I agree to allow microphone access during preparation and the interview."],
  ["WEBCAM_SNAPSHOT", "I agree to a webcam snapshot for identity confirmation."],
  [
    "FUTURE_AUDIO_VIDEO_RECORDING",
    "I understand audio/video recording is planned for the interview phase.",
  ],
  [
    "FUTURE_BROWSER_MONITORING",
    "I understand browser monitoring warnings may be used during the interview phase.",
  ],
  ["PRIVACY_NOTICE", "I acknowledge the privacy notice."],
  ["DATA_PROCESSING_RETENTION", "I acknowledge the data processing and retention notice."],
] as const;

export function CandidateConsentForm() {
  const router = useRouter();
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const consents = consentTypes.map(([type]) => ({ type, accepted: checked.has(type) }));
    const requiredAccepted = consents.every((consent) => consent.accepted);
    if (!requiredAccepted) {
      setError(
        "Please review each item. You may request support or withdraw if you cannot consent.",
      );
      return;
    }
    const result = await candidatePost("/api/candidate/consent", { consents });
    if (!result.ok) {
      setError(result.error ?? "Consent could not be saved.");
      return;
    }
    router.push("/candidate/identity");
  }

  return (
    <CandidateShell
      currentStep="consent"
      title="Privacy and consent"
      description="Review each item once. These notices explain what will happen before and during the interview."
      actions={<Button onClick={() => void submit()}>Accept and continue</Button>}
    >
      {error ? (
        <Alert variant="warning">
          <AlertTitle>Review needed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-3">
        {consentTypes.map(([type, label]) => (
          <label key={type} className="flex gap-3 rounded-md border border-border p-3 text-sm">
            <Checkbox
              checked={checked.has(type)}
              onCheckedChange={(value) => {
                const next = new Set(checked);
                if (value === true) next.add(type);
                else next.delete(type);
                setChecked(next);
              }}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </CandidateShell>
  );
}
