import { AuthStatusPanel } from "@/components/auth/auth-status-panel";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata = {
  title: "Email verification",
};

export default function VerifyEmailPage() {
  return (
    <AuthShell
      title="Verify your email"
      description="Email verification is prepared for account security workflows."
    >
      <AuthStatusPanel
        kind="verification"
        title="Verification required"
        description="Open the verification link from your email to complete this step when delivery is enabled."
      />
    </AuthShell>
  );
}
