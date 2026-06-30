/**
 * @vitest-environment jsdom
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Briefcase, Settings } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";

describe("application shell", () => {
  it("renders workspace, account, notification, and primary navigation shells", () => {
    render(
      <AppShell
        workspace={{ name: "Acme Hiring", planLabel: "Enterprise" }}
        user={{ name: "Mira Chen", email: "mira@example.com", initials: "MC" }}
        navigation={[
          { label: "Roles", icon: Briefcase, current: true },
          { label: "Settings", icon: Settings },
        ]}
      >
        <h1>Shell content</h1>
      </AppShell>,
    );

    expect(screen.getAllByText("Acme Hiring")[0]).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "No unread notifications" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open account menu" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Shell content" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
  });

  it("opens and closes mobile navigation from the top bar", async () => {
    const user = userEvent.setup();
    render(
      <AppShell
        workspace={{ name: "Acme Hiring" }}
        navigation={[{ label: "Roles", icon: Briefcase, current: true }]}
      >
        <p>Content</p>
      </AppShell>,
    );

    await user.click(screen.getByRole("button", { name: "Open navigation" }));

    const mobileNavigation = screen.getByRole("navigation", { name: "Mobile primary" });
    expect(within(mobileNavigation).getByText("Roles")).toBeInTheDocument();

    await user.click(within(mobileNavigation).getByText("Roles"));

    expect(screen.queryByRole("navigation", { name: "Mobile primary" })).not.toBeInTheDocument();
  });
});
