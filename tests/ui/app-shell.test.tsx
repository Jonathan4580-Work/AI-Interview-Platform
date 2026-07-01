/**
 * @vitest-environment jsdom
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, vi } from "vitest";

import WorkspaceOverviewPage from "@/app/(workspace)/page";
import { AppShell } from "@/components/layout/app-shell";
import {
  platformNavigationRoutes,
  workspaceNavigationRoutes,
} from "@/components/layout/workspace-navigation";
import { permissionKeys } from "@/modules/access-control";

const navigationState = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationState.pathname,
}));

afterEach(() => {
  navigationState.pathname = "/";
  vi.restoreAllMocks();
});

describe("application shell", () => {
  it("renders workspace, account, notification, and primary navigation shells", () => {
    render(
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
    navigationState.pathname = "/reports/comparison";
    render(
      <AppShell workspace={{ name: "Acme Hiring" }} permissions={permissionKeys}>
        <p>Content</p>
      </AppShell>,
    );

    const primaryNavigation = screen.getByRole("navigation", { name: "Primary" });
    const links = within(primaryNavigation).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([...workspaceNavigationRoutes]);
    expect(within(primaryNavigation).getByRole("link", { name: "Comparison" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    expect(within(primaryNavigation).queryByText("Roles")).toBeNull();
    expect(within(primaryNavigation).queryByText("Candidates")).toBeNull();
    expect(within(primaryNavigation).queryByText("Interviews")).toBeNull();
    expect(links.some((link) => link.getAttribute("href") === "#")).toBe(false);
  });

  it("limits Platform Admin navigation to platform settings routes", () => {
    navigationState.pathname = "/settings/integrations";

    render(
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
    render(
      <AppShell workspace={{ name: "Acme Hiring" }} permissions={["search:workspace"]}>
        <p>Content</p>
      </AppShell>,
    );

    const primaryNavigation = screen.getByRole("navigation", { name: "Primary" });
    expect(within(primaryNavigation).getByRole("link", { name: "Overview" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(within(primaryNavigation).getByRole("link", { name: "Search" })).toHaveAttribute(
      "href",
      "/search",
    );
    expect(within(primaryNavigation).queryByRole("link", { name: "Reports" })).toBeNull();
  });

  it("keeps the global workspace search keyboard-accessible and routed to search", async () => {
    const user = userEvent.setup();
    render(
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
    render(
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
    render(
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
    render(<WorkspaceOverviewPage />);

    expect(
      screen.queryByText(/Phase|Foundation|Development foundation|Foundation ready/iu),
    ).toBeNull();
  });

  it("renders overview cards as accessible links to existing pages", () => {
    render(<WorkspaceOverviewPage />);

    expect(screen.getByRole("link", { name: "Open Search" })).toHaveAttribute("href", "/search");
    expect(screen.getByRole("link", { name: "Open Reports" })).toHaveAttribute("href", "/reports");
    expect(screen.getByRole("link", { name: "Open Exports" })).toHaveAttribute("href", "/exports");
    expect(screen.getByRole("link", { name: "Open Settings" })).toHaveAttribute(
      "href",
      "/settings/integrations",
    );
  });
});
