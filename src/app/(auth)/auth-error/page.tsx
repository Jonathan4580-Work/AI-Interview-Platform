import { AuthStatusPanel } from "@/components/auth/auth-status-panel";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata = {
  title: "Authentication error",
};

export default function AuthErrorPage() {
  return (
    <AuthShell
      title="Authentication issue"
      description="The authentication request could not be completed."
    >
      <AuthStatusPanel
        kind="error"
        title="Request unavailable"
        description="The link may be invalid, expired, or already used."
      />
      <p className="mt-4 text-center text-sm text-muted-foreground">
        <a className="font-medium text-primary hover:text-primary-hover" href="/login">
          Return to sign in
        </a>
      </p>
    </AuthShell>
  );
}
