import type { AuditRequestContext } from "@/modules/audit";
import type { DepartmentId, LocationId, TeamId } from "@/modules/organization";
import type { CompanyActor, TenantContext, TenantId } from "@/modules/tenant";
import type { Brand } from "@/shared";

export type HiringPipelineId = Brand<string, "HiringPipelineId">;
export type PipelineStageId = Brand<string, "PipelineStageId">;
export type JobId = Brand<string, "JobId">;
export type JobTemplateId = Brand<string, "JobTemplateId">;
export type InterviewPlanId = Brand<string, "InterviewPlanId">;
export type InterviewPlanVersionId = Brand<string, "InterviewPlanVersionId">;

export type ActiveArchivedStatus = "active" | "archived";
export type JobStatus = "draft" | "open" | "paused" | "closed" | "archived";
export type PipelineStageCategory =
  "application_review" | "screen" | "interview" | "offer" | "hired" | "rejected";
export type EmploymentType = "full_time" | "part_time" | "contract" | "temporary" | "internship";
export type WorkplaceType = "onsite" | "hybrid" | "remote";
export type SeniorityLevel = "entry" | "mid" | "senior" | "staff" | "executive";
export type InterviewPlanStatus = "draft" | "active" | "archived";
export type InterviewPlanVersionStatus = "draft" | "published" | "retired";

export interface JobsMutationContext {
  readonly tenant: TenantContext;
  readonly actor: CompanyActor;
  readonly request: AuditRequestContext;
  readonly supportAccessSessionId?: string | null;
}

export interface JobContent {
  readonly summary: string;
  readonly details?: string;
}

export interface JobRequirements {
  readonly items: readonly string[];
}

export interface InterviewCompetency {
  readonly name: string;
  readonly description?: string;
  readonly weight: number;
}

export interface QuestionBlueprint {
  readonly prompt: string;
  readonly competency: string;
}

export interface HiringPipelineRecord {
  readonly id: HiringPipelineId;
  readonly companyId: TenantId;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly status: ActiveArchivedStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
}

export interface PipelineStageRecord {
  readonly id: PipelineStageId;
  readonly companyId: TenantId;
  readonly pipelineId: HiringPipelineId;
  readonly name: string;
  readonly slug: string;
  readonly category: PipelineStageCategory;
  readonly position: number;
  readonly isTerminal: boolean;
  readonly status: ActiveArchivedStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
}

export interface JobTemplateRecord {
  readonly id: JobTemplateId;
  readonly companyId: TenantId;
  readonly pipelineId: HiringPipelineId | null;
  readonly title: string;
  readonly slug: string;
  readonly description: JobContent;
  readonly requirements: JobRequirements;
  readonly employmentType: EmploymentType | null;
  readonly workplaceType: WorkplaceType | null;
  readonly seniorityLevel: SeniorityLevel | null;
  readonly status: ActiveArchivedStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
}

export interface JobRecord {
  readonly id: JobId;
  readonly companyId: TenantId;
  readonly departmentId: DepartmentId | null;
  readonly teamId: TeamId | null;
  readonly locationId: LocationId | null;
  readonly pipelineId: HiringPipelineId;
  readonly title: string;
  readonly slug: string;
  readonly description: JobContent;
  readonly requirements: JobRequirements;
  readonly employmentType: EmploymentType;
  readonly workplaceType: WorkplaceType;
  readonly seniorityLevel: SeniorityLevel;
  readonly status: JobStatus;
  readonly openedAt: Date | null;
  readonly closedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
}

export interface InterviewPlanRecord {
  readonly id: InterviewPlanId;
  readonly companyId: TenantId;
  readonly jobId: JobId | null;
  readonly jobTemplateId: JobTemplateId | null;
  readonly name: string;
  readonly status: InterviewPlanStatus;
  readonly activeVersionId: InterviewPlanVersionId | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
}

