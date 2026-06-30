import { CandidateShell } from "@/components/candidate/candidate-shell";

export default function CompletedPage() {
  return (
    <CandidateShell
      title="Interview already completed"
      description="This invitation has already been completed and cannot be opened again."
    >
      <p className="text-sm text-muted-foreground">
        Contact the hiring team if you believe this is incorrect.
      </p>
    </CandidateShell>
  );
}
