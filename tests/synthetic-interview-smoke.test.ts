import { describe, expect, it } from "vitest";

import { createPermissionSet } from "@/modules/access-control";
import { AI_EVALUATION_SCHEMA_VERSION, AI_REDACTION_POLICY_VERSION } from "@/modules/ai-governance";
import {
  createCandidateCsrfToken,
  createCandidateSessionToken,
  createInvitationToken,
  hashCandidateToken,
  timingSafeHashEqual,
} from "@/modules/candidate-portal";
import { DevelopmentEvaluationProvider } from "@/modules/evaluation";
import { WorkspaceSearchService, type WorkspaceSearchProvider } from "@/modules/search";
import { toTenantId } from "@/modules/tenant";

import type { AiGovernanceArtifacts } from "@/modules/ai-governance";
import type { SearchResult } from "@/modules/search";

describe("synthetic interview smoke flow", () => {
  it("runs a deterministic pilot flow without external providers or real candidate data", async () => {
    const companyId = toTenantId("csyntheticcompany");
    const invitationToken = createInvitationToken();
    const invitationTokenHash = hashCandidateToken(invitationToken);
    const candidateSessionToken = createCandidateSessionToken();
    const candidateCsrfToken = createCandidateCsrfToken();

    const flow = {
      companyId,
      hrUserId: "synthetic_hr_user",
      jobId: "synthetic_job",
      interviewPlanVersionId: "synthetic_plan_version",
      candidateId: "synthetic_candidate",
      invitationId: "synthetic_invitation",
      candidateSessionId: "synthetic_candidate_session",
      readinessStatus: "pass",
      consentVersion: "consent-v1",
      interviewSessionId: "synthetic_interview",
      mediaObjectIds: ["synthetic_media_1", "synthetic_media_2"],
      workflowSteps: [
        "finalize_media",
        "transcribe_recording",
        "evaluate_interview",
        "generate_report",
        "notify_results_ready",
      ],
    };

    expect(timingSafeHashEqual(invitationTokenHash, hashCandidateToken(invitationToken))).toBe(
      true,
    );
    expect(hashCandidateToken(candidateSessionToken)).not.toBe(candidateSessionToken);
    expect(hashCandidateToken(candidateCsrfToken)).not.toBe(candidateCsrfToken);
    expect(flow.readinessStatus).toBe("pass");
    expect(flow.consentVersion).toBe("consent-v1");
    expect(flow.mediaObjectIds).toHaveLength(2);
    expect(flow.workflowSteps).toEqual([
      "finalize_media",
      "transcribe_recording",
      "evaluate_interview",
      "generate_report",
      "notify_results_ready",
    ]);

    const evaluation = await new DevelopmentEvaluationProvider().evaluate({
      redactedInput: {
        schemaVersion: AI_EVALUATION_SCHEMA_VERSION,
        redactionPolicyVersion: AI_REDACTION_POLICY_VERSION,
        interviewSessionId: flow.interviewSessionId,
        transcriptVersionId: "synthetic_transcript_version",
        rubric: governance.rubric,
        segments: [
          {
            transcriptSegmentId: "synthetic_segment_1",
            interviewTurnId: "synthetic_turn_1",
            sequence: 1,
            speaker: "candidate",
            startMs: 0,
            endMs: 30_000,
            text: "I designed a resilient customer onboarding process with measurable outcomes.",
            confidence: 0.9,
            language: "en",
          },
        ],
      },
      governance,
    });

    expect(evaluation.provider).toBe("development");
    expect(evaluation.providerResponseHash).toHaveLength(64);
    expect(evaluation.competencies[0]?.evidence[0]?.transcriptSegmentId).toBe(
      "synthetic_segment_1",
    );
    expect(evaluation.recommendation?.toLowerCase()).not.toContain("hire");

    const search = await new WorkspaceSearchService(
      new SyntheticSearchProvider([
        {
          id: flow.interviewSessionId,
          category: "report",
          title: "Synthetic interview report ready",
          subtitle: "Synthetic Backend Engineer",
          href: `/reports/${flow.interviewSessionId}`,
          score: 100,
          matchedFields: ["report_status"],
          updatedAt: new Date("2026-07-01T00:00:00.000Z"),
          metadata: { status: "ready" },
        },
      ]),
    ).search(
      {
        tenant: { companyId },
        permissionSet: createPermissionSet(["search:workspace", "reports:read"]),
      },
      { query: "synthetic report", categories: ["report"] },
    );

    expect(search.results).toHaveLength(1);
    expect(JSON.stringify(search.results)).not.toContain("onboarding process");
  });
});

const governance: AiGovernanceArtifacts = {
  prompt: {
    id: "synthetic_prompt_version" as never,
    companyId: toTenantId("csyntheticcompany"),
    versionNumber: 1,
    promptHash: "synthetic_prompt_hash",
    systemPrompt: "Evaluate as decision support only.",
    userPromptTemplate: "Return structured JSON.",
    evaluationSchemaVersion: "evaluation-schema-v1",
    redactionPolicyVersion: "redaction-policy-v1",
  },
  rubric: {
    id: "synthetic_rubric_version" as never,
    companyId: toTenantId("csyntheticcompany"),
    versionNumber: 1,
    rubricHash: "synthetic_rubric_hash",
    scoreMin: 1,
    scoreMax: 5,
    competencies: [
      {
        key: "communication",
        label: "Communication",
        description: "Clarity and structure.",
      },
    ],
  },
};

class SyntheticSearchProvider implements WorkspaceSearchProvider {
  public constructor(private readonly results: readonly SearchResult[]) {}

  public search(): Promise<readonly SearchResult[]> {
    return Promise.resolve(this.results);
  }
}
