import { CandidateShell, CandidateStepLink } from "@/components/candidate/candidate-shell";

export default function InstructionsPage() {
  return (
    <CandidateShell
      currentStep="readiness"
      title="Final instructions"
      description="You are almost ready. Keep this tab open and answer each question in order."
      actions={<CandidateStepLink href="/candidate/ready">Continue</CandidateStepLink>}
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
