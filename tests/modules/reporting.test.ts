import { describe, expect, it } from "vitest";

import { AuditWriter, type AuditEventStore, type PersistedAuditEventInput } from "@/modules/audit";
import {
  ReportingService,
  buildReportDocument,
  type HrReportDocument,
  type HrReportVersionRecord,
  type ReportInput,
  type ReportingRepository,
} from "@/modules/reporting";
import type { EvaluationVersionId } from "@/modules/evaluation";
import type { InterviewSessionId } from "@/modules/invitations";
import type { TenantContext, TenantId } from "@/modules/tenant";
import type { TranscriptId } from "@/modules/transcription";

describe("reporting foundation", () => {
  it("builds decision-support reports with neutral monitoring context", () => {
    const document = buildReportDocument(reportInput);

    expect(document.disclaimer).toContain("does not replace");
    expect(document.monitoringContext.included).toBe(false);
    expect(JSON.stringify(document)).not.toContain("trust score");
    expect(JSON.stringify(document)).not.toContain("cheating");
  });

  it("generates report versions idempotently without transcript text in audit", async () => {
    const repo = new InMemoryReportingRepository();
    const audit = new InMemoryAuditStore();
    const service = new ReportingService(
      repo,
      new AuditWriter(audit),
      () => new Date("2026-07-01T00:00:00.000Z"),
    );

    const first = await service.generateReport({ context, interviewSessionId });
    const second = await service.generateReport({ context, interviewSessionId });

    expect(second.id).toBe(first.id);
    expect(repo.created).toHaveLength(1);
    expect(JSON.stringify(audit.events)).not.toContain("payment workflow");
  });
});

const tenant: TenantContext = { companyId: "company_test" as TenantId };
const interviewSessionId = "interview_1" as InterviewSessionId;
const transcriptId = "transcript_1" as TranscriptId;
const evaluationVersionId = "evaluation_version_1" as EvaluationVersionId;
const context = {
  tenant,
  actor: { type: "system" as const, id: "worker" },
  request: {
    requestId: "req_1",
    correlationId: "corr_1",
    sessionId: null,
    ipAddress: "127.0.0.1",
    userAgent: "vitest",
  },
};

const reportInput: ReportInput = {
  interviewSessionId,
  transcriptId,
  evaluationVersionId,
  candidateId: "candidate_1",
  candidateName: "Ada Candidate",
  jobId: "job_1",
  jobTitle: "Staff Engineer",
  completedAt: new Date("2026-07-01T00:00:00.000Z"),
  summary: "Decision-support summary for HR review.",
  transcriptConfidence: "moderate",
  scores: [
    {
      id: "score_1",
      competencyKey: "communication",
      label: "Communication",
      score: 4,
      maxScore: 5,
      confidence: "moderate",
      rationale: "Clear structured response.",
      evidence: [
        {
          transcriptSegmentId: "segment_1",
          interviewTurnId: "turn_1",
          claim: "Clear response.",
          excerpt: "payment workflow",
        },
      ],
    },
  ],
  strengths: ["Structured examples."],
  developmentAreas: ["Needs human review."],
  limitations: ["Moderate transcript confidence."],
};

class InMemoryAuditStore implements AuditEventStore {
  public readonly events: PersistedAuditEventInput[] = [];

  public append(event: PersistedAuditEventInput): Promise<void> {
    this.events.push(event);
    return Promise.resolve();
  }
}

class InMemoryReportingRepository implements ReportingRepository {
  public readonly created: HrReportVersionRecord[] = [];

  public findReadyReport(): Promise<HrReportVersionRecord | null> {
    return Promise.resolve(this.created[0] ?? null);
  }

  public loadReportInput(): Promise<ReportInput> {
    return Promise.resolve(reportInput);
  }

  public createReportVersion(input: {
    readonly reportInput: ReportInput;
    readonly document: HrReportDocument;
  }): Promise<HrReportVersionRecord> {
    const record: HrReportVersionRecord = {
      id: "report_version_1" as never,
      companyId: tenant.companyId,
      hrReportId: "report_1" as never,
      interviewSessionId,
      evaluationVersionId,
      versionNumber: 1,
      status: "ready",
      report: input.document,
      executiveSummary: input.document.executiveSummary,
      disclaimer: input.document.disclaimer,
      completedAt: new Date("2026-07-01T00:00:00.000Z"),
    };
    this.created.push(record);
    return Promise.resolve(record);
  }
}
