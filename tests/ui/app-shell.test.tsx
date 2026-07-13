/**
 * @vitest-environment jsdom
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, vi } from "vitest";

import { AppShell } from "@/components/layout/app-shell";
import { ThemeProvider } from "@/components/theme/theme-provider";
import {
  platformNavigationRoutes,
  workspaceNavigationRoutes,
} from "@/components/layout/workspace-navigation";
import { permissionKeys } from "@/modules/access-control";

import type { ReactElement } from "react";

const navigationState = vi.hoisted(() => ({ pathname: "/dashboard" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationState.pathname,
}));

afterEach(() => {
  navigationState.pathname = "/dashboard";
  window.localStorage.clear();
  document.documentElement.classList.remove("dark");
  delete document.documentElement.dataset.theme;
  vi.restoreAllMocks();
});

function renderWithTheme(ui: ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe("application shell", () => {
  it("renders workspace, account, notification, and primary navigation shells", () => {
    renderWithTheme(
      <AppShell
        workspace={{ name: "Acme Hiring", planLabel: "Enterprise" }}
        user={{
          name: "Mira Chen",
          email: "mira@example.com",
          initials: "MC",
          roleLabel: "Company Admin",
        }}
        permissions={permissionKeys}
      >
        <h1>Shell content</h1>
      </AppShell>,
    );

    expect(screen.getAllByText("Acme Hiring")[0]).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Notifications" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Open account menu" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Shell content" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
    expect(screen.queryByText("Workspace User")).toBeNull();
    expect(screen.queryByText("user@example.com")).toBeNull();
  });

  it("links the sidebar only to implemented authenticated routes", () => {
    navigationState.pathname = "/interviews";
    renderWithTheme(
      <AppShell workspace={{ name: "Acme Hiring" }} permissions={permissionKeys}>
        <p>Content</p>
      </AppShell>,
    );

    const primaryNavigation = screen.getByRole("navigation", { name: "Primary" });
    const links = within(primaryNavigation).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/dashboard",
      "/applications",
      "/jobs",
      "/candidates",
      "/interviews",
      "/reports",
      "/search",
      "/exports",
      "/settings/company",
    ]);
    expect(within(primaryNavigation).getByRole("link", { name: "Interviews" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(primaryNavigation).getByRole("link", { name: "Interviews" })).toHaveClass(
      "from-primary",
    );

    expect(within(primaryNavigation).queryByText("Roles")).toBeNull();
    expect(within(primaryNavigation).queryByText("Webhooks")).toBeNull();
    expect(within(primaryNavigation).queryByText("SSO")).toBeNull();
    expect(within(primaryNavigation).queryByText("SCIM")).toBeNull();
    expect(within(primaryNavigation).queryByText("ATS")).toBeNull();
    expect(links.some((link) => link.getAttribute("href") === "#")).toBe(false);
  });

  it("limits Platform Admin navigation to platform settings routes", () => {
    navigationState.pathname = "/settings/integrations";

    renderWithTheme(
      <AppShell
        audience="platform"
        workspace={{ name: "Aptly Platform", planLabel: "Platform administration" }}
      >
        <p>Content</p>
      </AppShell>,
    );

    const primaryNavigation = screen.getByRole("navigation", { name: "Primary" });
    expect(
      within(primaryNavigation)
        .getAllByRole("link")
        .map((link) => link.getAttribute("href")),
    ).toEqual([...platformNavigationRoutes]);
    expect(within(primaryNavigation).queryByRole("link", { name: "Search" })).toBeNull();
    expect(within(primaryNavigation).queryByRole("link", { name: "Reports" })).toBeNull();
    expect(within(primaryNavigation).queryByRole("link", { name: "Exports" })).toBeNull();
  });

  it("filters company navigation by the authenticated user's permissions", () => {
    renderWithTheme(
      <AppShell workspace={{ name: "Acme Hiring" }} permissions={["search:workspace"]}>
        <p>Content</p>
      </AppShell>,
    );

    const primaryNavigation = screen.getByRole("navigation", { name: "Primary" });
    expect(within(primaryNavigation).getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    expect(within(primaryNavigation).getByRole("link", { name: "Search" })).toHaveAttribute(
      "href",
      "/search",
    );
    expect(within(primaryNavigation).queryByRole("link", { name: "Reports" })).toBeNull();
  });

  it("keeps the global workspace search keyboard-accessible and routed to search", async () => {
    const user = userEvent.setup();
    renderWithTheme(
      <AppShell workspace={{ name: "Acme Hiring" }} permissions={permissionKeys}>
        <p>Content</p>
      </AppShell>,
    );

    const searchForm = screen.getByRole("search");
    expect(searchForm).toHaveAttribute("action", "/search");

    await user.tab();
    expect(screen.getByRole("button", { name: "Open account menu" })).not.toHaveFocus();
    await user.type(screen.getByLabelText("Search workspace"), "candidate");
    expect(screen.getByLabelText("Search workspace")).toHaveValue("candidate");
  });

  it("opens and closes mobile navigation from the top bar", async () => {
    const user = userEvent.setup();
    renderWithTheme(
      <AppShell workspace={{ name: "Acme Hiring" }} permissions={permissionKeys}>
        <p>Content</p>
      </AppShell>,
    );

    await user.click(screen.getByRole("button", { name: "Open navigation" }));

    const mobileNavigation = screen.getByRole("navigation", { name: "Mobile primary" });
    expect(within(mobileNavigation).getByRole("link", { name: "Search" })).toHaveAttribute(
      "href",
      "/search",
    );

    await user.click(within(mobileNavigation).getByRole("link", { name: "Search" }));

    expect(screen.queryByRole("navigation", { name: "Mobile primary" })).not.toBeInTheDocument();
  });

  it("submits sign out through the account menu", async () => {
    const user = userEvent.setup();
    const signOut = vi.fn();
    renderWithTheme(
      <AppShell
        workspace={{ name: "A very long company name that should never collide with dividers" }}
        user={{
          name: "A very long user name that should truncate safely",
          email: "a.very.long.email.address.for.layout.testing@example-company-domain.test",
          initials: "AV",
          roleLabel: "Company Admin",
        }}
        permissions={permissionKeys}
        onSignOut={signOut}
      >
        <p>Content</p>
      </AppShell>,
    );

    await user.click(screen.getByRole("button", { name: "Open account menu" }));
    expect(screen.getByText("Company Admin")).toBeInTheDocument();
    expect(screen.queryByText(/Profile/iu)).toBeNull();
    expect(screen.queryByText(/Preferences/iu)).toBeNull();
    await user.click(screen.getByRole("menuitem", { name: "Sign out" }));

    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("does not expose internal phase language to company users", () => {
    renderWithTheme(
      <AppShell workspace={{ name: "Acme Hiring" }} permissions={permissionKeys}>
        <p>Operational hiring workspace</p>
      </AppShell>,
    );

    expect(
      screen.queryByText(/Phase|Foundation|Development foundation|Foundation ready/iu),
    ).toBeNull();
  });

  it("does not show implementation phase language in normal report copy", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile("src/app/(workspace)/reports/page.tsx", "utf8"),
    );

    expect(source).not.toMatch(/Phase\s+\d+/iu);
    expect(source).not.toMatch(/foundation ready|development foundation/iu);
  });

  it("cycles and persists the shell theme preference", async () => {
    const user = userEvent.setup();
    renderWithTheme(
      <AppShell workspace={{ name: "Acme Hiring" }} permissions={permissionKeys}>
        <p>Content</p>
      </AppShell>,
    );

    await user.click(screen.getByRole("button", { name: "Use light theme" }));
    expect(window.localStorage.getItem("aptly-theme")).toBe("light");
    expect(document.documentElement).not.toHaveClass("dark");

    await user.click(screen.getByRole("button", { name: "Use dark theme" }));
    expect(window.localStorage.getItem("aptly-theme")).toBe("dark");
    expect(document.documentElement).toHaveClass("dark");
  });

  it("uses operational company routes for the product navigation", () => {
    expect(workspaceNavigationRoutes).toEqual([
      "/dashboard",
      "/applications",
      "/jobs",
      "/candidates",
      "/interviews",
      "/search",
      "/reports",
      "/reports/comparison",
      "/exports",
      "/settings/company",
      "/settings/integrations",
      "/settings/webhooks",
      "/settings/sso",
      "/settings/scim",
      "/settings/ats",
      "/settings/integration-sync",
      "/settings/data-region",
    ]);
  });
});
