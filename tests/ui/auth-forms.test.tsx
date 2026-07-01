/**
 * @vitest-environment jsdom
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, vi } from "vitest";

import { LoginForm } from "@/components/auth/login-form";
import { shellAudienceStorageKey } from "@/components/layout/workspace-navigation";
import { ForgotPasswordForm, ResetPasswordForm } from "@/components/auth/password-reset-forms";

const locationAssign = vi.fn();
const missingWorkspaceRoute = ["", "workspace"].join("/");

afterEach(() => {
  window.sessionStorage.clear();
  locationAssign.mockReset();
  vi.restoreAllMocks();
});

describe("authentication forms", () => {
  it("validates required login fields before calling the API", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(window, "fetch");
    render(<LoginForm navigate={locationAssign} />);

    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Enter a workspace ID.")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.getByText("Enter your password.")).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(locationAssign).not.toHaveBeenCalled();
  });

  it("posts company login credentials and redirects Company Admins to the workspace overview", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            subject: {
              type: "user",
              companyId: "company_123",
              userId: "user_123",
              email: "mira@example.com",
              name: "Mira",
              status: "active",
            },
            sessionId: "session_123",
            expiresAt: "2026-07-01T12:00:00.000Z",
          },
          meta: { requestId: "req_test", correlationId: "corr_test" },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    render(<LoginForm navigate={locationAssign} />);

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
    await waitFor(() => {
      expect(locationAssign).toHaveBeenCalledWith("/");
    });
    expect(window.sessionStorage.getItem(shellAudienceStorageKey)).toBe("company");
    expect(locationAssign).not.toHaveBeenCalledWith(missingWorkspaceRoute);
  });

  it("redirects Platform Admins to the existing integration settings route", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            subject: {
              type: "platform_user",
              platformUserId: "platform_123",
              email: "platform@example.com",
              name: "Platform Admin",
              status: "active",
            },
            sessionId: "session_123",
            expiresAt: "2026-07-01T12:00:00.000Z",
          },
          meta: { requestId: "req_test", correlationId: "corr_test" },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    render(<LoginForm navigate={locationAssign} />);

    await user.click(screen.getByLabelText(/platform/i));
    await user.type(screen.getByLabelText(/^email/i), "platform@example.com");
    await user.type(screen.getByLabelText(/password/i), "correct horse battery staple");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(locationAssign).toHaveBeenCalledWith("/settings/integrations");
    });
    expect(window.sessionStorage.getItem(shellAudienceStorageKey)).toBe("platform");
    expect(locationAssign).not.toHaveBeenCalledWith(missingWorkspaceRoute);
  });

  it("does not redirect unauthenticated login attempts", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          error: { code: "unauthenticated", message: "Authentication failed.", details: null },
          meta: { requestId: "req_test", correlationId: "corr_test" },
        }),
        { status: 401, headers: { "content-type": "application/json" } },
      ),
    );

    render(<LoginForm navigate={locationAssign} />);

    await user.type(screen.getByLabelText(/workspace id/i), "company_123");
    await user.type(screen.getByLabelText(/^email/i), "mira@example.com");
    await user.type(screen.getByLabelText(/password/i), "wrong password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Authentication failed.")).toBeInTheDocument();
    expect(locationAssign).not.toHaveBeenCalled();
  });

  it("sends invalid authenticated subject types to the auth error route", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            subject: {
              type: "unknown",
              email: "unknown@example.com",
              name: "Unknown",
              status: "active",
            },
            sessionId: "session_123",
            expiresAt: "2026-07-01T12:00:00.000Z",
          },
          meta: { requestId: "req_test", correlationId: "corr_test" },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    render(<LoginForm navigate={locationAssign} />);

    await user.click(screen.getByLabelText(/platform/i));
    await user.type(screen.getByLabelText(/^email/i), "unknown@example.com");
    await user.type(screen.getByLabelText(/password/i), "correct horse battery staple");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(locationAssign).toHaveBeenCalledWith("/auth-error");
    });
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
