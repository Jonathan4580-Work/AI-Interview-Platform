import { AuditWriter } from "@/modules/audit";
import { normalizeDisplayName, slugify } from "@/modules/organization";

import type {
  EmploymentType,
  HiringPipelineId,
  InterviewCompetency,
  InterviewPlanId,
  InterviewPlanRecord,
  InterviewPlanVersionRecord,
  JobContent,
  JobId,
  JobRecord,
  JobRequirements,
  JobTemplateRecord,
  JobsMutationContext,
  JobsRepository,
  PipelineStageCategory,
  PipelineStageRecord,
  QuestionBlueprint,
  SeniorityLevel,
  WorkplaceType,
} from "./types";

export class JobsDomainError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "JobsDomainError";
  }
}

export class JobsService {
  public constructor(
    private readonly repository: JobsRepository,
    private readonly auditWriter: AuditWriter,
  ) {}

  public async createPipeline(input: {
    readonly context: JobsMutationContext;
    readonly name: string;
    readonly description?: string | null;
  }) {
    const name = normalizeDisplayName(input.name, "Pipeline name");
    const pipeline = await this.repository.createPipeline({
      companyId: input.context.tenant.companyId,
      name,
      slug: slugify(name),
      description: normalizeOptionalText(input.description, 500, "Pipeline description"),
    });

    await this.writeAudit(input.context, "jobs.pipeline_created", "hiring_pipeline", pipeline.id, {
      after: pipeline,
    });
    return pipeline;
  }

  public async createPipelineStage(input: {
    readonly context: JobsMutationContext;
    readonly pipelineId: HiringPipelineId;
    readonly name: string;
    readonly category: PipelineStageCategory;
    readonly position: number;
    readonly isTerminal?: boolean;
  }): Promise<PipelineStageRecord> {
    await this.requireActivePipeline(input.context, input.pipelineId);
    assertPositivePosition(input.position);
    const stages = await this.repository.listPipelineStages(input.context.tenant, input.pipelineId);
    if (stages.some((stage) => stage.position === input.position && stage.status === "active")) {
      throw new JobsDomainError("Pipeline stage position is already in use.");
    }

    const name = normalizeDisplayName(input.name, "Pipeline stage name");
    const isTerminal =
      input.isTerminal ?? (input.category === "hired" || input.category === "rejected");
    if ((input.category === "hired" || input.category === "rejected") && !isTerminal) {
      throw new JobsDomainError("Hired and rejected stages must be terminal.");
    }

    const stage = await this.repository.createPipelineStage({
      companyId: input.context.tenant.companyId,
      pipelineId: input.pipelineId,
      name,
      slug: slugify(name),
      category: input.category,
      position: input.position,
      isTerminal,
    });

    await this.writeAudit(
      input.context,
      "jobs.pipeline_stage_created",
      "pipeline_stage",
      stage.id,
      {
        after: stage,
      },
    );
    return stage;
  }

  public async createJobTemplate(input: {
    readonly context: JobsMutationContext;
    readonly pipelineId?: HiringPipelineId | null;
    readonly title: string;
    readonly description: JobContent;
    readonly requirements: JobRequirements;
    readonly employmentType?: EmploymentType | null;
    readonly workplaceType?: WorkplaceType | null;
    readonly seniorityLevel?: SeniorityLevel | null;
  }): Promise<JobTemplateRecord> {
    const pipelineId = input.pipelineId ?? null;
    if (pipelineId !== null) {
      await this.requireActivePipeline(input.context, pipelineId);
    }
    const title = normalizeDisplayName(input.title, "Job template title");

    const template = await this.repository.createJobTemplate({
      companyId: input.context.tenant.companyId,
      pipelineId,
      title,
      slug: slugify(title),
      description: normalizeJobContent(input.description),
      requirements: normalizeRequirements(input.requirements),
      employmentType: input.employmentType ?? null,
      workplaceType: input.workplaceType ?? null,
      seniorityLevel: input.seniorityLevel ?? null,
    });

    await this.writeAudit(input.context, "jobs.template_created", "job_template", template.id, {
      after: template,
    });
    return template;
  }

