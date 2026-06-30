import { AuditWriter } from "@/modules/audit";
import { normalizeDisplayName, slugify } from "@/modules/organization";

import type {
  CandidateApplicationId,
  CandidateApplicationRecord,
  CandidateDocumentRecord,
  CandidateDocumentType,
  CandidateId,
  CandidateMergeEventRecord,
  CandidateMutationContext,
  CandidateNoteRecord,
  CandidateNoteVisibility,
  CandidateProfile,
  CandidateRecord,
  CandidatesRepository,
  CandidateTagRecord,
  CandidateUserId,
} from "./types";
import type { JobId, PipelineStageId } from "@/modules/jobs";

export class CandidatesDomainError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "CandidatesDomainError";
  }
}

export class CandidatesService {
  public constructor(
    private readonly repository: CandidatesRepository,
    private readonly auditWriter: AuditWriter,
  ) {}

  public async createCandidate(input: {
    readonly context: CandidateMutationContext;
    readonly fullName: string;
    readonly primaryEmail?: string | null;
    readonly phone?: string | null;
    readonly sourceType?: CandidateRecord["sourceType"];
    readonly sourceLabel?: string | null;
    readonly profile?: CandidateProfile;
  }): Promise<CandidateRecord> {
    const email = normalizeEmail(input.primaryEmail ?? null);
    const candidate = await this.repository.createCandidate({
      companyId: input.context.tenant.companyId,
      fullName: normalizeDisplayName(input.fullName, "Candidate full name"),
      primaryEmail: email,
      normalizedEmail: email,
      phone: normalizePhone(input.phone ?? null),
      sourceType: input.sourceType ?? "manual",
      sourceLabel: normalizeOptionalText(input.sourceLabel, 120, "Candidate source"),
      profile: normalizeProfile(input.profile ?? {}),
    });

    await this.writeAudit(
      input.context,
      "candidates.candidate_created",
      "candidate",
      candidate.id,
      {
        after: candidate,
      },
    );
    return candidate;
  }

  public async archiveCandidate(input: {
    readonly context: CandidateMutationContext;
    readonly candidateId: CandidateId;
  }): Promise<CandidateRecord> {
    const existing = await this.requireActiveCandidate(input.context, input.candidateId);
    const candidate = await this.repository.updateCandidateStatus({
      companyId: input.context.tenant.companyId,
      candidateId: input.candidateId,
      status: "archived",
      deletedAt: new Date(),
    });

    await this.writeAudit(
      input.context,
      "candidates.candidate_archived",
      "candidate",
      candidate.id,
      {
        before: existing,
        after: candidate,
      },
    );
    return candidate;
  }

  public async createApplication(input: {
    readonly context: CandidateMutationContext;
    readonly candidateId: CandidateId;
    readonly jobId: JobId;
    readonly currentStageId?: PipelineStageId | null;
    readonly metadata?: Record<string, unknown>;
  }): Promise<CandidateApplicationRecord> {
    await this.requireActiveCandidate(input.context, input.candidateId);
    const application = await this.repository.createApplication({
      companyId: input.context.tenant.companyId,
      candidateId: input.candidateId,
      jobId: input.jobId,
      currentStageId: input.currentStageId ?? null,
      metadata: input.metadata ?? {},
    });

    await this.writeAudit(
      input.context,
      "candidates.application_created",
      "candidate_application",
      application.id,
      {
        after: application,
      },
    );
    return application;
  }

  public async moveApplication(input: {
    readonly context: CandidateMutationContext;
    readonly applicationId: CandidateApplicationId;
    readonly status: CandidateApplicationRecord["status"];
    readonly currentStageId?: PipelineStageId | null;
  }): Promise<CandidateApplicationRecord> {
    if (input.status === "new" || input.status === "archived") {
      throw new CandidatesDomainError("Applications can only move into active lifecycle statuses.");
    }

    const application = await this.repository.updateApplicationStatus({
      companyId: input.context.tenant.companyId,
      applicationId: input.applicationId,
      status: input.status,
      currentStageId: input.currentStageId,
      rejectedAt: input.status === "rejected" ? new Date() : undefined,
      hiredAt: input.status === "hired" ? new Date() : undefined,
    });

    await this.writeAudit(
      input.context,
      "candidates.application_moved",
      "candidate_application",
      application.id,
      { after: application },
    );
    return application;
  }

