"use client";

import { useState } from "react";
import { z } from "zod";

import { getPostLoginRedirect } from "@/lib/auth/post-login-redirect";
import { login } from "@/lib/auth/session-client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const loginFormSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("company"),
    companyId: z.string().min(1, "Enter a workspace ID."),
    email: z.string().email("Enter a valid email address."),
    password: z.string().min(1, "Enter your password."),
  }),
  z.object({
    mode: z.literal("platform"),
    companyId: z.string().optional(),
    email: z.string().email("Enter a valid email address."),
    password: z.string().min(1, "Enter your password."),
  }),
]);

type LoginFormErrors = Partial<Record<"companyId" | "email" | "password" | "form", string>>;
type LoginMode = "company" | "platform";
interface LoginFormProps {
  navigate?: (path: string) => void;
}
interface FormSubmitEvent {
  preventDefault: () => void;
  currentTarget: HTMLFormElement;
}

function getFormString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function LoginForm({
  navigate = (path) => {
    window.location.assign(path);
  },
}: LoginFormProps) {
  const [mode, setMode] = useState<LoginMode>("company");
  const [errors, setErrors] = useState<LoginFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormSubmitEvent) {
    event.preventDefault();
    setErrors({});

    const formData = new FormData(event.currentTarget);
    const parsed = loginFormSchema.safeParse({
      mode,
      companyId: getFormString(formData, "companyId").trim(),
      email: getFormString(formData, "email").trim(),
      password: getFormString(formData, "password"),
    });

    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      setErrors({
        companyId: fieldErrors.companyId?.[0],
        email: fieldErrors.email?.[0],
        password: fieldErrors.password?.[0],
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await login({
        mode: parsed.data.mode,
        companyId: parsed.data.mode === "company" ? parsed.data.companyId : undefined,
        email: parsed.data.email,
        password: parsed.data.password,
      });

      if (!response.ok) {
        setErrors({ form: response.error.message });
        return;
      }

      navigate(getPostLoginRedirect(response.data.subject));
    } catch {
      setErrors({ form: "Unable to sign in right now." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
    >
      <FormField label="Account type" htmlFor="account-type">
        <RadioGroup
          id="account-type"
          value={mode}
          onValueChange={(value) => {
            setMode(value === "platform" ? "platform" : "company");
          }}
          className="grid grid-cols-2 gap-2"
          aria-label="Account type"
        >
          <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm">
            <RadioGroupItem value="company" />
            Company
          </label>
          <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm">
            <RadioGroupItem value="platform" />
            Platform
          </label>
        </RadioGroup>
      </FormField>

      {mode === "company" ? (
        <FormField label="Workspace ID" htmlFor="companyId" error={errors.companyId} required>
          <Input
            id="companyId"
            name="companyId"
            autoComplete="organization"
            aria-invalid={errors.companyId ? "true" : "false"}
            aria-describedby={errors.companyId ? "companyId-error" : undefined}
          />
        </FormField>
      ) : null}

      <FormField label="Email" htmlFor="email" error={errors.email} required>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          aria-invalid={errors.email ? "true" : "false"}
          aria-describedby={errors.email ? "email-error" : undefined}
        />
      </FormField>

      <FormField label="Password" htmlFor="password" error={errors.password} required>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={errors.password ? "true" : "false"}
          aria-describedby={errors.password ? "password-error" : undefined}
        />
      </FormField>

      {errors.form ? (
        <Alert variant="danger">
          <AlertDescription>{errors.form}</AlertDescription>
        </Alert>
      ) : null}

      <Button className="w-full" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Signing in" : "Sign in"}
      </Button>
    </form>
  );
}

export { LoginForm };
