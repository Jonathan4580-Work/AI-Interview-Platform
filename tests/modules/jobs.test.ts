import { describe, expect, it } from "vitest";

import { AuditWriter } from "@/modules/audit";
import { createTenantContext } from "@/modules/tenant";
import { JobsDomainError, JobsService } from "@/modules/jobs";

import type { AuditEventStore, PersistedAuditEventInput } from "@/modules/audit";
import type { CompanyUserId, TenantContext, TenantId } from "@/modules/tenant";
import type {
  HiringPipelineId,
  HiringPipelineRecord,
  InterviewPlanId,
  InterviewPlanRecord,
  InterviewPlanVersionId,
  InterviewPlanVersionRecord,
  JobId,
  JobRecord,
  JobsRepository,
  JobTemplateRecord,
  PipelineStageRecord,
} from "@/modules/jobs";

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

class MemoryJobsRepository implements JobsRepository {
  public readonly pipelines = new Map<string, HiringPipelineRecord>();
  public readonly stages = new Map<string, PipelineStageRecord>();
  public readonly templates = new Map<string, JobTemplateRecord>();
  public readonly jobs = new Map<string, JobRecord>();
  public readonly plans = new Map<string, InterviewPlanRecord>();
  public readonly versions = new Map<string, InterviewPlanVersionRecord>();

  public createPipeline(input: Parameters<JobsRepository["createPipeline"]>[0]) {
    const pipeline: HiringPipelineRecord = {
      id: `pipe-${String(this.pipelines.size + 1)}` as HiringPipelineId,
      companyId: input.companyId,
      name: input.name,
      slug: input.slug,
      description: input.description,
      status: "active",
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
    };
    this.pipelines.set(key(input.companyId, pipeline.id), pipeline);
    return Promise.resolve(pipeline);
  }

  public findPipeline(tenantContext: TenantContext, pipelineId: HiringPipelineId) {
    return Promise.resolve(this.pipelines.get(key(tenantContext.companyId, pipelineId)) ?? null);
  }

  public createPipelineStage(input: Parameters<JobsRepository["createPipelineStage"]>[0]) {
    const stage: PipelineStageRecord = {
      id: `stage-${String(this.stages.size + 1)}` as PipelineStageRecord["id"],
      companyId: input.companyId,
      pipelineId: input.pipelineId,
      name: input.name,
      slug: input.slug,
      category: input.category,
      position: input.position,
      isTerminal: input.isTerminal,
      status: "active",
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
    };
    this.stages.set(key(input.companyId, stage.id), stage);
    return Promise.resolve(stage);
  }

  public listPipelineStages(tenantContext: TenantContext, pipelineId: HiringPipelineId) {
    return Promise.resolve(
      [...this.stages.values()].filter(
        (stage) => stage.companyId === tenantContext.companyId && stage.pipelineId === pipelineId,
      ),
    );
  }

  public createJobTemplate(input: Parameters<JobsRepository["createJobTemplate"]>[0]) {
    const template: JobTemplateRecord = {
      id: `template-${String(this.templates.size + 1)}` as JobTemplateRecord["id"],
      companyId: input.companyId,
      pipelineId: input.pipelineId,
      title: input.title,
      slug: input.slug,
      description: input.description,
      requirements: input.requirements,
      employmentType: input.employmentType,
      workplaceType: input.workplaceType,
      seniorityLevel: input.seniorityLevel,
      status: "active",
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
    };
    this.templates.set(key(input.companyId, template.id), template);
    return Promise.resolve(template);
  }

  public createJob(input: Parameters<JobsRepository["createJob"]>[0]) {
    const job: JobRecord = {
      id: `job-${String(this.jobs.size + 1)}` as JobId,
      companyId: input.companyId,
      departmentId: input.departmentId,
      teamId: input.teamId,
      locationId: input.locationId,
      pipelineId: input.pipelineId,
      title: input.title,
      slug: input.slug,
      description: input.description,
      requirements: input.requirements,
      employmentType: input.employmentType,
      workplaceType: input.workplaceType,
      seniorityLevel: input.seniorityLevel,
      status: "draft",
      openedAt: null,
      closedAt: null,
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
    };
    this.jobs.set(key(input.companyId, job.id), job);
    return Promise.resolve(job);
  }

