import { CandidateShell, CandidateStepLink } from "@/components/candidate/candidate-shell";

export default function InstructionsPage() {
  return (
    <CandidateShell
      title="Interview instructions"
      description="These steps help create a consistent interview environment."
      actions={<CandidateStepLink href="/candidate/ready">I am ready</CandidateStepLink>}
    >
      <ul className="grid gap-2 text-sm text-muted-foreground">
        <li>Keep this browser tab open.</li>
        <li>Close apps that may use your camera or microphone.</li>
        <li>Use headphones if your environment is noisy.</li>
        <li>Have your accessibility tools ready before continuing.</li>
      </ul>
    </CandidateShell>
  );
}
