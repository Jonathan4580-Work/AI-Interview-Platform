import { env } from "@/config";

import type {
  TranscriptionProvider,
  TranscriptionProviderResult,
  TranscriptionSegment,
} from "./types";

export class DevelopmentTranscriptionProvider implements TranscriptionProvider {
  public readonly providerKey = "development";

  public transcribe(
    input: Parameters<TranscriptionProvider["transcribe"]>[0],
  ): Promise<TranscriptionProviderResult> {
    const segments: TranscriptionSegment[] = input.turns.map((turn, index) => {
      const fallback = `Recorded answer for interview question ${String(turn.sequence)}.`;
      return {
        interviewTurnId: turn.id,
        sequence: index + 1,
        speaker: "candidate",
        startMs: index * 60_000,
        endMs: index * 60_000 + 45_000,
        text: normalizeTranscriptText(turn.content ?? fallback),
        confidence: turn.content === null ? 0.72 : 0.95,
        language: "en",
      };
    });

    return Promise.resolve({
      provider: this.providerKey,
      providerModel: "deterministic-development-transcriber",
      providerVersion: "transcription-dev-v1",
      language: "en",
      confidence: segments.length === 0 ? null : 0.86,
      transcriptQuality: segments.length === 0 ? "insufficient_evidence" : "moderate",
      segments,
      providerReference: null,
      metadata: {
        schemaVersion: 1,
        manifestItemCount: input.manifest.items.length,
      },
    });
  }
}

export function createTranscriptionProvider(): TranscriptionProvider {
  void env.TRANSCRIPTION_PROVIDER;
  return new DevelopmentTranscriptionProvider();
}

function normalizeTranscriptText(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, 20_000);
}
