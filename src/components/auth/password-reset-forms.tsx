"use client";

import { useState } from "react";
import { z } from "zod";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

const emailSchema = z.string().email("Enter a valid email address.");
const passwordSchema = z.string().min(12, "Use at least 12 characters.");
interface FormSubmitEvent {
  preventDefault: () => void;
  currentTarget: HTMLFormElement;
}

function getFormString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function ForgotPasswordForm() {
  const [error, setError] = useState<string>();
  const [accepted, setAccepted] = useState(false);

  function handleSubmit(event: FormSubmitEvent) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const parsed = emailSchema.safeParse(getFormString(formData, "email").trim());

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      return;
    }

    setError(undefined);
    setAccepted(true);
  }

  return (
    <form className="space-y-4" noValidate onSubmit={handleSubmit}>
      <FormField label="Email" htmlFor="email" error={error} required>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          aria-invalid={error ? "true" : "false"}
        />
      </FormField>
      {accepted ? (
        <Alert variant="success">
          <AlertDescription>
            If an account exists, a reset link can be sent when email delivery is enabled.
          </AlertDescription>
        </Alert>
      ) : null}
      <Button className="w-full" type="submit">
        Continue
      </Button>
    </form>
  );
}

function ResetPasswordForm() {
  const [error, setError] = useState<string>();

  function handleSubmit(event: FormSubmitEvent) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const parsed = passwordSchema.safeParse(getFormString(formData, "password"));

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      return;
    }

    setError(undefined);
  }

  return (
    <form className="space-y-4" noValidate onSubmit={handleSubmit}>
      <FormField label="New password" htmlFor="password" error={error} required>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={error ? "true" : "false"}
        />
      </FormField>
      <Button className="w-full" type="submit">
        Reset password
      </Button>
    </form>
  );
}

export { ForgotPasswordForm, ResetPasswordForm };
