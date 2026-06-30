"use client";

import { candidateGet, candidatePost } from "@/components/candidate/candidate-api";

type MonitoringStatus = "loading" | "active" | "disabled" | "unavailable";
type MonitoringConnectionState = "ok" | "degraded" | "lost";

interface MonitoringConfig {
  readonly enabled: boolean;
  readonly detectorConfigVersion: string;
  readonly thresholdVersion: string;
  readonly batch: {
    readonly flushIntervalMs: number;
    readonly maxEvents: number;
  };
  readonly disabledReason: string | null;
}

interface MonitoringEvent {
  readonly type:
    | "looking_away"
    | "multiple_faces"
    | "face_not_detected"
    | "left_frame"
    | "camera_obstructed"
    | "camera_permission_removed"
    | "microphone_unavailable"
    | "window_focus_lost"
    | "tab_hidden"
    | "copy_occurred"
    | "paste_occurred"
    | "network_degraded"
    | "connection_lost"
    | "recording_interrupted"
    | "repeated_resume"
    | "extended_inactivity"
    | "monitoring_unavailable";
  readonly occurredAt: string;
  readonly endedAt?: string;
  readonly durationMs?: number;
  readonly occurrenceCount?: number;
  readonly confidence?: number;
  readonly sourceDetector: string;
  readonly detectorCategory:
    | "camera_presence"
    | "multiple_face"
    | "face_position"
    | "camera_obstruction"
    | "page_visibility"
    | "window_focus"
    | "network_quality"
    | "recording_health"
    | "activity";
  readonly detectorVersion: string;
  readonly aggregationKey: string;
  readonly idempotencyKey: string;
  readonly metadata?: Record<string, string | number | boolean>;
}

interface FaceDetectorLike {
  detect(image: CanvasImageSource): Promise<readonly { readonly boundingBox: DOMRectReadOnly }[]>;
}

type FaceDetectorConstructor = new (options?: {
  readonly fastMode?: boolean;
  readonly maxDetectedFaces?: number;
}) => FaceDetectorLike;

interface MonitoringControllerInput {
  readonly getVideoElement: () => HTMLVideoElement | null;
  readonly setStatus: (status: MonitoringStatus, detail: string | null) => void;
}

export interface InterviewMonitoringController {
  start(): Promise<void>;
  stop(): void;
  recordConnectionState(state: MonitoringConnectionState): void;
  recordDeviceUnavailable(kind: "camera" | "microphone", reason: string): void;
  recordRecordingInterrupted(reason: string): void;
  flush(): Promise<void>;
}

