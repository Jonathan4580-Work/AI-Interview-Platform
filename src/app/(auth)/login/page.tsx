import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <AuthShell
      title="Sign in to Aptly"
      description="Use your workspace credentials to continue to the recruiting workspace."
    >
      <LoginForm />
      <p className="mt-4 text-center text-sm text-muted-foreground">
        <a className="font-medium text-primary hover:text-primary-hover" href="/forgot-password">
          Forgot password?
        </a>
      </p>
    </AuthShell>
  );
}
