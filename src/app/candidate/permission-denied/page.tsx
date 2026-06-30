import { CandidateShell, CandidateStepLink } from "@/components/candidate/candidate-shell";

export default function PermissionDeniedPage() {
  return (
    <CandidateShell
      title="Camera or microphone access is blocked"
      description="Your browser needs permission before you can continue."
      actions={
        <CandidateStepLink href="/candidate/readiness" variant="secondary">
          Retry device check
        </CandidateStepLink>
      }
    >
      <ul className="grid gap-2 text-sm text-muted-foreground">
        <li>Open browser site settings for this page.</li>
        <li>Allow camera and microphone access.</li>
        <li>Close other applications that may be using your camera.</li>
      </ul>
    </CandidateShell>
  );
}