export function createInterviewMonitoringController(
  input: MonitoringControllerInput,
): InterviewMonitoringController {
  let config: MonitoringConfig | null = null;
  let flushTimer: number | null = null;
  let cameraTimer: number | null = null;
  let inactivityTimer: number | null = null;
  let hiddenStartedAt: number | null = null;
  let focusLossCount = 0;
  let resumeCount = 0;
  let stopped = false;
  const queue: MonitoringEvent[] = [];
  const detector = createFaceDetector();

  function enqueue(event: Omit<MonitoringEvent, "occurredAt" | "idempotencyKey">) {
    if (config?.enabled !== true || stopped) return;
    const occurredAt = new Date();
    queue.push({
      ...event,
      occurredAt: occurredAt.toISOString(),
      idempotencyKey: `${event.aggregationKey}:${String(occurredAt.getTime())}`,
    });
    if (queue.length >= config.batch.maxEvents) {
      void flush();
    }
  }

  async function start() {
    stopped = false;
    input.setStatus("loading", null);
    const response = await candidateGet("/api/candidate/interview/monitoring/config");
    if (!response.ok) {
      input.setStatus("unavailable", response.error ?? "Monitoring warnings are unavailable.");
      return;
    }
    config = response.data as MonitoringConfig;
    if (!config.enabled) {
      input.setStatus("disabled", config.disabledReason);
      return;
    }
    input.setStatus("active", null);
    installListeners();
    flushTimer = window.setInterval(() => {
      void flush();
    }, config.batch.flushIntervalMs);
    cameraTimer = window.setInterval(() => {
      void sampleCamera();
    }, 2_500);
    inactivityTimer = window.setInterval(() => {
      enqueue({
        type: "extended_inactivity",
        durationMs: 60_000,
        sourceDetector: "activity",
        detectorCategory: "activity",
        detectorVersion: "browser-v1",
        aggregationKey: "activity:extended-inactivity",
        metadata: { reason: "no_recent_candidate_action" },
      });
    }, 60_000);
    if (detector === null) {
      enqueue({
        type: "monitoring_unavailable",
        durationMs: 10_000,
        sourceDetector: "local-face-detector",
        detectorCategory: "camera_presence",
        detectorVersion: "browser-v1",
        aggregationKey: "detector:face-unavailable",
        metadata: { reason: "face_detector_api_unavailable", weakEvidence: true },
      });
    }
  }

  function stop() {
    stopped = true;
    removeListeners();
    if (flushTimer !== null) window.clearInterval(flushTimer);
    if (cameraTimer !== null) window.clearInterval(cameraTimer);
    if (inactivityTimer !== null) window.clearInterval(inactivityTimer);
    void flush();
  }

  async function flush() {
    if (config?.enabled !== true || queue.length === 0) return;
    const events = queue.splice(0, config.batch.maxEvents);
    let response: Awaited<ReturnType<typeof candidatePost>>;
    try {
      response = await candidatePost("/api/candidate/interview/monitoring/events", {
        idempotencyKey: `monitoring-batch-${String(Date.now())}-${String(events.length)}`,
        detectorConfigVersion: config.detectorConfigVersion,
        thresholdVersion: config.thresholdVersion,
        events,
      });
    } catch {
      queue.unshift(...events.slice(0, config.batch.maxEvents));
      input.setStatus(
        "unavailable",
        "Monitoring warnings will retry when the connection recovers.",
      );
      return;
    }
    if (!response.ok) {
      queue.unshift(...events.slice(0, config.batch.maxEvents));
      input.setStatus(
        "unavailable",
        "Monitoring warnings will retry when the connection recovers.",
      );
    } else {
      input.setStatus("active", null);
    }
  }

  function recordConnectionState(state: MonitoringConnectionState) {
    if (state === "degraded") {
      enqueue({
        type: "network_degraded",
        durationMs: 10_000,
        occurrenceCount: 2,
        sourceDetector: "connection-heartbeat",
        detectorCategory: "network_quality",
        detectorVersion: "browser-v1",
        aggregationKey: "network:degraded",
        metadata: { connectionState: state },
      });
    }
    if (state === "lost") {
      enqueue({
        type: "connection_lost",
        durationMs: 10_000,
        sourceDetector: "connection-heartbeat",
        detectorCategory: "network_quality",
        detectorVersion: "browser-v1",
        aggregationKey: "network:lost",
        metadata: { connectionState: state },
      });
    }
  }

  function recordRecordingInterrupted(reason: string) {
    enqueue({
      type: "recording_interrupted",
      sourceDetector: "media-recorder",
      detectorCategory: "recording_health",
      detectorVersion: "browser-v1",
      aggregationKey: `recording:${reason}`,
      metadata: { reason, recordingState: "interrupted" },
    });
  }

  function recordDeviceUnavailable(kind: "camera" | "microphone", reason: string) {
    enqueue({
      type: kind === "camera" ? "camera_permission_removed" : "microphone_unavailable",
      durationMs: 1_000,
      sourceDetector: kind === "camera" ? "camera-track" : "microphone-track",
      detectorCategory: kind === "camera" ? "camera_presence" : "recording_health",
      detectorVersion: "browser-v1",
      aggregationKey: `${kind}:permission-removed`,
      metadata: { reason },
    });
  }

  async function sampleCamera() {
    const video = input.getVideoElement();
    if (video === null || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
    const sample = sampleVideoFrame(video);
    if (sample === null) return;
    if (sample.meanBrightness < 12) {
      enqueue({
        type: "camera_obstructed",
        durationMs: 5_000,
        occurrenceCount: 2,
        confidence: 0.72,
        sourceDetector: "camera-luminance",
        detectorCategory: "camera_obstruction",
        detectorVersion: "browser-v1",
        aggregationKey: "camera:obstructed",
        metadata: { sampleCount: 2, weakEvidence: true },
      });
    }
    if (detector === null) return;
    const faces = await detector.detect(sample.canvas);
    if (faces.length === 0) {
      enqueue({
        type: "face_not_detected",
        durationMs: 5_000,
        occurrenceCount: 2,
        confidence: 0.68,
        sourceDetector: "local-face-detector",
        detectorCategory: "camera_presence",
        detectorVersion: "browser-v1",
        aggregationKey: "camera:face-not-detected",
        metadata: { sampleCount: 2, weakEvidence: true },
      });
    }
    if (faces.length > 1) {
      enqueue({
        type: "multiple_faces",
        durationMs: 3_000,
        occurrenceCount: 2,
        confidence: 0.72,
        sourceDetector: "local-face-detector",
        detectorCategory: "multiple_face",
        detectorVersion: "browser-v1",
        aggregationKey: "camera:multiple-faces",
        metadata: { sampleCount: 2, weakEvidence: true },
      });
    }
    if (faces.length > 0 && isNearFrameEdge(faces[0].boundingBox, sample.canvas.width)) {
      enqueue({
        type: "left_frame",
        durationMs: 5_000,
        occurrenceCount: 2,
        confidence: 0.66,
        sourceDetector: "local-face-detector",
        detectorCategory: "face_position",
        detectorVersion: "browser-v1",
        aggregationKey: "camera:left-frame",
        metadata: { sampleCount: 2, weakEvidence: true },
      });
      enqueue({
        type: "looking_away",
        durationMs: 8_000,
        occurrenceCount: 2,
        confidence: 0.65,
        sourceDetector: "local-face-detector",
        detectorCategory: "face_position",
        detectorVersion: "browser-v1",
        aggregationKey: "camera:attention-warning",
        metadata: { sampleCount: 2, weakEvidence: true },
      });
    }
  }

  function handleVisibilityChange() {
    if (document.visibilityState === "hidden") {
      hiddenStartedAt = Date.now();
      return;
    }
    if (hiddenStartedAt !== null) {
      const durationMs = Date.now() - hiddenStartedAt;
      hiddenStartedAt = null;
      enqueue({
        type: "tab_hidden",
        durationMs,
        occurrenceCount: 2,
        sourceDetector: "page-visibility",
        detectorCategory: "page_visibility",
        detectorVersion: "browser-v1",
        aggregationKey: "page:hidden",
        metadata: { visibilityState: "hidden" },
      });
      resumeCount += 1;
      if (resumeCount >= 2) {
        enqueue({
          type: "repeated_resume",
          occurrenceCount: resumeCount,
          sourceDetector: "page-visibility",
          detectorCategory: "activity",
          detectorVersion: "browser-v1",
          aggregationKey: "activity:repeated-resume",
          metadata: { sampleCount: resumeCount },
        });
      }
    }
  }

  function handleBlur() {
    focusLossCount += 1;
    enqueue({
      type: "window_focus_lost",
      occurrenceCount: focusLossCount,
      sourceDetector: "window-focus",
      detectorCategory: "window_focus",
      detectorVersion: "browser-v1",
      aggregationKey: "window:focus-lost",
      metadata: { sampleCount: focusLossCount },
    });
  }

  function handleCopy() {
    enqueue({
      type: "copy_occurred",
      sourceDetector: "clipboard-event",
      detectorCategory: "activity",
      detectorVersion: "browser-v1",
      aggregationKey: "clipboard:copy",
      metadata: { reason: "copy_event" },
    });
  }

  function handlePaste() {
    enqueue({
      type: "paste_occurred",
      sourceDetector: "clipboard-event",
      detectorCategory: "activity",
      detectorVersion: "browser-v1",
      aggregationKey: "clipboard:paste",
      metadata: { reason: "paste_event" },
    });
  }

  function installListeners() {
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("copy", handleCopy);
    document.addEventListener("paste", handlePaste);
  }

  function removeListeners() {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("blur", handleBlur);
    document.removeEventListener("copy", handleCopy);
    document.removeEventListener("paste", handlePaste);
  }

  return {
    start,
    stop,
    flush,
    recordConnectionState,
    recordDeviceUnavailable,
    recordRecordingInterrupted,
  };
}

function createFaceDetector(): FaceDetectorLike | null {
  const candidate = globalThis as typeof globalThis & {
    readonly FaceDetector?: FaceDetectorConstructor;
  };
  return candidate.FaceDetector === undefined
    ? null
    : new candidate.FaceDetector({ fastMode: true, maxDetectedFaces: 3 });
}

function sampleVideoFrame(
  video: HTMLVideoElement,
): { readonly canvas: HTMLCanvasElement; readonly meanBrightness: number } | null {
  const width = Math.min(video.videoWidth, 320);
  const height = Math.min(video.videoHeight, 180);
  if (width <= 0 || height <= 0) return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (context === null) return null;
  context.drawImage(video, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;
  let total = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    total += ((pixels[index] ?? 0) + (pixels[index + 1] ?? 0) + (pixels[index + 2] ?? 0)) / 3;
  }
  return { canvas, meanBrightness: total / (pixels.length / 4) };
}

function isNearFrameEdge(face: DOMRectReadOnly, width: number): boolean {
  return face.x < width * 0.08 || face.x + face.width > width * 0.92;
}
