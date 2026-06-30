import { CandidateShell, CandidateStepLink } from "@/components/candidate/candidate-shell";

export default function LinkExpiredPage() {
  return (
    <CandidateShell
      title="This interview link cannot be used"
      description="The secure link may have expired or may not match an active invitation."
      actions={
        <CandidateStepLink href="/candidate/support" variant="secondary">
          Contact support
        </CandidateStepLink>
      }
    >
      <p className="text-sm text-muted-foreground">
        For privacy, we cannot confirm invitation details on this page. The hiring team can resend a
        current link if needed.
      </p>
    </CandidateShell>
  );
}
