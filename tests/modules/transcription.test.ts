import { describe, expect, it } from "vitest";

import { AuditWriter, type AuditEventStore, type PersistedAuditEventInput } from "@/modules/audit";
import {
  DevelopmentTranscriptionProvider,
  TranscriptionDomainError,
  TranscriptionService,
  type MediaManifest,
  type TranscriptRecord,
  type TranscriptRepository,
  type TranscriptSegmentRecord,
  type TranscriptVersionRecord,
  type TranscriptionProviderResult,
  type TranscriptionSegment,
} from "@/modules/transcription";
import type { InterviewSessionId } from "@/modules/invitations";
import type { TenantContext, TenantId } from "@/modules/tenant";

describe("transcription foundation", () => {
  it("finalizes only safe media references before transcription", async () => {
    const repo = new InMemoryTranscriptRepository();
    const audit = new InMemoryAuditStore();
    const service = createService(repo, audit);

    const manifest = await service.finalizeMediaManifest({
      context,
      interviewSessionId,
    });

    expect(manifest.items).toHaveLength(1);
    expect(manifest.items[0]?.storageKey).not.toContain("signed");
    expect(manifest.items[0]?.storageKey).not.toContain("raw-media");
    expect(audit.events.at(-1)).toMatchObject({
      action: "transcription.media_manifest_finalized",
      resourceType: "interview_session",
      resourceId: interviewSessionId,
    });
  });

  it("creates a deterministic provider transcript and keeps transcript text out of audit", async () => {
    const repo = new InMemoryTranscriptRepository();
    repo.turnContent =
      "I led the payments reliability project, reduced failed jobs, and documented the rollout plan.";
    const audit = new InMemoryAuditStore();
    const service = createService(repo, audit);

    const created = await service.transcribeInterview({
      context,
      interviewSessionId,
    });

    expect(created.version.provider).toBe("development");
    expect(repo.segments[0]?.text).toContain("payments reliability project");
    expect(JSON.stringify(audit.events)).not.toContain("payments reliability project");
  });

  it("returns the active transcript without creating duplicate versions", async () => {
    const repo = new InMemoryTranscriptRepository();
    const service = createService(repo, new InMemoryAuditStore());

    const first = await service.transcribeInterview({ context, interviewSessionId });
    const second = await service.transcribeInterview({ context, interviewSessionId });

    expect(second.transcript.id).toBe(first.transcript.id);
    expect(repo.versions).toHaveLength(1);
  });

  it("creates corrected transcript versions without mutating the original provider output", async () => {
    const repo = new InMemoryTranscriptRepository();
    const audit = new InMemoryAuditStore();
    const service = createService(repo, audit);
    const original = await service.transcribeInterview({ context, interviewSessionId });

    const corrected = await service.createCorrection({
      context,
      interviewSessionId,
      correctionOfVersionId: original.version.id,
      reason: "Corrected one phrase after human review.",
      segments: [
        {
          interviewTurnId: "turn_1",
          sequence: 1,
          speaker: "candidate",
          startMs: 0,
          endMs: 1_000,
          text: "Corrected transcript text.",
          confidence: 1,
          language: "en",
        },
      ],
    });

    expect(corrected.version.versionNumber).toBe(2);
    expect(corrected.version.correctionOfVersionId).toBe(original.version.id);
    expect(
      repo.segments.find((segment) => segment.transcriptVersionId === original.version.id)?.text,
    ).toContain("Recorded answer");
    expect(audit.events.at(-1)?.reason).toBe("Corrected one phrase after human review.");
  });

  it("rejects invalid transcript segments", async () => {
    const repo = new InMemoryTranscriptRepository();
    repo.providerResult = {
      provider: "fixture",
      providerModel: "fixture",
      providerVersion: "fixture-v1",
      language: "en",
      confidence: 0.9,
      transcriptQuality: "high",
      segments: [
        {
          interviewTurnId: "turn_1",
          sequence: 1,
          speaker: "candidate",
          startMs: 0,
          endMs: 1_000,
          text: "Valid",
          confidence: 0.9,
          language: "en",
        },
        {
          interviewTurnId: "turn_1",
          sequence: 1,
          speaker: "candidate",
          startMs: 1_000,
          endMs: 2_000,
          text: "Duplicate sequence",
          confidence: 0.9,
          language: "en",
        },
      ],
      metadata: {},
    };

    await expect(
      createService(repo, new InMemoryAuditStore()).transcribeInterview({
        context,
        interviewSessionId,
      }),
    ).rejects.toThrow(TranscriptionDomainError);
  });
});

const tenant: TenantContext = { companyId: "company_test" as TenantId };
const interviewSessionId = "interview_1" as InterviewSessionId;
const context = {
  tenant,
  actor: { type: "user" as const, id: "user_1" },
  request: {
    requestId: "req_1",
    correlationId: "corr_1",
    sessionId: "session_1",
    ipAddress: "127.0.0.1",
    userAgent: "vitest",
  },
};

function createService(repo: InMemoryTranscriptRepository, audit: InMemoryAuditStore) {
  const providerResult = repo.providerResult;
  return new TranscriptionService(
    repo,
    providerResult === null
      ? new DevelopmentTranscriptionProvider()
      : {
          providerKey: "fixture",
          transcribe: () => Promise.resolve(providerResult),
        },
    new AuditWriter(audit),
    () => new Date("2026-07-01T00:00:00.000Z"),
  );
}

class InMemoryAuditStore implements AuditEventStore {
  public readonly events: PersistedAuditEventInput[] = [];

