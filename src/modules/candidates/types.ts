import type { AuditRequestContext } from "@/modules/audit";
import type { JobId, PipelineStageId } from "@/modules/jobs";
import type { CompanyActor, TenantContext, TenantId } from "@/modules/tenant";
import type { Brand } from "@/shared";

export type CandidateId = Brand<string, "CandidateId">;
export type CandidateApplicationId = Brand<string, "CandidateApplicationId">;
export type CandidateDocumentId = Brand<string, "CandidateDocumentId">;
export type CandidateTagId = Brand<string, "CandidateTagId">;
export type CandidateTagAssignmentId = Brand<string, "CandidateTagAssignmentId">;
export type CandidateNoteId = Brand<string, "CandidateNoteId">;
export type CandidateMergeEventId = Brand<string, "CandidateMergeEventId">;
export type CandidateUserId = Brand<string, "CandidateUserId">;

export type CandidateStatus = "active" | "archived" | "merged";
export type CandidateSourceType = "manual" | "referral" | "import" | "application" | "invitation";
export type ApplicationStatus =
  "new" | "in_review" | "interview" | "offer" | "hired" | "rejected" | "withdrawn" | "archived";
export type CandidateDocumentType = "resume" | "cover_letter" | "portfolio" | "other";
export type CandidateNoteVisibility = "internal" | "private";

export interface CandidateMutationContext {
  readonly tenant: TenantContext;
  readonly actor: CompanyActor;
  readonly request: AuditRequestContext;
  readonly supportAccessSessionId?: string | null;
}

export interface CandidateProfile {
  readonly headline?: string;
  readonly links?: readonly string[];
}

export interface CandidateRecord {
  readonly id: CandidateId;
  readonly companyId: TenantId;
  readonly primaryEmail: string | null;
  readonly normalizedEmail: string | null;
  readonly fullName: string;
  readonly phone: string | null;
  readonly sourceType: CandidateSourceType;
  readonly sourceLabel: string | null;
  readonly status: CandidateStatus;
  readonly profile: CandidateProfile;
  readonly mergedIntoId: CandidateId | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
}

export interface CandidateApplicationRecord {
  readonly id: CandidateApplicationId;
  readonly companyId: TenantId;
  readonly candidateId: CandidateId;
  readonly jobId: JobId;
  readonly currentStageId: PipelineStageId | null;
  readonly status: ApplicationStatus;
  readonly appliedAt: Date;
  readonly rejectedAt: Date | null;
  readonly hiredAt: Date | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
}

export interface CandidateDocumentRecord {
  readonly id: CandidateDocumentId;
  readonly companyId: TenantId;
  readonly candidateId: CandidateId;
  readonly type: CandidateDocumentType;
  readonly fileName: string;
  readonly contentType: string;
  readonly storageKey: string;
  readonly sizeBytes: number;
  readonly checksumSha256: string;
  readonly createdAt: Date;
}

export interface CandidateTagRecord {
  readonly id: CandidateTagId;
  readonly companyId: TenantId;
  readonly name: string;
  readonly slug: string;
  readonly color: string | null;
}

export interface CandidateNoteRecord {
  readonly id: CandidateNoteId;
  readonly companyId: TenantId;
  readonly candidateId: CandidateId;
  readonly authorUserId: CandidateUserId;
  readonly body: string;
  readonly visibility: CandidateNoteVisibility;
  readonly createdAt: Date;
}

export interface CandidateMergeEventRecord {
  readonly id: CandidateMergeEventId;
  readonly companyId: TenantId;
  readonly sourceCandidateId: CandidateId;
  readonly targetCandidateId: CandidateId;
  readonly mergedByUserId: CandidateUserId;
  readonly reason: string;
  readonly createdAt: Date;
}

export interface CandidatesRepository {
  createCandidate(input: {
    readonly companyId: TenantId;
    readonly primaryEmail: string | null;
    readonly normalizedEmail: string | null;
    readonly fullName: string;
    readonly phone: string | null;
    readonly sourceType: CandidateSourceType;
    readonly sourceLabel: string | null;
    readonly profile: CandidateProfile;
  }): Promise<CandidateRecord>;
  findCandidate(tenant: TenantContext, candidateId: CandidateId): Promise<CandidateRecord | null>;
  updateCandidateStatus(input: {
    readonly companyId: TenantId;
    readonly candidateId: CandidateId;
    readonly status: CandidateStatus;
    readonly mergedIntoId?: CandidateId | null;
    readonly deletedAt?: Date | null;
  }): Promise<CandidateRecord>;
  createApplication(input: {
    readonly companyId: TenantId;
    readonly candidateId: CandidateId;
    readonly jobId: JobId;
    readonly currentStageId: PipelineStageId | null;
    readonly metadata: Record<string, unknown>;
  }): Promise<CandidateApplicationRecord>;
  updateApplicationStatus(input: {
    readonly companyId: TenantId;
    readonly applicationId: CandidateApplicationId;
    readonly status: ApplicationStatus;
    readonly currentStageId?: PipelineStageId | null;
    readonly rejectedAt?: Date | null;
    readonly hiredAt?: Date | null;
  }): Promise<CandidateApplicationRecord>;
  createTag(input: {
    readonly companyId: TenantId;
    readonly name: string;
    readonly slug: string;
    readonly color: string | null;
  }): Promise<CandidateTagRecord>;
  assignTag(input: {
    readonly companyId: TenantId;
    readonly candidateId: CandidateId;
    readonly tagId: CandidateTagId;
  }): Promise<CandidateTagAssignmentId>;
  createNote(input: {
    readonly companyId: TenantId;
    readonly candidateId: CandidateId;
    readonly authorUserId: CandidateUserId;
    readonly body: string;
    readonly visibility: CandidateNoteVisibility;
  }): Promise<CandidateNoteRecord>;
  createDocument(input: {
    readonly companyId: TenantId;
    readonly candidateId: CandidateId;
    readonly type: CandidateDocumentType;
    readonly fileName: string;
    readonly contentType: string;
    readonly storageKey: string;
    readonly sizeBytes: number;
    readonly checksumSha256: string;
  }): Promise<CandidateDocumentRecord>;
  createMergeEvent(input: {
    readonly companyId: TenantId;
    readonly sourceCandidateId: CandidateId;
    readonly targetCandidateId: CandidateId;
    readonly mergedByUserId: CandidateUserId;
    readonly reason: string;
  }): Promise<CandidateMergeEventRecord>;
}
