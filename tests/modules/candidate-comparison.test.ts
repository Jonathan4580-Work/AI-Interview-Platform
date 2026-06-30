import { describe, expect, it } from "vitest";

import {
  CandidateComparisonDomainError,
  CandidateComparisonService,
  type CandidateComparisonRepository,
  type CandidateComparisonRow,
} from "@/modules/reporting";
import { toTenantId } from "@/modules/tenant";

describe("CandidateComparisonService", () => {
  const tenant = { companyId: toTenantId("company001") };

  it("returns a neutral side-by-side comparison sorted by candidate name", async () => {
    const service = new CandidateComparisonService(
      new InMemoryCandidateComparisonRepository([
        comparisonRow({ candidateId: "candidate_b", candidateName: "Zoe Quinn", score: 4.8 }),
        comparisonRow({ candidateId: "candidate_a", candidateName: "Ada Lovelace", score: 3.4 }),
      ]),
    );

    const result = await service.compare({ tenant, jobId: "job_1" });

    expect(result.rows.map((row) => row.candidateName)).toEqual(["Ada Lovelace", "Zoe Quinn"]);
    expect(result.sort).toBe("candidate_name_asc");
    expect(result.limitations.join(" ")).toContain("not a ranking");
    expect(result.limitations.join(" ")).not.toContain("best candidate");
  });

  it("bounds candidate filters and page size", async () => {
    const repository = new InMemoryCandidateComparisonRepository([]);
    const service = new CandidateComparisonService(repository);

    await service.compare({
      tenant,
      jobId: "job_1",
      candidateIds: ["candidate_1", "candidate_1", "candidate_2"],
      limit: 500,
    });

    expect(repository.requests[0]?.candidateIds).toEqual(["candidate_1", "candidate_2"]);
    expect(repository.requests[0]?.limit).toBe(25);

    await expect(
      service.compare({
        tenant,
        jobId: "job_1",
        candidateIds: Array.from({ length: 26 }, (_, index) => `candidate_${String(index)}`),
      }),
    ).rejects.toThrow(CandidateComparisonDomainError);
  });

  it("keeps monitoring context separate from competency and overall scores", async () => {
    const service = new CandidateComparisonService(
      new InMemoryCandidateComparisonRepository([
        comparisonRow({
          candidateId: "candidate_1",
          candidateName: "Ada Lovelace",
          score: 4,
          monitoringWarningCount: 3,
        }),
      ]),
    );

    const result = await service.compare({ tenant, jobId: "job_1" });
    const row = result.rows[0];

    expect(row.overallScore).toBe(4);
    expect(row.monitoringContext.warningCount).toBe(3);
    expect(row.monitoringContext.note).toContain("not included in comparison scores");
  });
});

class InMemoryCandidateComparisonRepository implements CandidateComparisonRepository {
  public readonly requests: Parameters<
    CandidateComparisonRepository["listComparableCandidates"]
  >[0][] = [];

  public constructor(private readonly rows: readonly CandidateComparisonRow[]) {}

  public listComparableCandidates(
    input: Parameters<CandidateComparisonRepository["listComparableCandidates"]>[0],
  ): Promise<readonly CandidateComparisonRow[]> {
    this.requests.push(input);
    return Promise.resolve(this.rows.slice(0, input.limit));
  }
}

function comparisonRow(input: {
  readonly candidateId: string;
  readonly candidateName: string;
  readonly score: number;
  readonly monitoringWarningCount?: number;
}): CandidateComparisonRow {
  return {
    candidateId: input.candidateId,
    candidateName: input.candidateName,
    applicationId: `application_${input.candidateId}`,
    interviewSessionId: `interview_${input.candidateId}`,
    evaluationVersionId: `evaluation_${input.candidateId}`,
    overallScore: input.score,
    scoreMin: 1,
    scoreMax: 5,
    overallConfidence: "moderate",
    completedAt: new Date("2026-01-01T00:00:00.000Z"),
    competencies: [
      {
        competencyKey: "communication",
        label: "Communication",
        score: input.score,
        maxScore: 5,
        confidence: "moderate",
        incomplete: false,
      },
    ],
    monitoringContext: {
      included: (input.monitoringWarningCount ?? 0) > 0,
      warningCount: input.monitoringWarningCount ?? 0,
      note: "Monitoring warnings are contextual only and are not included in comparison scores.",
    },
  };
}
