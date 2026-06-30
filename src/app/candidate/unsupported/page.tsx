import { CandidateShell, CandidateStepLink } from "@/components/candidate/candidate-shell";

export default function UnsupportedPage() {
  return (
    <CandidateShell
      title="Use a supported browser"
      description="This preparation flow requires a secure browser with camera and microphone APIs."
      actions={
        <CandidateStepLink href="/candidate/readiness" variant="secondary">
          Check again
        </CandidateStepLink>
      }
    >
      <ul className="grid gap-2 text-sm text-muted-foreground">
        <li>Use the latest Chrome, Edge, Safari, or Firefox.</li>
        <li>Open the link over HTTPS or localhost.</li>
        <li>Use a desktop or laptop when available.</li>
      </ul>
    </CandidateShell>
  );
}