  public async createTag(input: {
    readonly context: CandidateMutationContext;
    readonly name: string;
    readonly color?: string | null;
  }): Promise<CandidateTagRecord> {
    const name = normalizeDisplayName(input.name, "Candidate tag");
    const tag = await this.repository.createTag({
      companyId: input.context.tenant.companyId,
      name,
      slug: slugify(name),
      color: normalizeColor(input.color ?? null),
    });
    await this.writeAudit(input.context, "candidates.tag_created", "candidate_tag", tag.id, {
      after: tag,
    });
    return tag;
  }

  public async assignTag(input: {
    readonly context: CandidateMutationContext;
    readonly candidateId: CandidateId;
    readonly tagId: CandidateTagRecord["id"];
  }): Promise<void> {
    await this.requireActiveCandidate(input.context, input.candidateId);
    const assignmentId = await this.repository.assignTag({
      companyId: input.context.tenant.companyId,
      candidateId: input.candidateId,
      tagId: input.tagId,
    });
    await this.writeAudit(
      input.context,
      "candidates.tag_assigned",
      "candidate_tag_assignment",
      assignmentId,
      {
        after: { candidateId: input.candidateId, tagId: input.tagId },
      },
    );
  }

  public async addNote(input: {
    readonly context: CandidateMutationContext;
    readonly candidateId: CandidateId;
    readonly authorUserId: CandidateUserId;
    readonly body: string;
    readonly visibility?: CandidateNoteVisibility;
  }): Promise<CandidateNoteRecord> {
    await this.requireActiveCandidate(input.context, input.candidateId);
    const note = await this.repository.createNote({
      companyId: input.context.tenant.companyId,
      candidateId: input.candidateId,
      authorUserId: input.authorUserId,
      body: normalizeLongText(input.body, 10_000, "Candidate note"),
      visibility: input.visibility ?? "internal",
    });
    await this.writeAudit(input.context, "candidates.note_created", "candidate_note", note.id, {
      after: { ...note, body: "[redacted]" },
    });
    return note;
  }

  public async attachDocument(input: {
    readonly context: CandidateMutationContext;
    readonly candidateId: CandidateId;
    readonly type: CandidateDocumentType;
    readonly fileName: string;
    readonly contentType: string;
    readonly storageKey: string;
    readonly sizeBytes: number;
    readonly checksumSha256: string;
  }): Promise<CandidateDocumentRecord> {
    await this.requireActiveCandidate(input.context, input.candidateId);
    if (input.sizeBytes <= 0) {
      throw new CandidatesDomainError("Candidate document size must be greater than zero.");
    }
    if (!/^[a-f0-9]{64}$/.test(input.checksumSha256)) {
      throw new CandidatesDomainError("Candidate document checksum must be a SHA-256 hex digest.");
    }

    const document = await this.repository.createDocument({
      companyId: input.context.tenant.companyId,
      candidateId: input.candidateId,
      type: input.type,
      fileName: normalizeDisplayName(input.fileName, "Document file name"),
      contentType: normalizeContentType(input.contentType),
      storageKey: normalizeLongText(input.storageKey, 512, "Document storage key"),
      sizeBytes: input.sizeBytes,
      checksumSha256: input.checksumSha256,
    });
    await this.writeAudit(
      input.context,
      "candidates.document_attached",
      "candidate_document",
      document.id,
      {
        after: document,
      },
    );
    return document;
  }

