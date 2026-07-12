/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Briefcase } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

describe("core UI components", () => {
  it("renders button and badge variants with stable accessible text", () => {
    render(
      <div>
        <Button variant="primary">Continue</Button>
        <Badge variant="success">Active</Badge>
      </div>,
    );

    expect(screen.getByRole("button", { name: "Continue" })).toHaveClass("bg-gradient-to-r");
    expect(screen.getByText("Active")).toHaveClass("bg-success-soft");
  });

  it("supports accessible form labels and validation messaging", () => {
    render(
      <FormField label="Email address" htmlFor="email" error="Enter a valid email address" required>
        <Input id="email" type="email" aria-invalid="true" aria-describedby="email-error" />
      </FormField>,
    );

    expect(screen.getByLabelText(/email address/i)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid email address");
  });

  it("supports keyboard-operable switch behavior", async () => {
    const user = userEvent.setup();
    render(<Switch aria-label="Enable compact navigation" />);

    const control = screen.getByRole("switch", { name: "Enable compact navigation" });
    expect(control).toHaveAttribute("aria-checked", "false");

    await user.click(control);

    expect(control).toHaveAttribute("aria-checked", "true");
  });

  it("renders tabs with accessible tab and tabpanel roles", async () => {
    const user = userEvent.setup();
    render(
      <Tabs defaultValue="overview">
        <TabsList aria-label="Workspace sections">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">Overview panel</TabsContent>
        <TabsContent value="settings">Settings panel</TabsContent>
      </Tabs>,
    );

    await user.click(screen.getByRole("tab", { name: "Settings" }));

    expect(screen.getByRole("tabpanel")).toHaveTextContent("Settings panel");
  });

  it("renders non-color status and feedback states", () => {
    render(
      <div>
        <Alert variant="warning">
          <AlertTitle>Review needed</AlertTitle>
          <AlertDescription>There is supporting context to inspect.</AlertDescription>
        </Alert>
        <EmptyState title="No records" icon={<Briefcase aria-hidden="true" />} />
        <LoadingState label="Loading workspace" />
        <ErrorState title="Unable to load" description="Try again from the previous page." />
      </div>,
    );

    expect(screen.getByText("Review needed")).toBeInTheDocument();
    expect(screen.getByText("No records")).toBeInTheDocument();
    expect(screen.getByText("Loading workspace")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Unable to load");
  });
});
