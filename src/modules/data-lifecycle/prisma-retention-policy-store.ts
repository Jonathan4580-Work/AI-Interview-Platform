import { Prisma } from "@prisma/client";

import { prisma } from "@/infra/database";

import {
  assertRetentionPolicy,
  createRetentionPolicyRecord,
  type RetentionPolicyRecord,
  type RetentionPolicyStore,
} from "./retention-policy";

export class PrismaRetentionPolicyStore implements RetentionPolicyStore {
  public async upsertPolicy(policy: RetentionPolicyRecord): Promise<RetentionPolicyRecord> {
    assertRetentionPolicy(policy);

    const record = await prisma.companySettings.upsert({
      where: {
        companyId: policy.companyId,
      },
      create: {
        companyId: policy.companyId,
        brandingJson: emptyObjectJson(),
        retentionPolicyJson: toJson(policy),
        emailSettingsJson: emptyObjectJson(),
        featureFlagsJson: emptyObjectJson(),
      },
      update: {
        retentionPolicyJson: toJson(policy),
      },
    });

    return fromJson(policy.companyId, record.retentionPolicyJson);
  }
}

function toJson(policy: RetentionPolicyRecord): Prisma.InputJsonObject {
  return {
    schemaVersion: 1,
    candidateProfileDays: policy.candidateProfileDays,
    candidateSessionDays: policy.candidateSessionDays,
    consentRecordDays: policy.consentRecordDays,
    invitationDays: policy.invitationDays,
    recordingDays: policy.recordingDays,
    monitoringEventDays: policy.monitoringEventDays,
    transcriptDays: policy.transcriptDays,
    evaluationDays: policy.evaluationDays,
    reportDays: policy.reportDays,
    emailDeliveryDays: policy.emailDeliveryDays,
    analyticsEventDays: policy.analyticsEventDays,
    workflowOperationalDays: policy.workflowOperationalDays,
    auditEventDays: policy.auditEventDays,
    identityVerificationDays: policy.identityVerificationDays,
    supportAccessDays: policy.supportAccessDays,
    privacyRequestDays: policy.privacyRequestDays,
    exportRequestDays: policy.exportRequestDays,
  };
}

function fromJson(
  companyId: RetentionPolicyRecord["companyId"],
  value: Prisma.JsonValue,
): RetentionPolicyRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return createRetentionPolicyRecord(companyId);
  }

  return createRetentionPolicyRecord(companyId, {
    candidateProfileDays: readNumber(value, "candidateProfileDays"),
    candidateSessionDays: readNumber(value, "candidateSessionDays"),
    consentRecordDays: readNumber(value, "consentRecordDays"),
    invitationDays: readNumber(value, "invitationDays"),
    recordingDays: readNumber(value, "recordingDays"),
    monitoringEventDays: readNumber(value, "monitoringEventDays"),
    transcriptDays: readNumber(value, "transcriptDays"),
    evaluationDays: readNumber(value, "evaluationDays"),
    reportDays: readNumber(value, "reportDays"),
    emailDeliveryDays: readNumber(value, "emailDeliveryDays"),
    analyticsEventDays: readNumber(value, "analyticsEventDays"),
    workflowOperationalDays: readNumber(value, "workflowOperationalDays"),
    auditEventDays: readNumber(value, "auditEventDays"),
    identityVerificationDays: readNumber(value, "identityVerificationDays"),
    supportAccessDays: readNumber(value, "supportAccessDays"),
    privacyRequestDays: readNumber(value, "privacyRequestDays"),
    exportRequestDays: readNumber(value, "exportRequestDays"),
  });
}

function readNumber(value: Prisma.JsonObject, key: string): number | undefined {
  const raw = value[key];
  return typeof raw === "number" ? raw : undefined;
}

function emptyObjectJson(): Prisma.InputJsonObject {
  return {
    schemaVersion: 1,
  };
}
