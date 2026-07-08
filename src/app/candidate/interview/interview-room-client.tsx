"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Loader2,
  Mic,
  Play,
  RefreshCw,
  ShieldCheck,
  Square,
  UploadCloud,
  Video,
  Wifi,
} from "lucide-react";

import { AptlyLogo } from "@/components/brand/logo";
import { candidateGet, candidatePost } from "@/components/candidate/candidate-api";
import {
  createInterviewMonitoringController,
  type InterviewMonitoringController,
} from "@/components/candidate/interview/monitoring-client";
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
import { Textarea } from "@/components/ui/textarea";

import type { ReactNode } from "react";

interface CandidateQuestion {
  readonly sequence: number;
  readonly key: string;
  readonly kind: "opening" | "main" | "closing" | "follow_up";
  readonly prompt: string;
  readonly required: boolean;
}

interface QuestionState {
  readonly sequence: number;
  readonly status: "pending" | "active" | "answered" | "skipped";
  readonly required: boolean;
}

interface InterviewTurn {
  readonly id: string;
  readonly sequence: number;
  readonly status: "started" | "completed" | "retry_requested" | "superseded" | "cancelled";
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
  readonly questions?: readonly QuestionState[];
  readonly turns?: readonly InterviewTurn[];
}

interface SpeechRecognitionAlternativeLike {
  readonly transcript: string;
}

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly 0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionResultListLike {
  readonly length: number;
  readonly [index: number]: SpeechRecognitionResultLike;
}

interface SpeechRecognitionEventLike extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type RecordingPhase =
  | "loading"
  | "not_recording"
  | "requesting_access"
  | "recording"
  | "saving"
  | "needs_text"
  | "answer_saved"
  | "upload_failed"
  | "completed";
type MonitoringStatus = "loading" | "active" | "disabled" | "unavailable";
type ConnectionState = "ok" | "degraded" | "lost";

