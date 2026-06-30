import { AuditWriter } from "@/modules/audit";

import type {
  TranscriptId,
  TranscriptRepository,
  TranscriptSegmentRecord,
  TranscriptVersionId,
  TranscriptionMutationContext,
  TranscriptionProvider,
  TranscriptionSegment,
} from "./types";
import type { InterviewSessionId } from "@/modules/invitations";

const TRANSCRIPT_RETENTION_DAYS = 365;

export class TranscriptionDomainError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "TranscriptionDomainError";
  }
}

export class TranscriptionService {
  public constructor(
    private readonly repository: TranscriptRepository,
    private readonly provider: TranscriptionProvider,
    private readonly auditWriter: AuditWriter,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async finalizeMediaManifest(input: {
    readonly context: TranscriptionMutationContext;
    readonly interviewSessionId: InterviewSessionId;
  }) {
    const manifest = await this.repository.buildMediaManifest({
      tenant: input.context.tenant,
      interviewSessionId: input.interviewSessionId,
    });
    if (manifest.items.length === 0) {
      throw new TranscriptionDomainError("Interview media is required before transcription.");
    }
    await this.auditWriter.record({
      companyId: input.context.tenant.companyId,
      actor: input.context.actor,
      request: input.context.request,
      supportAccessSessionId: input.context.supportAccessSessionId ?? null,
      action: "transcription.media_manifest_finalized",
      resourceType: "interview_session",
      resourceId: input.interviewSessionId,
      riskLevel: "medium",
      after: {
        interviewSessionId: input.interviewSessionId,
        mediaObjectCount: manifest.items.length,
      },
    });
    return manifest;
  }

  public async transcribeInterview(input: {
    readonly context: TranscriptionMutationContext;
    readonly interviewSessionId: InterviewSessionId;
  }) {
    const existing = await this.repository.findActiveTranscript({
      tenant: input.context.tenant,
      interviewSessionId: input.interviewSessionId,
    });
    if (existing !== null) {
      return existing;
    }
    const manifest = await this.finalizeMediaManifest(input);
    const turns = await this.repository.listCompletedTurns({
      tenant: input.context.tenant,
      interviewSessionId: input.interviewSessionId,
    });
    const providerResult = await this.provider.transcribe({ manifest, turns });
    validateSegments(providerResult.segments);
    const created = await this.repository.createTranscriptVersion({
      tenant: input.context.tenant,
      interviewSessionId: input.interviewSessionId,
      source: "provider",
      providerResult,
      retentionDeleteAt: addDays(this.now(), TRANSCRIPT_RETENTION_DAYS),
    });
    await this.auditWriter.record({
      companyId: input.context.tenant.companyId,
      actor: input.context.actor,
      request: input.context.request,
      supportAccessSessionId: input.context.supportAccessSessionId ?? null,
      action: "transcription.transcript_created",
      resourceType: "transcript",
      resourceId: created.transcript.id,
      riskLevel: "high",
      after: {
        transcriptId: created.transcript.id,
        transcriptVersionId: created.version.id,
        segmentCount: providerResult.segments.length,
        provider: providerResult.provider,
      },
    });
    return created;
  }

  public async listSegments(input: {
    readonly context: TranscriptionMutationContext;
    readonly transcriptVersionId: TranscriptVersionId;
    readonly limit: number;
    readonly cursor?: string | null;
  }): Promise<readonly TranscriptSegmentRecord[]> {
    await this.auditWriter.record({
      companyId: input.context.tenant.companyId,
      actor: input.context.actor,
      request: input.context.request,
      supportAccessSessionId: input.context.supportAccessSessionId ?? null,
      action: "transcription.segments_accessed",
      resourceType: "transcript_version",
      resourceId: input.transcriptVersionId,
      riskLevel: "high",
      metadata: { limit: Math.min(Math.max(input.limit, 1), 100) },
    });
    return this.repository.listSegments({
      tenant: input.context.tenant,
      transcriptVersionId: input.transcriptVersionId,
      limit: Math.min(Math.max(input.limit, 1), 100),
      cursor: input.cursor ?? null,
    });
  }

  public async markReviewed(input: {
    readonly context: TranscriptionMutationContext;
    readonly transcriptId: TranscriptId;
    readonly reason: string;
  }) {
    if (input.context.actor.type !== "user") {
      throw new TranscriptionDomainError("Only company users can review transcripts.");
    }
    const reviewedByUserId = requireUserActorId(input.context);
    const reason = normalizeReason(input.reason);
    const reviewed = await this.repository.markReviewed({
      tenant: input.context.tenant,
      transcriptId: input.transcriptId,
      reviewedByUserId,
      reviewedAt: this.now(),
      reason,
    });
    if (reviewed === null) {
      throw new TranscriptionDomainError("Transcript was not found for this company.");
    }
    await this.auditWriter.record({
      companyId: input.context.tenant.companyId,
      actor: input.context.actor,
      request: input.context.request,
      supportAccessSessionId: input.context.supportAccessSessionId ?? null,
      action: "transcription.transcript_reviewed",
      resourceType: "transcript",
      resourceId: reviewed.id,
      reason,
      riskLevel: "high",
      after: { transcriptId: reviewed.id, reviewedAt: reviewed.reviewedAt },
    });
    return reviewed;
  }

  public async createCorrection(input: {
    readonly context: TranscriptionMutationContext;
    readonly interviewSessionId: InterviewSessionId;
    readonly correctionOfVersionId: TranscriptVersionId;
    readonly reason: string;
    readonly segments: readonly TranscriptionSegment[];
  }) {
    if (input.context.actor.type !== "user") {
      throw new TranscriptionDomainError("Only company users can correct transcripts.");
    }
    const correctedByUserId = requireUserActorId(input.context);
    validateSegments(input.segments);
    const result = await this.repository.createTranscriptVersion({
      tenant: input.context.tenant,
      interviewSessionId: input.interviewSessionId,
      source: "human_correction",
      correctionOfVersionId: input.correctionOfVersionId,
      correctionReason: normalizeReason(input.reason),
      correctedByUserId,
      retentionDeleteAt: addDays(this.now(), TRANSCRIPT_RETENTION_DAYS),
      providerResult: {
        provider: "human_correction",
        providerModel: null,
        providerVersion: "correction-v1",
        language: input.segments[0]?.language ?? "en",
        confidence: null,
        transcriptQuality: "high",
        segments: input.segments,
        metadata: { schemaVersion: 1 },
      },
    });
    await this.auditWriter.record({
      companyId: input.context.tenant.companyId,
      actor: input.context.actor,
      request: input.context.request,
      supportAccessSessionId: input.context.supportAccessSessionId ?? null,
      action: "transcription.transcript_corrected",
      resourceType: "transcript_version",
      resourceId: result.version.id,
      reason: normalizeReason(input.reason),
      riskLevel: "high",
      after: {
        transcriptId: result.transcript.id,
        transcriptVersionId: result.version.id,
        correctionOfVersionId: input.correctionOfVersionId,
        segmentCount: input.segments.length,
      },
    });
    return result;
  }
}

function requireUserActorId(context: TranscriptionMutationContext): string {
  if (context.actor.type !== "user" || context.actor.id === null) {
    throw new TranscriptionDomainError("A company user actor is required.");
  }
  return context.actor.id;
}

function validateSegments(segments: readonly TranscriptionSegment[]): void {
  if (segments.length === 0) {
    throw new TranscriptionDomainError("Transcript requires at least one segment.");
  }
  const sequences = new Set<number>();
  for (const segment of segments) {
    if (!Number.isInteger(segment.sequence) || segment.sequence < 1) {
      throw new TranscriptionDomainError("Transcript segment sequence is invalid.");
    }
    if (sequences.has(segment.sequence)) {
      throw new TranscriptionDomainError("Transcript segment sequence must be unique.");
    }
    sequences.add(segment.sequence);
    if (segment.text.trim().length === 0 || segment.text.length > 20_000) {
      throw new TranscriptionDomainError("Transcript segment text is invalid.");
    }
    if (
      segment.confidence !== null &&
      (segment.confidence < 0 || segment.confidence > 1 || !Number.isFinite(segment.confidence))
    ) {
      throw new TranscriptionDomainError("Transcript segment confidence is invalid.");
    }
  }
}

function normalizeReason(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length < 3 || normalized.length > 500) {
    throw new TranscriptionDomainError("Transcript reason must be between 3 and 500 characters.");
  }
  return normalized;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
