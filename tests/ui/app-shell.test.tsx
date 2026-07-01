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
  shellAudienceStorageKey,
  workspaceNavigationRoutes,
} from "@/components/layout/workspace-navigation";

const navigationState = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationState.pathname,
}));

afterEach(() => {
  navigationState.pathname = "/";
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("application shell", () => {
  it("renders workspace, account, notification, and primary navigation shells", () => {
    render(
      <AppShell
        workspace={{ name: "Acme Hiring", planLabel: "Enterprise" }}
        user={{ name: "Mira Chen", email: "mira@example.com", initials: "MC" }}
      >
        <h1>Shell content</h1>
      </AppShell>,
    );

    expect(screen.getAllByText("Acme Hiring")[0]).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Notifications are not available in this staging build" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Open account menu" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Shell content" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
  });

  it("links the sidebar only to implemented authenticated routes", () => {
    navigationState.pathname = "/reports/comparison";
    render(
      <AppShell workspace={{ name: "Acme Hiring" }}>
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
    window.sessionStorage.setItem(shellAudienceStorageKey, "platform");
    navigationState.pathname = "/settings/integrations";

    render(
      <AppShell workspace={{ name: "Aptly Platform", planLabel: "Platform administration" }}>
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

  it("keeps the global workspace search keyboard-accessible and routed to search", async () => {
    const user = userEvent.setup();
    render(
      <AppShell workspace={{ name: "Acme Hiring" }}>
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
      <AppShell workspace={{ name: "Acme Hiring" }}>
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
      <AppShell workspace={{ name: "Acme Hiring" }} onSignOut={signOut}>
        <p>Content</p>
      </AppShell>,
    );

    await user.click(screen.getByRole("button", { name: "Open account menu" }));
    expect(screen.getByText("Profile not available in this staging build")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByText("Preferences not available in this staging build")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await user.click(screen.getByRole("menuitem", { name: "Sign out" }));

    expect(signOut).toHaveBeenCalledTimes(1);
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