export interface InterviewPlanVersionRecord {
  readonly id: InterviewPlanVersionId;
  readonly companyId: TenantId;
  readonly interviewPlanId: InterviewPlanId;
  readonly versionNumber: number;
  readonly status: InterviewPlanVersionStatus;
  readonly competencies: readonly InterviewCompetency[];
  readonly questionBlueprint: readonly QuestionBlueprint[];
  readonly durationMinutes: number;
  readonly publishedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface JobsRepository {
  createPipeline(input: {
    readonly companyId: TenantId;
    readonly name: string;
    readonly slug: string;
    readonly description: string | null;
  }): Promise<HiringPipelineRecord>;
  findPipeline(
    tenant: TenantContext,
    pipelineId: HiringPipelineId,
  ): Promise<HiringPipelineRecord | null>;
  createPipelineStage(input: {
    readonly companyId: TenantId;
    readonly pipelineId: HiringPipelineId;
    readonly name: string;
    readonly slug: string;
    readonly category: PipelineStageCategory;
    readonly position: number;
    readonly isTerminal: boolean;
  }): Promise<PipelineStageRecord>;
  listPipelineStages(
    tenant: TenantContext,
    pipelineId: HiringPipelineId,
  ): Promise<readonly PipelineStageRecord[]>;
  createJobTemplate(input: {
    readonly companyId: TenantId;
    readonly pipelineId: HiringPipelineId | null;
    readonly title: string;
    readonly slug: string;
    readonly description: JobContent;
    readonly requirements: JobRequirements;
    readonly employmentType: EmploymentType | null;
    readonly workplaceType: WorkplaceType | null;
    readonly seniorityLevel: SeniorityLevel | null;
  }): Promise<JobTemplateRecord>;
  createJob(input: {
    readonly companyId: TenantId;
    readonly departmentId: DepartmentId | null;
    readonly teamId: TeamId | null;
    readonly locationId: LocationId | null;
    readonly pipelineId: HiringPipelineId;
    readonly title: string;
    readonly slug: string;
    readonly description: JobContent;
    readonly requirements: JobRequirements;
    readonly employmentType: EmploymentType;
    readonly workplaceType: WorkplaceType;
    readonly seniorityLevel: SeniorityLevel;
  }): Promise<JobRecord>;
  findJob(tenant: TenantContext, jobId: JobId): Promise<JobRecord | null>;
  updateJobLifecycle(input: {
    readonly companyId: TenantId;
    readonly jobId: JobId;
    readonly status: JobStatus;
    readonly openedAt?: Date | null;
    readonly closedAt?: Date | null;
    readonly deletedAt?: Date | null;
  }): Promise<JobRecord>;
  createInterviewPlan(input: {
    readonly companyId: TenantId;
    readonly jobId: JobId | null;
    readonly jobTemplateId: JobTemplateId | null;
    readonly name: string;
  }): Promise<InterviewPlanRecord>;
  findInterviewPlan(
    tenant: TenantContext,
    interviewPlanId: InterviewPlanId,
  ): Promise<InterviewPlanRecord | null>;
  createInterviewPlanVersion(input: {
    readonly companyId: TenantId;
    readonly interviewPlanId: InterviewPlanId;
    readonly versionNumber: number;
    readonly competencies: readonly InterviewCompetency[];
    readonly questionBlueprint: readonly QuestionBlueprint[];
    readonly durationMinutes: number;
  }): Promise<InterviewPlanVersionRecord>;
  publishInterviewPlanVersion(input: {
    readonly companyId: TenantId;
    readonly interviewPlanId: InterviewPlanId;
    readonly versionId: InterviewPlanVersionId;
    readonly publishedAt: Date;
  }): Promise<InterviewPlanVersionRecord>;
  activateInterviewPlan(input: {
    readonly companyId: TenantId;
    readonly interviewPlanId: InterviewPlanId;
    readonly activeVersionId: InterviewPlanVersionId;
  }): Promise<InterviewPlanRecord>;
}
