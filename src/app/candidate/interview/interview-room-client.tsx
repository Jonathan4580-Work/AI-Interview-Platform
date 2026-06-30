"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleStop,
  HelpCircle,
  Mic,
  Pause,
  Play,
  Radio,
  ShieldCheck,
  Video,
  Wifi,
} from "lucide-react";

import { AptlyLogo } from "@/components/brand/logo";
import { candidateGet, candidatePost } from "@/components/candidate/candidate-api";
import {
  chooseRecordingMimeType,
  createInterviewMediaStream,
  uploadRecordingChunk,
  type RecordingUploadResult,
} from "@/components/candidate/interview/recording-client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

import type { ReactNode } from "react";

interface CandidateQuestion {
  readonly sequence: number;
  readonly key: string;
  readonly kind: "opening" | "main" | "closing" | "follow_up";
  readonly prompt: string;
  readonly required: boolean;
}

interface InterviewStatePayload {
  readonly session: {
    readonly id: string;
    readonly status: string;
    readonly currentQuestionSequence: number | null;
  };
  readonly plan: {
    readonly durationMinutes: number;
    readonly questions: readonly CandidateQuestion[];
  };
}

type RecordingState = "idle" | "requesting" | "recording" | "uploading" | "ready" | "failed";

export function InterviewRoomClient() {
  const [state, setState] = useState<InterviewStatePayload | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [connectionState, setConnectionState] = useState<"ok" | "degraded" | "lost">("ok");
  const [activeTurnId, setActiveTurnId] = useState<string | null>(null);
  const [uploadedMedia, setUploadedMedia] = useState<RecordingUploadResult[]>([]);
  const [confirmEndOpen, setConfirmEndOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunkNumberRef = useRef(0);

  const questions = state?.plan.questions ?? [];
  const currentQuestion = useMemo(() => {
    const sequence = state?.session.currentQuestionSequence ?? 1;
    return questions.find((question) => question.sequence === sequence) ?? questions.at(0);
  }, [questions, state?.session.currentQuestionSequence]);
  const progress =
    currentQuestion === undefined || questions.length === 0
      ? 0
      : Math.round((currentQuestion.sequence / questions.length) * 100);

  useEffect(() => {
    void bootstrap();
    const heartbeat = window.setInterval(() => {
      void sendHeartbeat(connectionState);
    }, 30_000);
    return () => {
      window.clearInterval(heartbeat);
      stopTracks();
    };
  }, []);

  async function bootstrap() {
    const started = await candidatePost("/api/candidate/interview/start");
    if (started.ok) {
      setState(started.data as InterviewStatePayload);
      setMessage(null);
      return;
    }
    const existing = await candidateGet("/api/candidate/interview");
    if (existing.ok) {
      setState(existing.data as InterviewStatePayload);
      setMessage(null);
      return;
    }
    setMessage(started.error ?? existing.error ?? "The interview room could not be opened.");
  }

  async function beginAnswer() {
    if (currentQuestion === undefined) return;
    setRecordingState("requesting");
    setMessage(null);
    const turnResponse = await candidatePost("/api/candidate/interview/answers/start", {
      sequence: currentQuestion.sequence,
      idempotencyKey: `answer-${String(currentQuestion.sequence)}-${String(Date.now())}`,
    });
    if (!turnResponse.ok) {
      setRecordingState("failed");
      setMessage(turnResponse.error ?? "The answer could not be started.");
      return;
    }
    const turn = turnResponse.data as { readonly id: string };
    setActiveTurnId(turn.id);
    try {
      const stream = await createInterviewMediaStream();
      streamRef.current = stream;
      if (videoRef.current !== null) {
        videoRef.current.srcObject = stream;
      }
      const mimeType = chooseRecordingMimeType();
      const recorder = new MediaRecorder(stream, mimeType.length === 0 ? undefined : { mimeType });
      recorderRef.current = recorder;
      chunkNumberRef.current = 0;
      const uploads: Promise<RecordingUploadResult>[] = [];
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size === 0) return;
        chunkNumberRef.current += 1;
        const chunkSequence = chunkNumberRef.current;
        uploads.push(
          uploadRecordingChunk({
            blob: event.data,
            idempotencyKey: `${turn.id}:chunk:${String(chunkSequence)}`,
          }),
        );
      });
      recorder.addEventListener("stop", () => {
        void finalizeAnswer(turn.id, uploads);
      });
      recorder.start(10_000);
      setRecordingState("recording");
    } catch (error) {
      setRecordingState("failed");
      setMessage(error instanceof Error ? error.message : "Recording could not start.");
      stopTracks();
    }
  }

  function stopAnswer() {
    if (recorderRef.current?.state === "recording") {
      setRecordingState("uploading");
      recorderRef.current.stop();
    }
  }

  async function finalizeAnswer(
    turnId: string,
    uploads: readonly Promise<RecordingUploadResult>[],
  ) {
    try {
      const completedUploads = await Promise.all(uploads);
      setUploadedMedia(completedUploads);
      const response = await candidatePost("/api/candidate/interview/answers/complete", {
        turnId,
        mediaObjectIds: completedUploads.map((upload) => upload.mediaObjectId),
        idempotencyKey: `complete-${turnId}`,
      });
      if (!response.ok) {
        throw new Error(response.error);
      }
      setRecordingState("ready");
      setActiveTurnId(null);
      stopTracks();
      await bootstrap();
    } catch (error) {
      setRecordingState("failed");
      setMessage(
        error instanceof Error
          ? error.message
          : "Recording upload needs recovery before the interview can continue.",
      );
      await candidateGet("/api/candidate/interview/upload-recovery");
    }
  }

  async function completeInterview() {
    const response = await candidatePost("/api/candidate/interview/complete");
    if (response.ok) {
      window.location.assign("/candidate/completed");
      return;
    }
    setConfirmEndOpen(false);
    setMessage(response.error ?? "The interview could not be completed yet.");
  }

  async function sendHeartbeat(nextState: "ok" | "degraded" | "lost") {
    setConnectionState(nextState);
    await candidatePost("/api/candidate/interview/heartbeat", { connectionState: nextState });
  }

  function stopTracks() {
    streamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });
    streamRef.current = null;
    recorderRef.current = null;
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <AptlyLogo />
          <nav aria-label="Candidate support" className="flex items-center gap-2">
            <Button asChild variant="quiet" size="sm">
              <Link href="/candidate/accommodations">Accommodations</Link>
            </Button>
            <Button asChild variant="quiet" size="sm">
              <Link href="/candidate/support">
                <HelpCircle className="mr-2 h-4 w-4" aria-hidden="true" />
                Support
              </Link>
            </Button>
          </nav>
        </header>

        <section className="grid flex-1 gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            <div className="rounded-lg border border-border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Browser interview</p>
                  <h1 className="mt-2 text-2xl font-semibold tracking-normal text-foreground">
                    {currentQuestion?.kind === "closing" ? "Final question" : "Current question"}
                  </h1>
                </div>
                <Badge variant={statusVariant(recordingState)}>
                  <Radio className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                  {recordingLabel(recordingState)}
                </Badge>
              </div>

              <div className="mt-8 rounded-md border border-border bg-background p-6">
                <p className="text-sm font-medium text-muted-foreground" aria-live="polite">
                  Question {currentQuestion === undefined ? 0 : currentQuestion.sequence} of{" "}
                  {String(questions.length)}
                </p>
                <p className="mt-4 text-xl leading-8 text-foreground">
                  {currentQuestion === undefined
                    ? "Preparing your interview plan."
                    : currentQuestion.prompt}
                </p>
              </div>

              <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <div
                  className="h-full bg-primary transition-all motion-reduce:transition-none"
                  style={{ width: `${String(progress)}%` }}
                />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                <span className="sr-only">Interview progress:</span>
                {progress}% complete
              </p>
            </div>

            {message !== null ? (
              <Alert variant={recordingState === "failed" ? "danger" : "warning"}>
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                <AlertTitle>Attention needed</AlertTitle>
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            ) : null}

            <div className="flex flex-wrap gap-3" aria-label="Interview controls">
              <Button
                onClick={() => {
                  void beginAnswer();
                }}
                disabled={currentQuestion === undefined || recordingState === "recording"}
              >
                <Play className="mr-2 h-4 w-4" aria-hidden="true" />
                Start answer
              </Button>
              <Button
                variant="outline"
                onClick={stopAnswer}
                disabled={recordingState !== "recording"}
              >
                <CircleStop className="mr-2 h-4 w-4" aria-hidden="true" />
                Stop answer
              </Button>
              <Button
                variant="quiet"
                onClick={() => {
                  void sendHeartbeat("degraded");
                }}
              >
                <Pause className="mr-2 h-4 w-4" aria-hidden="true" />
                Check connection
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setConfirmEndOpen(true);
                }}
                disabled={recordingState === "recording" || activeTurnId !== null}
              >
                End interview
              </Button>
            </div>
          </div>

          <aside className="space-y-4" aria-label="Interview status">
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <video
                ref={videoRef}
                className="aspect-video w-full bg-foreground"
                autoPlay
                muted
                playsInline
                aria-label="Camera preview"
              />
              <div className="space-y-3 p-4">
                <StatusRow
                  icon={<Video className="h-4 w-4" aria-hidden="true" />}
                  label="Camera"
                  value={recordingState === "recording" ? "Active" : "Ready when recording starts"}
                />
                <StatusRow
                  icon={<Mic className="h-4 w-4" aria-hidden="true" />}
                  label="Microphone"
                  value={recordingState === "recording" ? "Capturing audio" : "Required"}
                />
                <StatusRow
                  icon={<Wifi className="h-4 w-4" aria-hidden="true" />}
                  label="Connection"
                  value={connectionLabel(connectionState)}
                />
                <StatusRow
                  icon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />}
                  label="Privacy"
                  value="Recording is shown explicitly"
                />
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-4">
              <h2 className="text-sm font-semibold">Upload status</h2>
              <p className="mt-2 text-sm text-muted-foreground" aria-live="polite">
                {uploadedMedia.length === 0
                  ? "No answer media has been finalized in this browser session."
                  : `${String(uploadedMedia.length)} recording segment${uploadedMedia.length === 1 ? "" : "s"} verified.`}
              </p>
            </div>
          </aside>
        </section>
      </div>

      <Dialog open={confirmEndOpen} onOpenChange={setConfirmEndOpen}>
        <DialogContent>
          <DialogTitle>End interview?</DialogTitle>
          <DialogDescription>
            Your completed answers and verified recording uploads will be submitted for processing.
            The interview cannot move forward while required uploads are still recovering.
          </DialogDescription>
          <div className="mt-5 flex justify-end gap-3">
            <Button
              variant="quiet"
              onClick={() => {
                setConfirmEndOpen(false);
              }}
            >
              Continue interview
            </Button>
            <Button
              onClick={() => {
                void completeInterview();
              }}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden="true" />
              Submit interview
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function StatusRow({
  icon,
  label,
  value,
}: {
  readonly icon: ReactNode;
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="flex items-center gap-2 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}

function recordingLabel(state: RecordingState): string {
  switch (state) {
    case "requesting":
      return "Requesting access";
    case "recording":
      return "Recording";
    case "uploading":
      return "Uploading";
    case "ready":
      return "Answer saved";
    case "failed":
      return "Recovery needed";
    case "idle":
      return "Not recording";
  }
}

function statusVariant(state: RecordingState): "neutral" | "success" | "warning" | "danger" {
  switch (state) {
    case "recording":
      return "danger";
    case "uploading":
    case "requesting":
      return "warning";
    case "ready":
      return "success";
    case "failed":
      return "danger";
    case "idle":
      return "neutral";
  }
}

function connectionLabel(state: "ok" | "degraded" | "lost"): string {
  switch (state) {
    case "ok":
      return "Stable";
    case "degraded":
      return "Checking";
    case "lost":
      return "Recovering";
  }
}
