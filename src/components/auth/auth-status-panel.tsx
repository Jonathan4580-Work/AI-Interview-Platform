import { AlertCircle, CheckCircle2, MailCheck } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type AuthStatusKind = "verification" | "verified" | "error";

interface AuthStatusPanelProps {
  kind: AuthStatusKind;
  title: string;
  description: string;
}

function AuthStatusPanel({ kind, title, description }: AuthStatusPanelProps) {
  const Icon = kind === "error" ? AlertCircle : kind === "verified" ? CheckCircle2 : MailCheck;
  const variant = kind === "error" ? "danger" : kind === "verified" ? "success" : "info";

  return (
    <Alert variant={variant}>
      <div className="flex gap-3">
        <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div>
          <AlertTitle>{title}</AlertTitle>
          <AlertDescription>{description}</AlertDescription>
        </div>
      </div>
    </Alert>
  );
}

export { AuthStatusPanel };