  public findJob(tenantContext: TenantContext, jobId: JobId) {
    return Promise.resolve(this.jobs.get(key(tenantContext.companyId, jobId)) ?? null);
  }

  public updateJobLifecycle(input: Parameters<JobsRepository["updateJobLifecycle"]>[0]) {
    const job = this.jobs.get(key(input.companyId, input.jobId));
    if (job === undefined) {
      throw new Error("Job missing");
    }
    const updated: JobRecord = {
      ...job,
      status: input.status,
      openedAt: input.openedAt === undefined ? job.openedAt : input.openedAt,
      closedAt: input.closedAt === undefined ? job.closedAt : input.closedAt,
      deletedAt: input.deletedAt === undefined ? job.deletedAt : input.deletedAt,
      updatedAt: now(),
    };
    this.jobs.set(key(input.companyId, input.jobId), updated);
    return Promise.resolve(updated);
  }

  public createInterviewPlan(input: Parameters<JobsRepository["createInterviewPlan"]>[0]) {
    const plan: InterviewPlanRecord = {
      id: `plan-${String(this.plans.size + 1)}` as InterviewPlanId,
      companyId: input.companyId,
      jobId: input.jobId,
      jobTemplateId: input.jobTemplateId,
      name: input.name,
      status: "draft",
      activeVersionId: null,
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
    };
    this.plans.set(key(input.companyId, plan.id), plan);
    return Promise.resolve(plan);
  }

  public findInterviewPlan(tenantContext: TenantContext, interviewPlanId: InterviewPlanId) {
    return Promise.resolve(this.plans.get(key(tenantContext.companyId, interviewPlanId)) ?? null);
  }

  public createInterviewPlanVersion(
    input: Parameters<JobsRepository["createInterviewPlanVersion"]>[0],
  ) {
    const version: InterviewPlanVersionRecord = {
      id: `version-${String(this.versions.size + 1)}` as InterviewPlanVersionId,
      companyId: input.companyId,
      interviewPlanId: input.interviewPlanId,
      versionNumber: input.versionNumber,
      status: "draft",
      competencies: input.competencies,
      questionBlueprint: input.questionBlueprint,
      durationMinutes: input.durationMinutes,
      publishedAt: null,
      createdAt: now(),
      updatedAt: now(),
    };
    this.versions.set(key(input.companyId, version.id), version);
    return Promise.resolve(version);
  }

  public publishInterviewPlanVersion(
    input: Parameters<JobsRepository["publishInterviewPlanVersion"]>[0],
  ) {
    const version = this.versions.get(key(input.companyId, input.versionId));
    if (version === undefined) {
      throw new Error("Version missing");
    }
    const updated: InterviewPlanVersionRecord = {
      ...version,
      status: "published",
      publishedAt: input.publishedAt,
      updatedAt: now(),
    };
    this.versions.set(key(input.companyId, input.versionId), updated);
    return Promise.resolve(updated);
  }

  public activateInterviewPlan(input: Parameters<JobsRepository["activateInterviewPlan"]>[0]) {
    const plan = this.plans.get(key(input.companyId, input.interviewPlanId));
    if (plan === undefined) {
      throw new Error("Plan missing");
    }
    const updated: InterviewPlanRecord = {
      ...plan,
      status: "active",
      activeVersionId: input.activeVersionId,
      updatedAt: now(),
    };
    this.plans.set(key(input.companyId, input.interviewPlanId), updated);
    return Promise.resolve(updated);
  }
}

