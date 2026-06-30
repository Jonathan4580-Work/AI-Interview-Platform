/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";

import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";

describe("route feedback states", () => {
  it("renders loading state with polite status semantics", () => {
    render(<LoadingState label="Loading settings" />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading settings");
  });

  it("renders error state with alert semantics and recovery action", () => {
    render(
      <ErrorState title="Unable to load" actionLabel="Try again" onAction={() => undefined} />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Unable to load");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
