import { describe, expect, it } from "vitest";

import { AuditWriter } from "@/modules/audit";
import { CandidatesDomainError, CandidatesService } from "@/modules/candidates";
import { createTenantContext } from "@/modules/tenant";

import type { AuditEventStore, PersistedAuditEventInput } from "@/modules/audit";
import type {
  CandidateApplicationId,
  CandidateApplicationRecord,
  CandidateDocumentRecord,
  CandidateId,
  CandidateMergeEventRecord,
  CandidateNoteRecord,
  CandidatesRepository,
  CandidateTagAssignmentId,
  CandidateTagId,
  CandidateTagRecord,
  CandidateUserId,
} from "@/modules/candidates";
import type { JobId } from "@/modules/jobs";
import type { CompanyUserId, TenantContext, TenantId } from "@/modules/tenant";

const tenant = createTenantContext("cm0tenant001");
const otherTenant = createTenantContext("cm0tenant002");
const actor = { type: "user" as const, id: "user-1" as CompanyUserId };
const request = {
  requestId: "req-1",
  correlationId: "corr-1",
  sessionId: "sess-1",
  ipAddress: "127.0.0.1",
  userAgent: "vitest",
};

class RecordingAuditStore implements AuditEventStore {
  public readonly events: PersistedAuditEventInput[] = [];
  public append(event: PersistedAuditEventInput): Promise<void> {
    this.events.push(event);
    return Promise.resolve();
  }
}

class MemoryCandidatesRepository implements CandidatesRepository {
  public readonly candidates = new Map<
    string,
    Awaited<ReturnType<CandidatesRepository["createCandidate"]>>
  >();
  public readonly applications = new Map<string, CandidateApplicationRecord>();

  public createCandidate(input: Parameters<CandidatesRepository["createCandidate"]>[0]) {
    const candidate = {
      id: `cand-${String(this.candidates.size + 1)}` as CandidateId,
      companyId: input.companyId,
      primaryEmail: input.primaryEmail,
      normalizedEmail: input.normalizedEmail,
      fullName: input.fullName,
      phone: input.phone,
      sourceType: input.sourceType,
      sourceLabel: input.sourceLabel,
      status: "active" as const,
      profile: input.profile,
      mergedIntoId: null,
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
    };
    this.candidates.set(key(input.companyId, candidate.id), candidate);
    return Promise.resolve(candidate);
  }

  public findCandidate(tenantContext: TenantContext, candidateId: CandidateId) {
    return Promise.resolve(this.candidates.get(key(tenantContext.companyId, candidateId)) ?? null);
  }

  public updateCandidateStatus(
    input: Parameters<CandidatesRepository["updateCandidateStatus"]>[0],
  ) {
    const candidate = this.candidates.get(key(input.companyId, input.candidateId));
    if (candidate === undefined) {
      throw new Error("Candidate missing");
    }
    const updated = {
      ...candidate,
      status: input.status,
      mergedIntoId: input.mergedIntoId === undefined ? candidate.mergedIntoId : input.mergedIntoId,
      deletedAt: input.deletedAt === undefined ? candidate.deletedAt : input.deletedAt,
      updatedAt: now(),
    };
    this.candidates.set(key(input.companyId, input.candidateId), updated);
    return Promise.resolve(updated);
  }

  public createApplication(input: Parameters<CandidatesRepository["createApplication"]>[0]) {
    const application: CandidateApplicationRecord = {
      id: `app-${String(this.applications.size + 1)}` as CandidateApplicationId,
      companyId: input.companyId,
      candidateId: input.candidateId,
      jobId: input.jobId,
      currentStageId: input.currentStageId,
      status: "new",
      appliedAt: now(),
      rejectedAt: null,
      hiredAt: null,
      metadata: input.metadata,
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
    };
    this.applications.set(key(input.companyId, application.id), application);
    return Promise.resolve(application);
  }

  public updateApplicationStatus(
    input: Parameters<CandidatesRepository["updateApplicationStatus"]>[0],
  ) {
    const application = this.applications.get(key(input.companyId, input.applicationId));
    if (application === undefined) {
      throw new Error("Application missing");
    }
    const updated: CandidateApplicationRecord = {
      ...application,
      status: input.status,
      currentStageId:
        input.currentStageId === undefined ? application.currentStageId : input.currentStageId,
      rejectedAt: input.rejectedAt === undefined ? application.rejectedAt : input.rejectedAt,
      hiredAt: input.hiredAt === undefined ? application.hiredAt : input.hiredAt,
      updatedAt: now(),
    };
    this.applications.set(key(input.companyId, input.applicationId), updated);
    return Promise.resolve(updated);
  }

  public createTag(input: Parameters<CandidatesRepository["createTag"]>[0]) {
    return Promise.resolve({
      id: `tag-${input.slug}` as CandidateTagId,
      companyId: input.companyId,
      name: input.name,
      slug: input.slug,
      color: input.color,
    } satisfies CandidateTagRecord);
  }

  public assignTag(input: Parameters<CandidatesRepository["assignTag"]>[0]) {
    return Promise.resolve(
      `assign-${input.candidateId}-${input.tagId}` as CandidateTagAssignmentId,
    );
  }

  public createNote(input: Parameters<CandidatesRepository["createNote"]>[0]) {
    return Promise.resolve({
      id: "note-1" as CandidateNoteRecord["id"],
      companyId: input.companyId,
      candidateId: input.candidateId,
      authorUserId: input.authorUserId,
      body: input.body,
      visibility: input.visibility,
      createdAt: now(),
    } satisfies CandidateNoteRecord);
  }

