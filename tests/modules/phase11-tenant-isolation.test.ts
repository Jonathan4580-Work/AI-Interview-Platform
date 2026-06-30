import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const schema = readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf8");

const tenantOwnedModels = [
  "User",
  "Role",
  "UserRole",
  "AuthCredential",
  "AuthSession",
  "PasswordResetToken",
  "EmailVerificationToken",
  "AuditEvent",
  "IdempotencyKey",
  "SupportAccessSession",
  "LegalHold",
  "PrivacyRequest",
  "ExportRequest",
  "AnalyticsEvent",
  "AggregateReportRun",
  "ExportArtifact",
  "ExportAccessLog",
  "Department",
  "Team",
  "Location",
  "HiringPipeline",
  "PipelineStage",
  "Job",
  "JobTemplate",
  "Candidate",
  "CandidateApplication",
  "CandidateInvitation",
  "InterviewSession",
  "InterviewTurn",
  "CandidateSession",
  "CandidateConsentRecord",
  "ReadinessCheck",
  "IdentityVerification",
  "AccommodationRequest",
  "CandidateSupportRequest",
  "MonitoringEvent",
  "Transcript",
  "TranscriptVersion",
  "TranscriptSegment",
  "EvaluationRun",
  "EvaluationVersion",
  "HrReport",
  "HrReportVersion",
  "HumanDecisionHistory",
  "NotificationIntent",
  "EmailDelivery",
  "ProcessingWorkflow",
  "ProcessingWorkflowStep",
  "WorkflowDeadLetterJob",
  "MediaObject",
  "MediaUploadSession",
  "MediaUploadPart",
] as const;

describe("Phase 11 tenant isolation schema guardrails", () => {
  it.each(tenantOwnedModels)(
    "%s remains tenant scoped with a companyId field and tenant-leading database access path",
    (modelName) => {
      const block = getModelBlock(modelName);

      expect(block).toContain("companyId");
      expect(block).toMatch(/(?:Company\??\s+@relation|@relation\(fields: \[companyId,)/);
      expect(block).toMatch(/@@(?:unique|index)\(\[companyId(?:,|\])/);
    },
  );
});

function getModelBlock(modelName: string): string {
  const match = new RegExp(`model ${modelName} \\{[\\s\\S]*?\\n\\}`).exec(schema);
  if (match === null) {
    throw new Error(`Prisma model ${modelName} was not found.`);
  }
  return match[0];
}
