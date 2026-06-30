import type { AuditActor, AuditRequestContext } from "@/modules/audit";
import type { InterviewSessionId } from "@/modules/invitations";
import type { MediaObjectId } from "@/modules/media";
import type { TenantContext, TenantId } from "@/modules/tenant";
import type { Brand } from "@/shared";

export type TranscriptId = Brand<string, "TranscriptId">;
export type TranscriptVersionId = Brand<string, "TranscriptVersionId">;
export type TranscriptSegmentId = Brand<string, "TranscriptSegmentId">;

export type TranscriptStatus = "pending" | "processing" | "ready" | "failed" | "superseded";
export type TranscriptSpeaker = "interviewer" | "candidate" | "system" | "unknown";
export type ConfidenceLevel = "high" | "moderate" | "limited" | "insufficient_evidence";

export interface TranscriptionMutationContext {
  readonly tenant: TenantContext;
  readonly actor: AuditActor;
  readonly request: AuditRequestContext;
  readonly supportAccessSessionId?: string | null;
}

export interface MediaManifestItem {
  readonly turnId: string;
  readonly sequence: number;
  readonly mediaObjectId: MediaObjectId;
  readonly mimeType: string;
  readonly sizeBytes: bigint;
  readonly checksumSha256: string | null;
  readonly storageProvider: string;
  readonly bucket: string;
  readonly storageKey: string;
  readonly durationMs: number | null;
}

export interface MediaManifest {
  readonly companyId: TenantId;
  readonly interviewSessionId: InterviewSessionId;
  readonly items: readonly MediaManifestItem[];
}

export interface TranscriptRecord {
  readonly id: TranscriptId;
  readonly companyId: TenantId;
  readonly interviewSessionId: InterviewSessionId;
  readonly status: TranscriptStatus;
  readonly activeVersionId: TranscriptVersionId | null;
  readonly language: string;
  readonly provider: string;
  readonly providerModel: string | null;
  readonly providerVersion: string | null;
  readonly transcriptQuality: ConfidenceLevel;
  readonly reviewedAt: Date | null;
  readonly reviewReason: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface TranscriptVersionRecord {
  readonly id: TranscriptVersionId;
  readonly companyId: TenantId;
  readonly transcriptId: TranscriptId;
  readonly interviewSessionId: InterviewSessionId;
  readonly versionNumber: number;
  readonly status: TranscriptStatus;
  readonly source: string;
  readonly language: string;
  readonly provider: string;
  readonly providerModel: string | null;
  readonly providerVersion: string | null;
  readonly confidence: number | null;
  readonly transcriptQuality: ConfidenceLevel;
  readonly correctionOfVersionId: TranscriptVersionId | null;
  readonly correctionReason: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface TranscriptSegmentRecord {
  readonly id: TranscriptSegmentId;
  readonly companyId: TenantId;
  readonly transcriptId: TranscriptId;
  readonly transcriptVersionId: TranscriptVersionId;
  readonly interviewSessionId: InterviewSessionId;
  readonly interviewTurnId: string | null;
  readonly sequence: number;
  readonly speaker: TranscriptSpeaker;
  readonly startMs: number | null;
  readonly endMs: number | null;
  readonly text: string;
  readonly confidence: number | null;
  readonly language: string;
  readonly createdAt: Date;
}

export interface TranscriptionSegment {
  readonly interviewTurnId: string | null;
  readonly sequence: number;
  readonly speaker: TranscriptSpeaker;
  readonly startMs: number | null;
  readonly endMs: number | null;
  readonly text: string;
  readonly confidence: number | null;
  readonly language: string;
}

export interface TranscriptionProviderResult {
  readonly provider: string;
  readonly providerModel: string | null;
  readonly providerVersion: string | null;
  readonly language: string;
  readonly confidence: number | null;
  readonly transcriptQuality: ConfidenceLevel;
  readonly segments: readonly TranscriptionSegment[];
  readonly providerReference?: string | null;
  readonly metadata?: Record<string, unknown>;
}

export interface TranscriptionProvider {
  readonly providerKey: string;
  transcribe(input: {
    readonly manifest: MediaManifest;
    readonly turns: readonly {
      readonly id: string;
      readonly sequence: number;
      readonly content: string | null;
      readonly startedAt: Date;
      readonly endedAt: Date | null;
    }[];
  }): Promise<TranscriptionProviderResult>;
}

export interface TranscriptRepository {
  buildMediaManifest(input: {
    readonly tenant: TenantContext;
    readonly interviewSessionId: InterviewSessionId;
  }): Promise<MediaManifest>;

  listCompletedTurns(input: {
    readonly tenant: TenantContext;
    readonly interviewSessionId: InterviewSessionId;
  }): Promise<
    readonly {
      readonly id: string;
      readonly sequence: number;
      readonly content: string | null;
      readonly startedAt: Date;
      readonly endedAt: Date | null;
    }[]
  >;

  findActiveTranscript(input: {
    readonly tenant: TenantContext;
    readonly interviewSessionId: InterviewSessionId;
  }): Promise<{
    readonly transcript: TranscriptRecord;
    readonly version: TranscriptVersionRecord;
  } | null>;

  createTranscriptVersion(input: {
    readonly tenant: TenantContext;
    readonly interviewSessionId: InterviewSessionId;
    readonly source: string;
    readonly providerResult: TranscriptionProviderResult;
    readonly correctionOfVersionId?: TranscriptVersionId | null;
    readonly correctionReason?: string | null;
    readonly correctedByUserId?: string | null;
    readonly retentionDeleteAt: Date;
  }): Promise<{ readonly transcript: TranscriptRecord; readonly version: TranscriptVersionRecord }>;

  listSegments(input: {
    readonly tenant: TenantContext;
    readonly transcriptVersionId: TranscriptVersionId;
    readonly limit: number;
    readonly cursor?: string | null;
  }): Promise<readonly TranscriptSegmentRecord[]>;

  markReviewed(input: {
    readonly tenant: TenantContext;
    readonly transcriptId: TranscriptId;
    readonly reviewedByUserId: string;
    readonly reviewedAt: Date;
    readonly reason: string;
  }): Promise<TranscriptRecord | null>;
}
