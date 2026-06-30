import {
  AI_EVALUATION_SCHEMA_VERSION,
  AI_REDACTION_POLICY_VERSION,
  type PublishedRubricVersionRecord,
  type RedactedEvaluationInput,
} from "./types";
import type { TranscriptSegmentRecord, TranscriptVersionId } from "@/modules/transcription";
import type { InterviewSessionId } from "@/modules/invitations";

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu;
const PHONE_PATTERN = /(?:\+?\d[\d\s().-]{7,}\d)/gu;

export function redactEvaluationInput(input: {
  readonly interviewSessionId: InterviewSessionId;
  readonly transcriptVersionId: TranscriptVersionId;
  readonly rubric: PublishedRubricVersionRecord;
  readonly segments: readonly TranscriptSegmentRecord[];
}): RedactedEvaluationInput {
  return {
    schemaVersion: AI_EVALUATION_SCHEMA_VERSION,
    redactionPolicyVersion: AI_REDACTION_POLICY_VERSION,
    interviewSessionId: input.interviewSessionId,
    transcriptVersionId: input.transcriptVersionId,
    rubric: {
      scoreMin: input.rubric.scoreMin,
      scoreMax: input.rubric.scoreMax,
      competencies: input.rubric.competencies,
    },
    segments: input.segments.map((segment) => ({
      transcriptSegmentId: segment.id,
      interviewTurnId: segment.interviewTurnId,
      sequence: segment.sequence,
      speaker: segment.speaker,
      startMs: segment.startMs,
      endMs: segment.endMs,
      text: redactDirectIdentifiers(segment.text),
      confidence: segment.confidence,
      language: segment.language,
    })),
  };
}

export function redactDirectIdentifiers(value: string): string {
  return value
    .replace(EMAIL_PATTERN, "[redacted-email]")
    .replace(PHONE_PATTERN, "[redacted-phone]");
}