  public async createJob(input: {
    readonly context: JobsMutationContext;
    readonly pipelineId: HiringPipelineId;
    readonly title: string;
    readonly description: JobContent;
    readonly requirements: JobRequirements;
    readonly employmentType: EmploymentType;
    readonly workplaceType: WorkplaceType;
    readonly seniorityLevel: SeniorityLevel;
    readonly departmentId?: JobRecord["departmentId"];
    readonly teamId?: JobRecord["teamId"];
    readonly locationId?: JobRecord["locationId"];
  }): Promise<JobRecord> {
    await this.requireActivePipeline(input.context, input.pipelineId);
    const title = normalizeDisplayName(input.title, "Job title");

    const job = await this.repository.createJob({
      companyId: input.context.tenant.companyId,
      departmentId: input.departmentId ?? null,
      teamId: input.teamId ?? null,
      locationId: input.locationId ?? null,
      pipelineId: input.pipelineId,
      title,
      slug: slugify(title),
      description: normalizeJobContent(input.description),
      requirements: normalizeRequirements(input.requirements),
      employmentType: input.employmentType,
      workplaceType: input.workplaceType,
      seniorityLevel: input.seniorityLevel,
    });

    await this.writeAudit(input.context, "jobs.job_created", "job", job.id, { after: job });
    return job;
  }

  public async openJob(input: {
    readonly context: JobsMutationContext;
    readonly jobId: JobId;
  }): Promise<JobRecord> {
    const existing = await this.requireJob(input.context, input.jobId);
    if (existing.status !== "draft" && existing.status !== "paused") {
      throw new JobsDomainError("Only draft or paused jobs can be opened.");
    }

    const job = await this.repository.updateJobLifecycle({
      companyId: input.context.tenant.companyId,
      jobId: input.jobId,
      status: "open",
      openedAt: existing.openedAt ?? new Date(),
      closedAt: null,
    });

    await this.writeAudit(input.context, "jobs.job_opened", "job", job.id, {
      before: existing,
      after: job,
    });
    return job;
  }

  public async closeJob(input: {
    readonly context: JobsMutationContext;
    readonly jobId: JobId;
  }): Promise<JobRecord> {
    const existing = await this.requireJob(input.context, input.jobId);
    if (existing.status !== "open" && existing.status !== "paused") {
      throw new JobsDomainError("Only open or paused jobs can be closed.");
    }

    const job = await this.repository.updateJobLifecycle({
      companyId: input.context.tenant.companyId,
      jobId: input.jobId,
      status: "closed",
      closedAt: new Date(),
    });

    await this.writeAudit(input.context, "jobs.job_closed", "job", job.id, {
      before: existing,
      after: job,
    });
    return job;
  }

  public async createInterviewPlanForJob(input: {
    readonly context: JobsMutationContext;
    readonly jobId: JobId;
    readonly name: string;
  }): Promise<InterviewPlanRecord> {
    await this.requireJob(input.context, input.jobId);
    const name = normalizeDisplayName(input.name, "Interview plan name");

    const plan = await this.repository.createInterviewPlan({
      companyId: input.context.tenant.companyId,
      jobId: input.jobId,
      jobTemplateId: null,
      name,
    });

    await this.writeAudit(input.context, "jobs.interview_plan_created", "interview_plan", plan.id, {
      after: plan,
    });
    return plan;
  }

  public async addInterviewPlanVersion(input: {
    readonly context: JobsMutationContext;
    readonly interviewPlanId: InterviewPlanId;
    readonly versionNumber: number;
    readonly competencies: readonly InterviewCompetency[];
    readonly questionBlueprint: readonly QuestionBlueprint[];
    readonly durationMinutes: number;
  }): Promise<InterviewPlanVersionRecord> {
    await this.requireInterviewPlan(input.context, input.interviewPlanId);
    const competencies = normalizeCompetencies(input.competencies);
    const questionBlueprint = normalizeQuestionBlueprint(input.questionBlueprint);
    if (input.durationMinutes < 5 || input.durationMinutes > 240) {
      throw new JobsDomainError("Interview duration must be between 5 and 240 minutes.");
    }

    const version = await this.repository.createInterviewPlanVersion({
      companyId: input.context.tenant.companyId,
      interviewPlanId: input.interviewPlanId,
      versionNumber: input.versionNumber,
      competencies,
      questionBlueprint,
      durationMinutes: input.durationMinutes,
    });

    await this.writeAudit(
      input.context,
      "jobs.interview_plan_version_created",
      "interview_plan_version",
      version.id,
      { after: version },
    );
    return version;
  }

