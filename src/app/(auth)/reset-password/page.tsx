import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/password-reset-forms";

export const metadata = {
  title: "Reset password",
};

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Choose a new password"
      description="Use the reset link from your email to update access."
    >
      <ResetPasswordForm />
    </AuthShell>
  );
}