  public createDocument(input: Parameters<CandidatesRepository["createDocument"]>[0]) {
    return Promise.resolve({
      id: "doc-1" as CandidateDocumentRecord["id"],
      companyId: input.companyId,
      candidateId: input.candidateId,
      type: input.type,
      fileName: input.fileName,
      contentType: input.contentType,
      storageKey: input.storageKey,
      sizeBytes: input.sizeBytes,
      checksumSha256: input.checksumSha256,
      createdAt: now(),
    } satisfies CandidateDocumentRecord);
  }

  public createMergeEvent(input: Parameters<CandidatesRepository["createMergeEvent"]>[0]) {
    return Promise.resolve({
      id: "merge-1" as CandidateMergeEventRecord["id"],
      companyId: input.companyId,
      sourceCandidateId: input.sourceCandidateId,
      targetCandidateId: input.targetCandidateId,
      mergedByUserId: input.mergedByUserId,
      reason: input.reason,
      createdAt: now(),
    } satisfies CandidateMergeEventRecord);
  }
}

describe("candidate domain", () => {
  it("creates normalized candidate profiles and audit records", async () => {
    const auditStore = new RecordingAuditStore();
    const service = new CandidatesService(
      new MemoryCandidatesRepository(),
      new AuditWriter(auditStore),
    );

    const candidate = await service.createCandidate({
      context: { tenant, actor, request },
      fullName: "  Ada   Lovelace ",
      primaryEmail: "ADA@EXAMPLE.COM",
      profile: { links: ["https://example.com/profile"] },
    });

    expect(candidate).toMatchObject({
      fullName: "Ada Lovelace",
      primaryEmail: "ada@example.com",
      normalizedEmail: "ada@example.com",
    });
    expect(auditStore.events[0]?.action).toBe("candidates.candidate_created");
  });

  it("protects candidate lookup by tenant", async () => {
    const repository = new MemoryCandidatesRepository();
    const service = new CandidatesService(repository, new AuditWriter(new RecordingAuditStore()));
    const candidate = await repository.createCandidate({
      companyId: otherTenant.companyId,
      fullName: "Other Candidate",
      primaryEmail: null,
      normalizedEmail: null,
      phone: null,
      sourceType: "manual",
      sourceLabel: null,
      profile: {},
    });

    await expect(
      service.createApplication({
        context: { tenant, actor, request },
        candidateId: candidate.id,
        jobId: "job-1" as JobId,
      }),
    ).rejects.toBeInstanceOf(CandidatesDomainError);
  });

  it("creates applications, notes, tags, and documents for active candidates", async () => {
    const repository = new MemoryCandidatesRepository();
    const auditStore = new RecordingAuditStore();
    const service = new CandidatesService(repository, new AuditWriter(auditStore));
    const candidate = await service.createCandidate({
      context: { tenant, actor, request },
      fullName: "Grace Hopper",
    });

    const application = await service.createApplication({
      context: { tenant, actor, request },
      candidateId: candidate.id,
      jobId: "job-1" as JobId,
    });
    const tag = await service.createTag({
      context: { tenant, actor, request },
      name: "Strong Fit",
      color: "#0F766E",
    });
    await service.assignTag({
      context: { tenant, actor, request },
      candidateId: candidate.id,
      tagId: tag.id,
    });
    const note = await service.addNote({
      context: { tenant, actor, request },
      candidateId: candidate.id,
      authorUserId: "user-1" as CandidateUserId,
      body: "Excellent systems background",
    });
    const document = await service.attachDocument({
      context: { tenant, actor, request },
      candidateId: candidate.id,
      type: "resume",
      fileName: "resume.pdf",
      contentType: "application/pdf",
      storageKey: "tenant/candidate/resume.pdf",
      sizeBytes: 100,
      checksumSha256: "a".repeat(64),
    });

    expect(application.status).toBe("new");
    expect(note.body).toBe("Excellent systems background");
    expect(document.contentType).toBe("application/pdf");
    expect(auditStore.events.map((event) => event.action)).toContain("candidates.tag_assigned");
  });

  it("merges active candidates and blocks self merge", async () => {
    const repository = new MemoryCandidatesRepository();
    const service = new CandidatesService(repository, new AuditWriter(new RecordingAuditStore()));
    const source = await service.createCandidate({
      context: { tenant, actor, request },
      fullName: "Source",
    });
    const target = await service.createCandidate({
      context: { tenant, actor, request },
      fullName: "Target",
    });

    await expect(
      service.mergeCandidates({
        context: { tenant, actor, request },
        sourceCandidateId: source.id,
        targetCandidateId: source.id,
        mergedByUserId: "user-1" as CandidateUserId,
        reason: "Duplicate profile",
      }),
    ).rejects.toBeInstanceOf(CandidatesDomainError);

    const merge = await service.mergeCandidates({
      context: { tenant, actor, request },
      sourceCandidateId: source.id,
      targetCandidateId: target.id,
      mergedByUserId: "user-1" as CandidateUserId,
      reason: "Duplicate profile",
    });

    expect(merge).toMatchObject({
      sourceCandidateId: source.id,
      targetCandidateId: target.id,
    });
  });
});

function now(): Date {
  return new Date("2026-06-30T00:00:00.000Z");
}

function key(companyId: TenantId, id: string): string {
  return `${companyId}:${id}`;
}