  public async mergeCandidates(input: {
    readonly context: CandidateMutationContext;
    readonly sourceCandidateId: CandidateId;
    readonly targetCandidateId: CandidateId;
    readonly mergedByUserId: CandidateUserId;
    readonly reason: string;
  }): Promise<CandidateMergeEventRecord> {
    if (input.sourceCandidateId === input.targetCandidateId) {
      throw new CandidatesDomainError("A candidate cannot be merged into itself.");
    }
    const source = await this.requireActiveCandidate(input.context, input.sourceCandidateId);
    await this.requireActiveCandidate(input.context, input.targetCandidateId);
    const reason = normalizeLongText(input.reason, 1000, "Merge reason");

    await this.repository.updateCandidateStatus({
      companyId: input.context.tenant.companyId,
      candidateId: input.sourceCandidateId,
      status: "merged",
      mergedIntoId: input.targetCandidateId,
      deletedAt: new Date(),
    });
    const merge = await this.repository.createMergeEvent({
      companyId: input.context.tenant.companyId,
      sourceCandidateId: input.sourceCandidateId,
      targetCandidateId: input.targetCandidateId,
      mergedByUserId: input.mergedByUserId,
      reason,
    });

    await this.writeAudit(input.context, "candidates.candidate_merged", "candidate", source.id, {
      before: source,
      after: merge,
    });
    return merge;
  }

  private async requireActiveCandidate(
    context: CandidateMutationContext,
    candidateId: CandidateId,
  ): Promise<CandidateRecord> {
    const candidate = await this.repository.findCandidate(context.tenant, candidateId);
    if (candidate === null) {
      throw new CandidatesDomainError("Candidate was not found for this company.");
    }
    if (candidate.status !== "active") {
      throw new CandidatesDomainError("Only active candidates can be changed.");
    }
    return candidate;
  }

  private async writeAudit(
    context: CandidateMutationContext,
    action: string,
    resourceType: string,
    resourceId: string,
    snapshots: { readonly before?: unknown; readonly after?: unknown },
  ): Promise<void> {
    await this.auditWriter.record({
      companyId: context.tenant.companyId,
      actor:
        context.actor.type === "system"
          ? { type: "system", id: null }
          : { type: context.actor.type, id: context.actor.id },
      request: context.request,
      supportAccessSessionId: context.supportAccessSessionId,
      action,
      resourceType,
      resourceId,
      riskLevel: "medium",
      before: snapshots.before,
      after: snapshots.after,
    });
  }
}

function normalizeEmail(value: string | null): string | null {
  if (value === null || value.trim().length === 0) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new CandidatesDomainError("Candidate email must be valid.");
  }
  return normalized;
}

function normalizePhone(value: string | null): string | null {
  if (value === null || value.trim().length === 0) {
    return null;
  }
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length > 40) {
    throw new CandidatesDomainError("Candidate phone cannot exceed 40 characters.");
  }
  return normalized;
}

function normalizeOptionalText(
  value: string | null | undefined,
  maxLength: number,
  label: string,
): string | null {
  if (value === null || value === undefined || value.trim().length === 0) {
    return null;
  }
  return normalizeLongText(value, maxLength, label);
}

function normalizeLongText(value: string, maxLength: number, label: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length === 0 || normalized.length > maxLength) {
    throw new CandidatesDomainError(
      `${label} must be between 1 and ${String(maxLength)} characters.`,
    );
  }
  return normalized;
}

function normalizeProfile(profile: CandidateProfile): CandidateProfile {
  return {
    ...(profile.headline === undefined
      ? {}
      : { headline: normalizeLongText(profile.headline, 160, "Candidate headline") }),
    ...(profile.links === undefined
      ? {}
      : {
          links: profile.links.map((link) => {
            try {
              return new URL(link).toString();
            } catch {
              throw new CandidatesDomainError("Candidate profile links must be valid URLs.");
            }
          }),
        }),
  };
}

function normalizeColor(value: string | null): string | null {
  if (value === null || value.trim().length === 0) {
    return null;
  }
  const normalized = value.trim().toUpperCase();
  if (!/^#[0-9A-F]{6}$/.test(normalized)) {
    throw new CandidatesDomainError("Candidate tag color must be a six-character hex color.");
  }
  return normalized;
}

function normalizeContentType(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9.+-]*\/[a-z0-9][a-z0-9.+-]*$/.test(normalized)) {
    throw new CandidatesDomainError("Document content type must be valid.");
  }
  return normalized;
}
