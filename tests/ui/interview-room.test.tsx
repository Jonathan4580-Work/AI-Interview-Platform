/**
 * @vitest-environment jsdom
 */
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { InterviewRoomClient } from "@/app/candidate/interview/interview-room-client";
import { chooseRecordingMimeType } from "@/components/candidate/interview/recording-client";

const interviewState = {
  session: {
    id: "interview_1",
    status: "in_progress",
    currentQuestionSequence: 1,
  },
  plan: {
    durationMinutes: 30,
    questions: [
      {
        sequence: 1,
        key: "opening",
        kind: "opening",
        prompt: "Tell us about the work you are proudest of.",
        required: true,
      },
      {
        sequence: 2,
        key: "closing",
        kind: "closing",
        prompt: "What would help you do your best work here?",
        required: true,
      },
    ],
  },
};

vi.mock("@/components/candidate/candidate-api", () => ({
  candidateGet: vi.fn((path: string) =>
    Promise.resolve({
      ok: true,
      data: path.endsWith("/monitoring/config")
        ? {
            enabled: true,
            detectorConfigVersion: "monitoring-v1",
            thresholdVersion: "monitoring-thresholds-v1",
            batch: { flushIntervalMs: 15_000, maxEvents: 25 },
            disabledReason: null,
          }
        : interviewState,
    }),
  ),
  candidatePost: vi.fn((path: string) =>
    Promise.resolve({
      ok: true,
      data: path.endsWith("/start")
        ? { ...interviewState, created: true }
        : { session: interviewState.session },
    }),
  ),
}));

describe("candidate interview room", () => {
  it("renders accessible interview controls and privacy indicators", async () => {
    render(<InterviewRoomClient />);

    expect(await screen.findByRole("heading", { name: "Current question" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("Tell us about the work you are proudest of.")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Camera preview")).toBeInTheDocument();
    expect(screen.getByLabelText("Interview controls")).toBeInTheDocument();
    expect(screen.getByText("Recording is shown explicitly")).toBeInTheDocument();
    expect(screen.getByText("Monitoring notices")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/limited warning signals/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/suspicious|cheat|fraud/i)).not.toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Not recording" })).toHaveAttribute(
      "aria-live",
      "polite",
    );
    expect(screen.getByRole("button", { name: "Start answer" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Start answer" })).toBeEnabled();
  });

  it("negotiates the first supported recording MIME type", () => {
    const original = globalThis.MediaRecorder;
    class MockMediaRecorder {
      public static isTypeSupported(value: string) {
        return value === "video/webm;codecs=vp8,opus";
      }
    }
    globalThis.MediaRecorder = MockMediaRecorder as unknown as typeof MediaRecorder;

    expect(chooseRecordingMimeType()).toBe("video/webm;codecs=vp8,opus");

    globalThis.MediaRecorder = original;
  });
});
