import { CandidateShell, CandidateStepLink } from "@/components/candidate/candidate-shell";

export default function InProgressPage() {
  return (
    <CandidateShell
      title="Interview already open"
      description="This interview is active in another browser or tab."
      actions={
        <CandidateStepLink href="/candidate/support" variant="secondary">
          Get help
        </CandidateStepLink>
      }
    >
      <p className="text-sm text-muted-foreground">
        Return to the original browser window to continue. This protects your interview from being
        opened in multiple places.
      </p>
    </CandidateShell>
  );
}
