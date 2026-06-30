/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CandidateShell, CandidateStepLink } from "@/components/candidate/candidate-shell";
import { CandidateConsentForm } from "@/app/candidate/privacy-consent/privacy-consent-form";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push,
    replace: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("candidate portal UI", () => {
  it("renders the candidate shell with support navigation and accessible landmark content", () => {
    render(
      <CandidateShell
        title="Device readiness"
        description="Check your browser before the interview."
        actions={<CandidateStepLink href="/candidate/instructions">Continue</CandidateStepLink>}
      >
        <p>Camera and microphone are required.</p>
      </CandidateShell>,
    );

    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Support" })).toHaveAttribute(
      "href",
      "/candidate/support",
    );
    expect(screen.getByRole("link", { name: "Continue" })).toHaveAttribute(
      "href",
      "/candidate/instructions",
    );
    expect(screen.getByText("Camera and microphone are required.")).toBeInTheDocument();
  });

  it("does not allow consent submission until every versioned consent is checked", async () => {
    const user = userEvent.setup();
    render(<CandidateConsentForm />);

    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getByRole("status")).toHaveTextContent("Please review each item");
    expect(push).not.toHaveBeenCalled();
  });
});