  public async publishInterviewPlanVersion(input: {
    readonly context: JobsMutationContext;
    readonly interviewPlanId: InterviewPlanId;
    readonly versionId: InterviewPlanVersionRecord["id"];
  }): Promise<InterviewPlanRecord> {
    await this.requireInterviewPlan(input.context, input.interviewPlanId);
    const publishedAt = new Date();
    const version = await this.repository.publishInterviewPlanVersion({
      companyId: input.context.tenant.companyId,
      interviewPlanId: input.interviewPlanId,
      versionId: input.versionId,
      publishedAt,
    });
    const plan = await this.repository.activateInterviewPlan({
      companyId: input.context.tenant.companyId,
      interviewPlanId: input.interviewPlanId,
      activeVersionId: version.id,
    });

    await this.writeAudit(
      input.context,
      "jobs.interview_plan_version_published",
      "interview_plan",
      plan.id,
      {
        after: { plan, version },
      },
    );
    return plan;
  }

  private async requireActivePipeline(
    context: JobsMutationContext,
    pipelineId: HiringPipelineId,
  ): Promise<void> {
    const pipeline = await this.repository.findPipeline(context.tenant, pipelineId);
    if (pipeline === null) {
      throw new JobsDomainError("Hiring pipeline was not found for this company.");
    }
    if (pipeline.status !== "active") {
      throw new JobsDomainError("Archived hiring pipelines cannot be used.");
    }
  }

  private async requireJob(context: JobsMutationContext, jobId: JobId): Promise<JobRecord> {
    const job = await this.repository.findJob(context.tenant, jobId);
    if (job === null) {
      throw new JobsDomainError("Job was not found for this company.");
    }
    if (job.status === "archived") {
      throw new JobsDomainError("Archived jobs cannot be changed.");
    }
    return job;
  }

  private async requireInterviewPlan(
    context: JobsMutationContext,
    interviewPlanId: InterviewPlanId,
  ): Promise<void> {
    const plan = await this.repository.findInterviewPlan(context.tenant, interviewPlanId);
    if (plan === null) {
      throw new JobsDomainError("Interview plan was not found for this company.");
    }
    if (plan.status === "archived") {
      throw new JobsDomainError("Archived interview plans cannot be changed.");
    }
  }

  private async writeAudit(
    context: JobsMutationContext,
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

function normalizeOptionalText(
  value: string | null | undefined,
  maxLength: number,
  label: string,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length === 0) {
    return null;
  }
  if (normalized.length > maxLength) {
    throw new JobsDomainError(`${label} cannot exceed ${String(maxLength)} characters.`);
  }
  return normalized;
}

function assertPositivePosition(position: number): void {
  if (!Number.isInteger(position) || position < 1 || position > 200) {
    throw new JobsDomainError("Pipeline stage position must be an integer from 1 to 200.");
  }
}

function normalizeJobContent(content: JobContent): JobContent {
  const summary = normalizeDisplayName(content.summary, "Job summary");
  const details = normalizeOptionalText(content.details, 20_000, "Job details");
  return details === null ? { summary } : { summary, details };
}

function normalizeRequirements(requirements: JobRequirements): JobRequirements {
  const items = requirements.items.map((item) => normalizeDisplayName(item, "Job requirement"));
  if (items.length === 0 || items.length > 50) {
    throw new JobsDomainError("Jobs must define between 1 and 50 requirements.");
  }
  return { items };
}

function normalizeCompetencies(
  competencies: readonly InterviewCompetency[],
): readonly InterviewCompetency[] {
  if (competencies.length === 0 || competencies.length > 20) {
    throw new JobsDomainError("Interview plans must define between 1 and 20 competencies.");
  }
  const totalWeight = competencies.reduce((sum, competency) => sum + competency.weight, 0);
  if (totalWeight !== 100) {
    throw new JobsDomainError("Interview competency weights must total 100.");
  }
  return competencies.map((competency) => ({
    name: normalizeDisplayName(competency.name, "Competency name"),
    description:
      normalizeOptionalText(competency.description, 500, "Competency description") ?? undefined,
    weight: competency.weight,
  }));
}

function normalizeQuestionBlueprint(
  blueprint: readonly QuestionBlueprint[],
): readonly QuestionBlueprint[] {
  if (blueprint.length === 0 || blueprint.length > 100) {
    throw new JobsDomainError("Interview plans must define between 1 and 100 question blueprints.");
  }
  return blueprint.map((question) => ({
    prompt: normalizeDisplayName(question.prompt, "Question prompt"),
    competency: normalizeDisplayName(question.competency, "Question competency"),
  }));
}
