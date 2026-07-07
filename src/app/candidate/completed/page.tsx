import { CandidateShell } from "@/components/candidate/candidate-shell";

export default function CompletedPage() {
  return (
    <CandidateShell
      currentStep="complete"
      title="Interview submitted"
      description="Thank you. Your responses have been saved and will be reviewed by the hiring team."
    >
      <p className="text-sm text-muted-foreground">
        You can close this tab. Contact the hiring team if you need to share anything else.
      </p>
    </CandidateShell>
  );
}
