/**
 * @vitest-environment jsdom
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, vi } from "vitest";

import { LoginForm } from "@/components/auth/login-form";
import { ForgotPasswordForm, ResetPasswordForm } from "@/components/auth/password-reset-forms";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("authentication forms", () => {
  it("validates required login fields before calling the API", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(window, "fetch");
    render(<LoginForm />);

    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Enter a workspace ID.")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.getByText("Enter your password.")).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("posts company login credentials to the existing internal login API", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          error: { code: "unauthenticated", message: "Authentication failed.", details: null },
          meta: { requestId: "req_test", correlationId: "corr_test" },
        }),
        { status: 401, headers: { "content-type": "application/json" } },
      ),
    );

    render(<LoginForm />);

    await user.type(screen.getByLabelText(/workspace id/i), "company_123");
    await user.type(screen.getByLabelText(/^email/i), "mira@example.com");
    await user.type(screen.getByLabelText(/password/i), "correct horse battery staple");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/internal/v1/auth/login",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({
          type: "company",
          companyId: "company_123",
          email: "mira@example.com",
          password: "correct horse battery staple",
        }),
      }),
    );
    expect(await screen.findByText("Authentication failed.")).toBeInTheDocument();
  });

  it("validates forgot-password and reset-password layouts locally", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<ForgotPasswordForm />);

    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument();

    rerender(<ResetPasswordForm />);
    await user.type(screen.getByLabelText(/new password/i), "short");
    await user.click(screen.getByRole("button", { name: "Reset password" }));

    expect(await screen.findByText("Use at least 12 characters.")).toBeInTheDocument();
  });
});
