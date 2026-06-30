/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CandidateShell, CandidateStepLink } from "@/components/candidate/candidate-shell";
import { CandidateEntryClient } from "@/app/candidate/entry/token-exchange";
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

  it("removes candidate entry tokens from the visible URL before exchange", async () => {
    const replaceState = vi.spyOn(window.history, "replaceState");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: { accepted: true, nextPath: "/candidate/welcome" },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    window.location.hash = "token=secure-fragment-token";

    render(<CandidateEntryClient />);

    expect(replaceState).toHaveBeenCalledWith(null, "", "/candidate/entry");
    await screen.findByText("Please keep this tab open");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/candidate/exchange",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ token: "secure-fragment-token" }),
      }),
    );

    fetchMock.mockRestore();
    replaceState.mockRestore();
  });
});