export function InterviewRoomClient() {
  const [state, setState] = useState<InterviewStatePayload | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [phase, setPhase] = useState<RecordingPhase>("loading");
  const [connectionState, setConnectionState] = useState<ConnectionState>("ok");
  const [uploadedMedia, setUploadedMedia] = useState<RecordingUploadResult[]>([]);
  const [answerStartedAt, setAnswerStartedAt] = useState<number | null>(null);
  const [answerSeconds, setAnswerSeconds] = useState(0);
  const [confirmEndOpen, setConfirmEndOpen] = useState(false);
  const [monitoringStatus, setMonitoringStatus] = useState<MonitoringStatus>("loading");
  const [monitoringDetail, setMonitoringDetail] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [speechActive, setSpeechActive] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [typedAnswer, setTypedAnswer] = useState("");
  const [pendingCompletion, setPendingCompletion] = useState<{
    readonly turnId: string;
    readonly mediaObjectIds: readonly string[];
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const speechRecognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalTranscriptRef = useRef("");
  const monitoringRef = useRef<InterviewMonitoringController | null>(null);
  const chunkNumberRef = useRef(0);
  const uploadPromisesRef = useRef<Promise<RecordingUploadResult>[]>([]);

  const questions = state?.plan.questions ?? [];
  const questionStates = state?.questions ?? [];
  const answeredSequences = new Set(
    questionStates
      .filter((question) => question.status === "answered" || question.status === "skipped")
      .map((question) => question.sequence),
  );
  const firstUnanswered = questions.find((question) => !answeredSequences.has(question.sequence));
  const currentQuestion = firstUnanswered ?? questions.at(-1);
  const requiredQuestions = questions.filter((question) => question.required);
  const allRequiredAnswered =
    requiredQuestions.length > 0 &&
    requiredQuestions.every((question) => answeredSequences.has(question.sequence));
  const currentIndex = currentQuestion === undefined ? 0 : questions.indexOf(currentQuestion) + 1;
  const progress =
    questions.length === 0 ? 0 : Math.round((answeredSequences.size / questions.length) * 100);
  const hasTerminalStatus =
    state?.session.status === "completed" || state?.session.status === "processing";
  const isBusy =
    phase === "loading" ||
    phase === "requesting_access" ||
    phase === "recording" ||
    phase === "saving" ||
    isRefreshing;

  useEffect(() => {
    void bootstrap();
    setSpeechSupported(getSpeechRecognitionConstructor() !== null);
    const heartbeat = window.setInterval(() => {
      void sendHeartbeat(connectionState);
    }, 30_000);
    return () => {
      window.clearInterval(heartbeat);
      stopSpeechRecognition();
      stopTracks();
    };
  }, []);

  useEffect(() => {
    if (state?.session.id === undefined || monitoringRef.current !== null) return;
    const controller = createInterviewMonitoringController({
      getVideoElement: () => videoRef.current,
      setStatus: (status, detail) => {
        setMonitoringStatus(status);
        setMonitoringDetail(detail);
      },
    });
    monitoringRef.current = controller;
    void controller.start();
    return () => {
      controller.stop();
      monitoringRef.current = null;
    };
  }, [state?.session.id]);

  useEffect(() => {
    if (answerStartedAt === null || phase !== "recording") {
      setAnswerSeconds(0);
      return;
    }
    const timer = window.setInterval(() => {
      setAnswerSeconds(Math.max(0, Math.floor((Date.now() - answerStartedAt) / 1000)));
    }, 1_000);
    return () => {
      window.clearInterval(timer);
    };
  }, [answerStartedAt, phase]);

  async function bootstrap() {
    setIsRefreshing(true);
    const started = await candidatePost("/api/candidate/interview/start");
    if (started.ok) {
      applyState(started.data as InterviewStatePayload);
      setIsRefreshing(false);
      return;
    }

    const existing = await candidateGet("/api/candidate/interview");
    if (existing.ok) {
      applyState(existing.data as InterviewStatePayload);
      if (started.status === 409) {
        setMessage("The interview was already open. We refreshed your session.");
      }
      setIsRefreshing(false);
      return;
    }

    setPhase("upload_failed");
    setMessage(friendlyCandidateError(started.status, started.error ?? existing.error));
    setIsRefreshing(false);
  }

  function applyState(nextState: InterviewStatePayload) {
    setState(nextState);
    if (nextState.session.status === "completed" || nextState.session.status === "processing") {
      setPhase("completed");
      setMessage(null);
      return;
    }
    setPhase("not_recording");
  }

  async function refreshInterviewState() {
    setIsRefreshing(true);
    const result = await candidateGet("/api/candidate/interview");
    if (result.ok) {
      applyState(result.data as InterviewStatePayload);
      setMessage("Your interview state has been refreshed.");
    } else {
      setMessage(friendlyCandidateError(result.status, result.error));
    }
    setIsRefreshing(false);
  }

  async function beginAnswer() {
    if (currentQuestion === undefined || isBusy || allRequiredAnswered) return;
    setPhase("requesting_access");
    setMessage(null);
    setUploadedMedia([]);
    setLiveTranscript("");
    setTypedAnswer("");
    setPendingCompletion(null);
    finalTranscriptRef.current = "";
    uploadPromisesRef.current = [];

    const turnResponse = await candidatePost("/api/candidate/interview/answers/start", {
      sequence: currentQuestion.sequence,
      idempotencyKey: `answer-${state?.session.id ?? "session"}-${String(currentQuestion.sequence)}`,
    });
    if (!turnResponse.ok) {
      setPhase("not_recording");
      setMessage(friendlyCandidateError(turnResponse.status, turnResponse.error));
      if (turnResponse.status === 409) {
        await refreshInterviewState();
      }
      return;
    }

    const turn = turnResponse.data as { readonly id: string };

    try {
      const stream = await createInterviewMediaStream();
      streamRef.current = stream;
      observeDeviceTrackAvailability(stream);
      if (videoRef.current !== null) {
        videoRef.current.srcObject = stream;
      }
      startSpeechRecognition();

      const mimeType = chooseRecordingMimeType();
      const recorder = new MediaRecorder(stream, mimeType.length === 0 ? undefined : { mimeType });
      recorderRef.current = recorder;
      chunkNumberRef.current = 0;

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size === 0) return;
        chunkNumberRef.current += 1;
        const chunkSequence = chunkNumberRef.current;
        uploadPromisesRef.current.push(
          uploadRecordingChunk({
            blob: event.data,
            idempotencyKey: `${turn.id}:chunk:${String(chunkSequence)}`,
          }),
        );
      });
      recorder.addEventListener("stop", () => {
        void finalizeAnswer(turn.id);
      });
      recorder.start(10_000);
      setAnswerStartedAt(Date.now());
      setPhase("recording");
    } catch (error) {
      setPhase("upload_failed");
      monitoringRef.current?.recordRecordingInterrupted("recording_start_failed");
      setMessage(friendlyCandidateError(0, error instanceof Error ? error.message : null));
      stopTracks();
    }
  }

  function finishAnswer() {
    if (phase !== "recording" || recorderRef.current?.state !== "recording") return;
    setPhase("saving");
    setMessage("Saving your answer. Please keep this tab open.");
    stopSpeechRecognition();
    recorderRef.current.requestData();
    recorderRef.current.stop();
  }

  async function finalizeAnswer(turnId: string) {
    try {
      const completedUploads = await Promise.all(uploadPromisesRef.current);
      setUploadedMedia(completedUploads);
      const mediaObjectIds = completedUploads.map((upload) => upload.mediaObjectId);
      const answerContent = buildAnswerContent();
      if (answerContent === null) {
        setPendingCompletion({ turnId, mediaObjectIds });
        setPhase("needs_text");
        setMessage(
          "We could not capture speech text. Please type a short answer summary to continue.",
        );
        stopTracks();
        return;
      }
      await completeAnswerWithContent({ turnId, mediaObjectIds, content: answerContent });
    } catch (error) {
      setPhase("upload_failed");
      monitoringRef.current?.recordRecordingInterrupted("upload_or_completion_failed");
      setMessage(friendlyCandidateError(0, error instanceof Error ? error.message : null));
      await candidateGet("/api/candidate/interview/upload-recovery");
    }
  }

  async function completePendingTypedAnswer() {
    if (pendingCompletion === null) return;
    const answerContent = buildAnswerContent();
    if (answerContent === null) {
      setMessage("Please type a short answer summary before continuing.");
      return;
    }
    setPhase("saving");
    await completeAnswerWithContent({
      turnId: pendingCompletion.turnId,
      mediaObjectIds: pendingCompletion.mediaObjectIds,
      content: answerContent,
    });
  }

  async function completeAnswerWithContent(input: {
    readonly turnId: string;
    readonly mediaObjectIds: readonly string[];
    readonly content: string;
  }) {
    try {
      const response = await candidatePost("/api/candidate/interview/answers/complete", {
        turnId: input.turnId,
        content: input.content,
        mediaObjectIds: input.mediaObjectIds,
        idempotencyKey: `complete-${input.turnId}`,
      });
      if (!response.ok) {
        if (response.status === 409) {
          setMessage("This answer was already submitted. We are moving you forward.");
          await refreshInterviewState();
          setPhase("answer_saved");
          stopTracks();
          return;
        }
        throw new Error(response.error);
      }
      setPendingCompletion(null);
      setPhase("answer_saved");
      setMessage("Answer saved. You can continue to the next question.");
      stopTracks();
      await refreshInterviewState();
    } catch (error) {
      setPhase("upload_failed");
      monitoringRef.current?.recordRecordingInterrupted("upload_or_completion_failed");
      setMessage(friendlyCandidateError(0, error instanceof Error ? error.message : null));
      await candidateGet("/api/candidate/interview/upload-recovery");
    }
  }

  function nextQuestion() {
    if (!allRequiredAnswered) {
      setPhase("not_recording");
      setMessage(null);
      setUploadedMedia([]);
      setLiveTranscript("");
      setTypedAnswer("");
      setPendingCompletion(null);
      finalTranscriptRef.current = "";
      return;
    }
    setConfirmEndOpen(true);
  }

  async function completeInterview() {
    if (!allRequiredAnswered || phase === "recording" || phase === "saving") {
      setMessage("Please finish and save all required answers before submitting.");
      setConfirmEndOpen(false);
      return;
    }

    try {
      await monitoringRef.current?.flush();
    } catch {
      setMonitoringStatus("unavailable");
      setMonitoringDetail("Monitoring warnings will retry separately. The interview can continue.");
    }

    const response = await candidatePost("/api/candidate/interview/complete");
    if (response.ok) {
      window.location.assign("/candidate/completed");
      return;
    }

    setConfirmEndOpen(false);
    if (response.status === 409) {
      setMessage("The interview state changed. We are refreshing your session.");
      await refreshInterviewState();
      return;
    }
    setMessage(friendlyCandidateError(response.status, response.error));
  }

  async function sendHeartbeat(nextState: ConnectionState) {
    setConnectionState(nextState);
    monitoringRef.current?.recordConnectionState(nextState);
    await candidatePost("/api/candidate/interview/heartbeat", { connectionState: nextState });
  }

  function stopTracks() {
    streamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });
    streamRef.current = null;
    recorderRef.current = null;
    setAnswerStartedAt(null);
  }

  function startSpeechRecognition() {
    const Recognition = getSpeechRecognitionConstructor();
    if (Recognition === null) {
      setSpeechSupported(false);
      setSpeechActive(false);
      return;
    }
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      let interim = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0].transcript.trim();
        if (transcript.length === 0) continue;
        if (result.isFinal) {
          finalTranscriptRef.current = normalizeAnswerText(
            `${finalTranscriptRef.current} ${transcript}`,
          );
        } else {
          interim = normalizeAnswerText(`${interim} ${transcript}`);
        }
      }
      setLiveTranscript(normalizeAnswerText(`${finalTranscriptRef.current} ${interim}`));
    };
    recognition.onerror = () => {
      setSpeechActive(false);
    };
    recognition.onend = () => {
      setSpeechActive(false);
    };
    speechRecognitionRef.current = recognition;
    try {
      recognition.start();
      setSpeechSupported(true);
      setSpeechActive(true);
    } catch {
      setSpeechActive(false);
    }
  }

  function stopSpeechRecognition() {
    const recognition = speechRecognitionRef.current;
    speechRecognitionRef.current = null;
    if (recognition === null) {
      setSpeechActive(false);
      return;
    }
    try {
      recognition.stop();
    } catch {
      // Browsers may stop speech recognition automatically after silence.
    }
    setSpeechActive(false);
  }

  function buildAnswerContent(): string | null {
    return buildAnswerText(liveTranscript, typedAnswer);
  }

  function observeDeviceTrackAvailability(stream: MediaStream) {
    for (const track of stream.getVideoTracks()) {
      track.addEventListener("ended", () => {
        monitoringRef.current?.recordDeviceUnavailable("camera", "video_track_ended");
      });
      track.addEventListener("mute", () => {
        monitoringRef.current?.recordDeviceUnavailable("camera", "video_track_muted");
      });
    }
    for (const track of stream.getAudioTracks()) {
      track.addEventListener("ended", () => {
        monitoringRef.current?.recordDeviceUnavailable("microphone", "audio_track_ended");
      });
      track.addEventListener("mute", () => {
        monitoringRef.current?.recordDeviceUnavailable("microphone", "audio_track_muted");
      });
    }
  }

  const primaryAction = useMemo(() => {
    if (hasTerminalStatus) {
      return {
        label: "View completion",
        action: () => {
          window.location.assign("/candidate/completed");
        },
      };
    }
    if (phase === "recording") {
      return { label: "Finish answer", action: finishAnswer };
    }
    if (phase === "answer_saved") {
      return {
        label: allRequiredAnswered ? "Finish interview" : "Next question",
        action: nextQuestion,
      };
    }
    if (phase === "needs_text") {
      return {
        label: "Save typed answer",
        action: () => {
          void completePendingTypedAnswer();
        },
      };
    }
    if (allRequiredAnswered) {
      return {
        label: "Finish interview",
        action: () => {
          setConfirmEndOpen(true);
        },
      };
    }
    return {
      label: "Start answer",
      action: () => {
        void beginAnswer();
      },
    };
  }, [allRequiredAnswered, hasTerminalStatus, phase, currentQuestion?.sequence]);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)))] text-foreground">
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

        <CandidateProgress
          steps={[
            ["Welcome", true],
            ["Consent", true],
            ["Identity", true],
            ["Readiness", true],
            ["Interview", !hasTerminalStatus],
            ["Complete", hasTerminalStatus],
          ]}
        />

        <section className="grid flex-1 gap-5 py-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-muted-foreground">Browser interview</p>
                  <h1 className="mt-2 text-2xl font-semibold tracking-normal text-foreground">
                    {allRequiredAnswered ? "Ready to submit" : "Answer the current question"}
                  </h1>
                </div>
                <Badge
                  variant={statusVariant(phase)}
                  role="status"
                  aria-label={recordingLabel(phase)}
                  aria-live={phase === "recording" ? "assertive" : "polite"}
                >
                  {phase === "saving" ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <span className="mr-1 h-2 w-2 rounded-full bg-current" aria-hidden="true" />
                  )}
                  {recordingLabel(phase)}
                </Badge>
              </div>

              <div className="mt-6 rounded-md border border-border bg-background p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-foreground">Current question</h2>
                  <p className="text-sm font-medium text-muted-foreground" aria-live="polite">
                    Question {String(Math.max(currentIndex, 1))} of {String(questions.length)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {phase === "recording"
                      ? `Answer time ${formatDuration(answerSeconds)}`
                      : `${String(answeredSequences.size)} answered`}
                  </p>
                </div>
                <p className="mt-4 text-xl leading-8 text-foreground">
                  {allRequiredAnswered
                    ? "All required questions have been answered. Submit when you are ready."
                    : (currentQuestion?.prompt ?? "Preparing your interview plan.")}
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

              <div className="mt-5 rounded-md border border-border bg-muted/30 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-foreground">Answer transcript</h2>
                  <Badge
                    variant={speechActive ? "success" : speechSupported ? "neutral" : "warning"}
                  >
                    {speechActive
                      ? "Capturing speech"
                      : speechSupported
                        ? "Speech capture ready"
                        : "Typed fallback"}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground" aria-live="polite">
                  {liveTranscript.trim().length > 0
                    ? liveTranscript
                    : speechSupported
                      ? "Capturing speech while you record. You can also add notes below."
                      : "Speech recognition is unavailable in this browser. Type a short answer summary before continuing."}
                </p>
                <label className="mt-3 grid gap-1.5 text-sm font-medium text-foreground">
                  Answer notes / typed answer
                  <Textarea
                    value={typedAnswer}
                    onChange={(event) => {
                      setTypedAnswer(event.target.value);
                    }}
                    placeholder="Optional while speech is captured. Required if speech text is empty."
                    disabled={phase === "saving" || phase === "completed"}
                  />
                </label>
              </div>
            </div>

            {message !== null ? (
              <Alert variant={phase === "upload_failed" ? "danger" : "warning"}>
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                <AlertTitle>
                  {phase === "upload_failed" ? "Recovery needed" : "Quick update"}
                </AlertTitle>
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            ) : null}

            <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-semibold">What to do now</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {guidanceText(phase, allRequiredAnswered)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2" aria-label="Interview controls">
                  <Button
                    onClick={primaryAction.action}
                    disabled={
                      isRefreshing ||
                      phase === "requesting_access" ||
                      phase === "saving" ||
                      (phase === "needs_text" && buildAnswerContent() === null) ||
                      (phase === "recording" && primaryAction.label !== "Finish answer")
                    }
                  >
                    {primaryAction.label === "Start answer" ? (
                      <Play className="mr-2 h-4 w-4" aria-hidden="true" />
                    ) : primaryAction.label === "Finish answer" ? (
                      <Square className="mr-2 h-4 w-4" aria-hidden="true" />
                    ) : (
                      <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden="true" />
                    )}
                    {primaryAction.label}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => void refreshInterviewState()}
                    disabled={isRefreshing || phase === "recording" || phase === "saving"}
                  >
                    <RefreshCw
                      className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
                      aria-hidden="true"
                    />
                    Refresh state
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <aside className="space-y-4" aria-label="Interview status">
            <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
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
                  value={phase === "recording" ? "Recording" : "Ready when answer starts"}
                />
                <StatusRow
                  icon={<Mic className="h-4 w-4" aria-hidden="true" />}
                  label="Microphone"
                  value={phase === "recording" ? "Capturing audio" : "Required"}
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
                <StatusRow
                  icon={<UploadCloud className="h-4 w-4" aria-hidden="true" />}
                  label="Upload"
                  value={uploadLabel(phase, uploadedMedia.length)}
                />
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <h2 className="text-sm font-semibold">Monitoring notices</h2>
              <p className="mt-2 text-sm text-muted-foreground" aria-live="polite">
                {monitoringDescription(monitoringStatus, monitoringDetail)}
              </p>
              <Button asChild variant="quiet" size="sm" className="mt-3 px-0">
                <Link href="/candidate/privacy-consent">Review privacy details</Link>
              </Button>
            </div>
          </aside>
        </section>
      </div>

      <Dialog open={confirmEndOpen} onOpenChange={setConfirmEndOpen}>
        <DialogContent>
          <DialogTitle>Submit interview?</DialogTitle>
          <DialogDescription>
            Aptly will process your saved answers for transcription and review. You can submit once
            every required answer is saved.
          </DialogDescription>
          <div className="mt-5 flex flex-wrap justify-end gap-3">
            <Button
              variant="quiet"
              onClick={() => {
                setConfirmEndOpen(false);
              }}
            >
              Continue interview
            </Button>
            <Button onClick={() => void completeInterview()} disabled={!allRequiredAnswered}>
              <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden="true" />
              Submit interview
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function CandidateProgress({
  steps,
}: {
  readonly steps: readonly (readonly [label: string, active: boolean])[];
}) {
  return (
    <nav aria-label="Candidate interview progress" className="pt-5">
      <ol className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {steps.map(([label, active]) => (
          <li
            key={label}
            className={`rounded-md border px-3 py-2 text-sm ${
              active
                ? "border-primary/50 bg-primary/10 text-foreground"
                : "border-border bg-card text-muted-foreground"
            }`}
          >
            {label}
          </li>
        ))}
      </ol>
    </nav>
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

function recordingLabel(state: RecordingPhase): string {
  switch (state) {
    case "loading":
      return "Loading";
    case "requesting_access":
      return "Requesting access";
    case "recording":
      return "Recording";
    case "saving":
      return "Saving answer";
    case "needs_text":
      return "Answer text needed";
    case "answer_saved":
      return "Answer saved";
    case "upload_failed":
      return "Retry needed";
    case "completed":
      return "Completed";
    case "not_recording":
      return "Not recording";
  }
}

function guidanceText(state: RecordingPhase, allRequiredAnswered: boolean): string {
  if (allRequiredAnswered)
    return "All required answers are saved. Finish the interview when ready.";
  switch (state) {
    case "recording":
      return "Speak naturally. When you are done, choose Finish answer.";
    case "saving":
      return "Your answer is uploading and being verified. Please wait.";
    case "needs_text":
      return "Type a short answer summary, then save the typed answer.";
    case "answer_saved":
      return "Your answer is saved. Continue to the next question.";
    case "upload_failed":
      return "The answer did not finish saving. Refresh state or retry from this question.";
    case "requesting_access":
      return "Your browser may ask for camera and microphone permission.";
    case "loading":
      return "We are preparing your interview.";
    case "completed":
      return "Your interview has been submitted.";
    case "not_recording":
      return "Read the question, then choose Start answer when you are ready.";
  }
}

function statusVariant(state: RecordingPhase): "neutral" | "success" | "warning" | "danger" {
  switch (state) {
    case "recording":
      return "danger";
    case "saving":
    case "requesting_access":
    case "loading":
    case "needs_text":
      return "warning";
    case "answer_saved":
    case "completed":
      return "success";
    case "upload_failed":
      return "danger";
    case "not_recording":
      return "neutral";
  }
}

function connectionLabel(state: ConnectionState): string {
  switch (state) {
    case "ok":
      return "Stable";
    case "degraded":
      return "Checking";
    case "lost":
      return "Recovering";
  }
}

function uploadLabel(state: RecordingPhase, uploadedCount: number): string {
  if (state === "saving") return "Uploading";
  if (state === "needs_text") return "Uploaded, waiting for text";
  if (state === "answer_saved") return `${String(uploadedCount)} segment verified`;
  if (state === "upload_failed") return "Needs retry";
  return "Ready";
}

export function buildAnswerText(liveTranscript: string, typedAnswer: string): string | null {
  const captured = normalizeAnswerText(liveTranscript);
  const typed = normalizeAnswerText(typedAnswer);
  const combined = normalizeAnswerText([captured, typed].filter(Boolean).join(" "));
  return combined.length === 0 ? null : combined;
}

function normalizeAnswerText(value: string): string {
  return value.trim().replace(/\s+/gu, " ").slice(0, 10_000);
}

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  const candidate = window as Window &
    typeof globalThis & {
      readonly SpeechRecognition?: SpeechRecognitionConstructor;
      readonly webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
  return candidate.SpeechRecognition ?? candidate.webkitSpeechRecognition ?? null;
}

function monitoringDescription(state: MonitoringStatus, detail: string | null): string {
  switch (state) {
    case "loading":
      return "Monitoring notices are being prepared with your interview settings.";
    case "active":
      return "Aptly may collect limited warning signals such as camera availability, focus changes, and connection stability for reviewer context.";
    case "disabled":
      return "Monitoring notices are not active for this session. The interview can continue.";
    case "unavailable":
      return (
        detail ?? "Monitoring notices are temporarily unavailable. The interview can continue."
      );
  }
}

function friendlyCandidateError(status: number, message: string | null | undefined): string {
  if (status === 409) {
    if (message?.toLowerCase().includes("already") === true) {
      return "This answer was already submitted. We are refreshing your interview.";
    }
    if (message?.toLowerCase().includes("upload") === true) {
      return "Your previous answer is still being saved. Please wait a moment.";
    }
    return "The interview state changed. We are refreshing your session.";
  }
  if (status === 403) {
    return "Your session needs a quick refresh before continuing.";
  }
  if (message?.toLowerCase().includes("permission") === true) {
    return "Camera and microphone access are required. Allow access in your browser, then try again.";
  }
  return message ?? "Something interrupted this step. Refresh the interview state and try again.";
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${String(minutes)}:${String(remaining).padStart(2, "0")}`;
}
