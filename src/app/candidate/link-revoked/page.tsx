import { CandidateShell, CandidateStepLink } from "@/components/candidate/candidate-shell";

export default function LinkRevokedPage() {
  return (
    <CandidateShell
      title="This interview link was replaced"
      description="A newer secure link may have been issued for your interview."
      actions={
        <CandidateStepLink href="/candidate/support" variant="secondary">
          Contact support
        </CandidateStepLink>
      }
    >
      <p className="text-sm text-muted-foreground">
        Please use the most recent email from the hiring team, or request help if you are unsure
        which link is current.
      </p>
    </CandidateShell>
  );
}
