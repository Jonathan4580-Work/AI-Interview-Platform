import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/password-reset-forms";

export const metadata = {
  title: "Forgot password",
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      description="Enter your account email to start password recovery."
    >
      <ForgotPasswordForm />
      <p className="mt-4 text-center text-sm text-muted-foreground">
        <a className="font-medium text-primary hover:text-primary-hover" href="/login">
          Return to sign in
        </a>
      </p>
    </AuthShell>
  );
}
