"use client";

import { candidatePost } from "@/components/candidate/candidate-api";

const MIME_CANDIDATES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
  "video/mp4",
] as const;

export interface RecordingUploadResult {
  readonly mediaObjectId: string;
  readonly sizeBytes: number;
  readonly mimeType: string;
}

export function chooseRecordingMimeType(): string {
  if (typeof MediaRecorder === "undefined") {
    return "";
  }
  return MIME_CANDIDATES.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? "";
}

export async function createInterviewMediaStream(): Promise<MediaStream> {
  if (
    !window.isSecureContext ||
    !("mediaDevices" in navigator) ||
    typeof navigator.mediaDevices.getUserMedia !== "function"
  ) {
    throw new Error("Camera and microphone recording requires a secure, supported browser.");
  }
  return navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
    },
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      facingMode: "user",
    },
  });
}

export async function uploadRecordingChunk(input: {
  readonly blob: Blob;
  readonly idempotencyKey: string;
}): Promise<RecordingUploadResult> {
  const checksumSha256 = await sha256Hex(input.blob);
  const prepared = await candidatePost("/api/candidate/media", {
    purpose: "interview_recording",
    mimeType: normalizeRecordingMime(input.blob.type),
    sizeBytes: input.blob.size,
    checksumSha256,
    kind: "single_part",
    idempotencyKey: input.idempotencyKey,
  });
  if (!prepared.ok) {
    throw new Error(prepared.error);
  }
  const upload = parsePreparedUpload(prepared.data);
  const uploadResponse = await fetch(upload.url, {
    method: "PUT",
    headers: upload.headers,
    body: input.blob,
  });
  if (!uploadResponse.ok) {
    throw new Error("Recording chunk upload failed.");
  }
  const completed = await candidatePost(`/api/candidate/media/${upload.mediaObjectId}/complete`, {
    uploadSessionId: upload.uploadSessionId,
  });
  if (!completed.ok) {
    throw new Error(completed.error);
  }
  return {
    mediaObjectId: upload.mediaObjectId,
    sizeBytes: input.blob.size,
    mimeType: normalizeRecordingMime(input.blob.type),
  };
}

function parsePreparedUpload(value: unknown): {
  readonly mediaObjectId: string;
  readonly uploadSessionId: string;
  readonly url: string;
  readonly headers: Record<string, string>;
} {
  if (typeof value !== "object" || value === null) {
    throw new Error("Upload authorization response was invalid.");
  }
  const record = value as {
    readonly media?: { readonly id?: unknown };
    readonly uploadSession?: { readonly id?: unknown };
    readonly uploadUrl?: { readonly url?: unknown; readonly headers?: unknown };
  };
  if (
    typeof record.media?.id !== "string" ||
    typeof record.uploadSession?.id !== "string" ||
    typeof record.uploadUrl?.url !== "string"
  ) {
    throw new Error("Upload authorization response was incomplete.");
  }
  return {
    mediaObjectId: record.media.id,
    uploadSessionId: record.uploadSession.id,
    url: record.uploadUrl.url,
    headers: isHeaderRecord(record.uploadUrl.headers) ? record.uploadUrl.headers : {},
  };
}

function isHeaderRecord(value: unknown): value is Record<string, string> {
  return (
    typeof value === "object" &&
    value !== null &&
    Object.values(value).every((entry) => typeof entry === "string")
  );
}

function normalizeRecordingMime(value: string): string {
  const normalized = value.split(";")[0]?.trim().toLowerCase() ?? "";
  return normalized === "video/mp4" ? "video/mp4" : "video/webm";
}

async function sha256Hex(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