  public append(event: PersistedAuditEventInput): Promise<void> {
    this.events.push(event);
    return Promise.resolve();
  }
}

class InMemoryTranscriptRepository implements TranscriptRepository {
  public readonly transcripts: TranscriptRecord[] = [];
  public readonly versions: TranscriptVersionRecord[] = [];
  public readonly segments: TranscriptSegmentRecord[] = [];
  public providerResult: TranscriptionProviderResult | null = null;
  public turnContent: string | null = null;

  public buildMediaManifest(): Promise<MediaManifest> {
    return Promise.resolve({
      companyId: tenant.companyId,
      interviewSessionId,
      items: [
        {
          turnId: "turn_1",
          sequence: 1,
          mediaObjectId: "media_1" as never,
          mimeType: "video/webm",
          sizeBytes: 1_000_000n,
          checksumSha256: "a".repeat(64),
          storageProvider: "minio",
          bucket: "aptly-media-test",
          storageKey: "tenants/company_test/interviews/interview_1/turn_1.webm",
          durationMs: 30_000,
        },
      ],
    });
  }

  public listCompletedTurns(): Promise<
    readonly {
      readonly id: string;
      readonly sequence: number;
      readonly content: string | null;
      readonly startedAt: Date;
      readonly endedAt: Date | null;
    }[]
  > {
    return Promise.resolve([
      {
        id: "turn_1",
        sequence: 1,
        content: this.turnContent,
        startedAt: new Date("2026-07-01T00:00:00.000Z"),
        endedAt: new Date("2026-07-01T00:00:30.000Z"),
      },
    ]);
  }

  public findActiveTranscript(): Promise<{
    readonly transcript: TranscriptRecord;
    readonly version: TranscriptVersionRecord;
  } | null> {
    const transcript = this.transcripts.at(-1);
    const version = this.versions.at(-1);
    return Promise.resolve(
      transcript === undefined || version === undefined ? null : { transcript, version },
    );
  }

  public createTranscriptVersion(input: {
    readonly source: string;
    readonly providerResult: TranscriptionProviderResult;
    readonly correctionOfVersionId?: string | null;
    readonly correctionReason?: string | null;
  }): Promise<{
    readonly transcript: TranscriptRecord;
    readonly version: TranscriptVersionRecord;
  }> {
    const now = new Date("2026-07-01T00:00:00.000Z");
    const transcript =
      this.transcripts[0] ??
      ({
        id: "transcript_1" as never,
        companyId: tenant.companyId,
        interviewSessionId,
        status: "ready",
        activeVersionId: null,
        language: input.providerResult.language,
        provider: input.providerResult.provider,
        providerModel: input.providerResult.providerModel,
        providerVersion: input.providerResult.providerVersion,
        transcriptQuality: input.providerResult.transcriptQuality,
        reviewedAt: null,
        reviewReason: null,
        createdAt: now,
        updatedAt: now,
      } satisfies TranscriptRecord);
    if (this.transcripts.length === 0) {
      this.transcripts.push(transcript);
    }
    const version = {
      id: `transcript_version_${String(this.versions.length + 1)}` as never,
      companyId: tenant.companyId,
      transcriptId: transcript.id,
      interviewSessionId,
      versionNumber: this.versions.length + 1,
      status: "ready",
      source: input.source,
      language: input.providerResult.language,
      provider: input.providerResult.provider,
      providerModel: input.providerResult.providerModel,
      providerVersion: input.providerResult.providerVersion,
      confidence: input.providerResult.confidence,
      transcriptQuality: input.providerResult.transcriptQuality,
      correctionOfVersionId: (input.correctionOfVersionId ?? null) as never,
      correctionReason: input.correctionReason ?? null,
      createdAt: now,
      updatedAt: now,
    } satisfies TranscriptVersionRecord;
    this.versions.push(version);
    Object.assign(transcript, {
      activeVersionId: version.id,
      language: version.language,
      provider: version.provider,
      providerModel: version.providerModel,
      providerVersion: version.providerVersion,
      transcriptQuality: version.transcriptQuality,
      updatedAt: now,
    });
    for (const segment of input.providerResult.segments) {
      this.segments.push(createSegment(segment, transcript, version));
    }
    return Promise.resolve({ transcript, version });
  }

  public listSegments(): Promise<readonly TranscriptSegmentRecord[]> {
    return Promise.resolve(this.segments);
  }

  public markReviewed(input: {
    readonly transcriptId: string;
    readonly reviewedAt: Date;
    readonly reason: string;
  }): Promise<TranscriptRecord | null> {
    const transcript = this.transcripts.find((candidate) => candidate.id === input.transcriptId);
    if (transcript === undefined) {
      return Promise.resolve(null);
    }
    Object.assign(transcript, { reviewedAt: input.reviewedAt, reviewReason: input.reason });
    return Promise.resolve(transcript);
  }
}

function createSegment(
  input: TranscriptionSegment,
  transcript: TranscriptRecord,
  version: TranscriptVersionRecord,
): TranscriptSegmentRecord {
  return {
    id: `segment_${String(input.sequence)}` as never,
    companyId: tenant.companyId,
    transcriptId: transcript.id,
    transcriptVersionId: version.id,
    interviewSessionId,
    interviewTurnId: input.interviewTurnId,
    sequence: input.sequence,
    speaker: input.speaker,
    startMs: input.startMs,
    endMs: input.endMs,
    text: input.text,
    confidence: input.confidence,
    language: input.language,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
  };
}
