import { CandidateShell, CandidateStepLink } from "@/components/candidate/candidate-shell";

export default function CandidateWelcomePage() {
  return (
    <CandidateShell
      title="Welcome"
      description="Before the interview begins, we will confirm your details, capture consent, and check that your browser is ready."
      actions={
        <CandidateStepLink href="/candidate/privacy-consent">
          Review privacy and consent
        </CandidateStepLink>
      }
    >
      <ul className="grid gap-3 text-sm text-muted-foreground">
        <li>Use a desktop or laptop where possible.</li>
        <li>Camera and microphone access are required for the interview.</li>
        <li>Choose a quiet place with a stable internet connection.</li>
        <li>You can request support or accommodations at any point before starting.</li>
      </ul>
    </CandidateShell>
  );
}