describe("jobs domain", () => {
  it("creates pipelines and ordered terminal stages", async () => {
    const auditStore = new RecordingAuditStore();
    const service = new JobsService(new MemoryJobsRepository(), new AuditWriter(auditStore));

    const pipeline = await service.createPipeline({
      context: { tenant, actor, request },
      name: " Standard Hiring ",
      description: " Default process ",
    });
    const hired = await service.createPipelineStage({
      context: { tenant, actor, request },
      pipelineId: pipeline.id,
      name: "Hired",
      category: "hired",
      position: 10,
    });

    expect(pipeline).toMatchObject({ name: "Standard Hiring", slug: "standard-hiring" });
    expect(hired).toMatchObject({ isTerminal: true, category: "hired" });
    expect(auditStore.events.map((event) => event.action)).toContain("jobs.pipeline_stage_created");
  });

  it("rejects cross-tenant pipeline use", async () => {
    const repository = new MemoryJobsRepository();
    const service = new JobsService(repository, new AuditWriter(new RecordingAuditStore()));
    const pipeline = await repository.createPipeline({
      companyId: otherTenant.companyId,
      name: "Other",
      slug: "other",
      description: null,
    });

    await expect(
      service.createJob({
        context: { tenant, actor, request },
        pipelineId: pipeline.id,
        title: "Recruiter",
        description: { summary: "Owns recruiting operations" },
        requirements: { items: ["Five years of recruiting experience"] },
        employmentType: "full_time",
        workplaceType: "remote",
        seniorityLevel: "senior",
      }),
    ).rejects.toBeInstanceOf(JobsDomainError);
  });

  it("creates job templates and opens jobs from draft state", async () => {
    const repository = new MemoryJobsRepository();
    const auditStore = new RecordingAuditStore();
    const service = new JobsService(repository, new AuditWriter(auditStore));
    const pipeline = await service.createPipeline({
      context: { tenant, actor, request },
      name: "Executive Hiring",
    });

    const template = await service.createJobTemplate({
      context: { tenant, actor, request },
      pipelineId: pipeline.id,
      title: "Engineering Manager",
      description: { summary: "Leads engineering teams" },
      requirements: { items: ["People management experience"] },
      employmentType: "full_time",
      workplaceType: "hybrid",
      seniorityLevel: "senior",
    });
    const job = await service.createJob({
      context: { tenant, actor, request },
      pipelineId: pipeline.id,
      title: "Engineering Manager",
      description: { summary: "Leads platform engineering" },
      requirements: { items: ["People management experience"] },
      employmentType: "full_time",
      workplaceType: "hybrid",
      seniorityLevel: "senior",
    });
    const opened = await service.openJob({ context: { tenant, actor, request }, jobId: job.id });

    expect(template).toMatchObject({ slug: "engineering-manager" });
    expect(opened.status).toBe("open");
    expect(opened.openedAt).toBeInstanceOf(Date);
  });

  it("validates interview plan versions and activates published versions", async () => {
    const repository = new MemoryJobsRepository();
    const service = new JobsService(repository, new AuditWriter(new RecordingAuditStore()));
    const pipeline = await service.createPipeline({
      context: { tenant, actor, request },
      name: "Core",
    });
    const job = await service.createJob({
      context: { tenant, actor, request },
      pipelineId: pipeline.id,
      title: "Product Designer",
      description: { summary: "Designs recruiting workflows" },
      requirements: { items: ["Portfolio of product work"] },
      employmentType: "full_time",
      workplaceType: "remote",
      seniorityLevel: "mid",
    });
    const plan = await service.createInterviewPlanForJob({
      context: { tenant, actor, request },
      jobId: job.id,
      name: "Designer Screen",
    });

    await expect(
      service.addInterviewPlanVersion({
        context: { tenant, actor, request },
        interviewPlanId: plan.id,
        versionNumber: 1,
        durationMinutes: 45,
        competencies: [{ name: "Craft", weight: 80 }],
        questionBlueprint: [{ prompt: "Walk through a project", competency: "Craft" }],
      }),
    ).rejects.toBeInstanceOf(JobsDomainError);

    const version = await service.addInterviewPlanVersion({
      context: { tenant, actor, request },
      interviewPlanId: plan.id,
      versionNumber: 1,
      durationMinutes: 45,
      competencies: [
        { name: "Craft", weight: 70 },
        { name: "Collaboration", weight: 30 },
      ],
      questionBlueprint: [{ prompt: "Walk through a project", competency: "Craft" }],
    });
    const activePlan = await service.publishInterviewPlanVersion({
      context: { tenant, actor, request },
      interviewPlanId: plan.id,
      versionId: version.id,
    });

    expect(activePlan).toMatchObject({
      status: "active",
      activeVersionId: version.id,
    });
  });
});

function now(): Date {
  return new Date("2026-06-30T00:00:00.000Z");
}

function key(companyId: TenantId, id: string): string {
  return `${companyId}:${id}`;
}
