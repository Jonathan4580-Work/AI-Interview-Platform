import { CandidateShell, CandidateStepLink } from "@/components/candidate/candidate-shell";

export default function CandidateWelcomePage() {
  return (
    <CandidateShell
      currentStep="welcome"
      title="Welcome to your interview"
      description="This guided setup takes a few minutes. We will confirm consent, verify camera and microphone access, and then open the interview room."
      actions={
        <CandidateStepLink href="/candidate/privacy-consent">Start guided setup</CandidateStepLink>
      }
    >
      <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
        <p className="rounded-md border border-border bg-background p-3">
          Use a desktop or laptop where possible.
        </p>
        <p className="rounded-md border border-border bg-background p-3">
          Camera and microphone access are required.
        </p>
        <p className="rounded-md border border-border bg-background p-3">
          Choose a quiet place with a stable internet connection.
        </p>
        <p className="rounded-md border border-border bg-background p-3">
          Support and accommodations are available before you start.
        </p>
      </div>
    </CandidateShell>
  );
}
