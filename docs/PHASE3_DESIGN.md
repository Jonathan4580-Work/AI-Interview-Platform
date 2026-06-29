# Phase 3 Design: Recruitment Business Domain Foundation

## Purpose

Phase 3 establishes Aptly's core recruitment business domain. It creates the company workspace, organizational structure, job architecture, candidate records, invitation foundations, interview preparation lifecycle, and domain event contracts that later phases depend on.

This phase must not implement candidate portal readiness, email delivery, live interviews, media, monitoring, transcription, evaluation, or reporting generation. It prepares the durable business objects those later phases will use.

## Phase 3 Objectives

- Establish company workspace configuration and HR operating structure.
- Model departments, teams, and locations.
- Model jobs, job templates, interview plan definitions, hiring pipelines, and pipeline stages.
- Model candidate profiles, statuses, lifecycle, tags, notes, documents, and merge/archive behavior.
- Model invitation drafts and lifecycle foundations without sending email.
- Define magic-link architecture without implementing token exchange or candidate portal flows.
- Define interview lifecycle foundations and scheduling abstractions.
- Define notification and domain event contracts.
- Define validation rules, repository interfaces, service boundaries, aggregate roots, value objects, enumerations, and database additions.
- Define APIs required later, plus future UI, AI, reporting, and analytics dependencies.

## Non-Goals

- No invitation email sending.
- No SMTP template implementation.
- No candidate portal.
- No raw magic-token exchange endpoint.
- No browser readiness checks.
- No live interview session execution.
- No recording/media upload.
- No AI provider integration.
- No transcript, evaluation, score, or HR report generation.
- No external ATS, calendar, SSO, SCIM, or webhook integrations.
- No bulk import execution beyond domain contracts and future interfaces.

## Architectural Principles

- Every tenant-owned record includes `companyId`.
- Every tenant-owned table should define `@@unique([companyId, id])` for tenant-qualified references.
- Every repository method for tenant-owned records accepts `TenantContext`.
- Route handlers, server actions, and workers call application services, not Prisma stores directly.
- Domain services emit domain events; side effects such as email, notification, analytics, and search indexing consume events later.
- Published interview plan snapshots are immutable.
- Invitations must reference immutable snapshots, not mutable draft plans.
- Candidates never authenticate as users.
- Candidate records are company-scoped.
- Candidate raw magic tokens are never stored.
- Sensitive HR actions create audit events.
- Monitoring and AI remain decision-support context only; no automatic rejection decisions are introduced in Phase 3.

## Module Dependency Direction

```text
Company Workspace
  -> Tenant
  -> Access Control
  -> Audit

Organization
  -> Tenant
  -> Identity
  -> Audit

Jobs
  -> Tenant
  -> Organization
  -> Identity
  -> Audit

Pipelines
  -> Tenant
  -> Jobs
  -> Audit

Candidates
  -> Tenant
  -> Identity
  -> Audit
  -> Compliance and Privacy

Invitations
  -> Tenant
  -> Candidates
  -> Jobs
  -> Interview Plans
  -> Audit
  -> Domain Events

Scheduling
  -> Tenant
  -> Candidates
  -> Jobs
  -> Users
  -> Domain Events

Notifications Foundation
  -> Domain Events
  -> Tenant
  -> Identity
```

No Phase 3 module may depend on Email delivery, Candidate Portal, Media, Transcription, Evaluation, Reporting generation, or external AI providers.

## Cross-Cutting Domain Concepts

### Tenant Scope

All company workspace domain records are tenant-owned. Platform users may inspect or mutate tenant records only through platform-admin services with support access where required.

### Actor Context

Mutating services accept:

- `TenantContext`
- actor type: `user`, `platform_user`, or `system`
- actor ID
- request context: request ID, correlation ID, session ID, IP, user agent
- optional support access session ID
- required reason for sensitive actions

### Audit Rules

Audit required for:

- Company profile or settings changes.
- Department, team, and location create/update/archive.
- Role and permission changes.
- Job create/update/archive.
- Interview plan publish/archive.
- Pipeline and stage changes.
- Candidate create/update/archive/merge.
- Candidate document metadata changes.
- Candidate note create/update/delete.
- Candidate tag changes.
- Invitation create/update/revoke/extend.
- Interview lifecycle manual status changes.
- Schedule create/update/cancel.

### Domain Event Envelope

All modules emit typed domain events using a shared envelope.

Fields:

- `eventId`
- `eventKey`
- `companyId`
- `aggregateType`
- `aggregateId`
- `actorType`
- `actorId`
- `requestId`
- `correlationId`
- `occurredAt`
- `schemaVersion`
- `payload`

Initial implementation may dispatch in-process only. The event contract must be compatible with a future outbox table.

### Domain Event Persistence

Phase 3 should introduce an optional `domain_events` table if events are used for search, notifications, analytics, or future webhooks during the phase.

If implemented in Phase 3:

- Events are append-only.
- Event payloads contain IDs and low-detail metadata only.
- Restricted content, raw tokens, notes body, document contents, prompts, transcripts, or signed URLs are never placed in event payloads.

## Module: Company Domain

### Purpose

Own the company workspace identity and lifecycle visible to company admins and platform operators.

### Responsibilities

- Manage company profile metadata.
- Enforce company status rules.
- Provide workspace summary data to later UI.
- Keep platform-owned status changes separate from company-owned profile changes.

### Relationships

- Root tenant for every workspace record.
- Has one `company_settings` record.
- Has many departments, teams, locations, jobs, candidates, invitations, schedules, and domain events.
- Uses Phase 1 `companies` table as aggregate root.

### Ownership

Owned by Tenant/Company Module.

### Dependencies

- Tenant Module.
- Access Control Module.
- Audit Module.
- Usage and Entitlements Module for future plan restrictions.

### Aggregate Root

`Company`

Invariants:

- `slug` is globally unique.
- Company status controls workspace actions.
- Archived companies are read-only except platform reactivation workflows.
- Suspended companies cannot create invitations, publish plans, or start candidate flows.

### Value Objects

- `CompanySlug`: lower-case, URL-safe, globally unique.
- `CompanyName`: trimmed, 2-160 characters.
- `CompanyDomain`: normalized domain, optional.
- `CompanyStatus`: `active`, `suspended`, `trialing`, `archived`.

### Database Entities

Existing:

- `companies`

Phase 3 additions:

- No new company root table required.
- `company_settings` is expanded through settings service contracts, not necessarily new columns.

### Service Interfaces

```ts
interface CompanyService {
  getCompany(tenant: TenantContext): Promise<Company>;
  updateCompanyProfile(input: UpdateCompanyProfileInput): Promise<Company>;
  assertCompanyWritable(tenant: TenantContext): Promise<void>;
}
```

### Repository Interfaces

```ts
interface CompanyRepository {
  findByTenant(tenant: TenantContext): Promise<Company | null>;
  updateProfile(input: UpdateCompanyProfileRecord): Promise<Company>;
}
```

### Events Emitted

- `company.profile_updated`
- `company.status_changed` for platform-controlled status changes

### Events Consumed

- Future billing status events may affect company status.
- Future incident events may display operational notices.

### Validation Rules

- Company name required.
- Slug immutable after creation unless platform super admin performs a reasoned change.
- Primary domain must be syntactically valid and lower-case.
- Company profile updates require `tenant:manage`.

### Future Extension Points

- SSO domain verification.
- SCIM provisioning ownership.
- Billing provider subscription synchronization.
- Region/data-residency controls.

## Module: Company Settings

### Purpose

Own tenant-level preferences used by workspace setup and later candidate/email/interview workflows.

### Responsibilities

- Branding settings.
- Retention policy references and settings handoff to Data Lifecycle.
- Feature flags and tenant toggles.
- Email settings metadata references.
- Candidate duplicate handling policy.
- Invitation expiration defaults.
- Interview scheduling defaults.
- Accessibility/accommodation contact defaults.

### Relationships

- One settings record per company.
- Read by Invitations, Candidate, Jobs, Email, Scheduling, and UI modules.

### Ownership

Owned by Tenant/Company Settings Module.

### Dependencies

- Tenant Module.
- Data Lifecycle Module for retention policy validation.
- Usage and Entitlements Module for plan-gated settings.
- Audit Module.

### Aggregate Root

`CompanySettings`

Invariants:

- One settings record per company.
- Settings JSON payloads include `schemaVersion`.
- Settings changes are audited with before/after snapshots redacted.

### Value Objects

- `BrandingSettings`
- `CandidatePolicySettings`
- `InvitationPolicySettings`
- `SchedulingSettings`
- `FeatureFlagSettings`
- `EmailSettingsReference`

### Database Entities

Existing:

- `company_settings`

Recommended JSON shape:

`brandingJson`

```json
{
  "schemaVersion": 1,
  "displayName": "Acme Recruiting",
  "logoUrl": null,
  "primaryColor": "#2563EB"
}
```

`featureFlagsJson`

```json
{
  "schemaVersion": 1,
  "flags": {
    "candidate_duplicate_mode": true
  }
}
```

`emailSettingsJson`

```json
{
  "schemaVersion": 1,
  "defaultFromName": "Acme Recruiting",
  "defaultReplyTo": "recruiting@example.com",
  "smtpProfileId": null
}
```

Additional `candidatePolicyJson` and `invitationPolicyJson` may be added as columns or nested under a settings JSON only if needed. If they become queryable, normalize them.

### Service Interfaces

```ts
interface CompanySettingsService {
  getSettings(tenant: TenantContext): Promise<CompanySettings>;
  updateBranding(input: UpdateBrandingInput): Promise<CompanySettings>;
  updateCandidatePolicy(input: UpdateCandidatePolicyInput): Promise<CompanySettings>;
  updateInvitationPolicy(input: UpdateInvitationPolicyInput): Promise<CompanySettings>;
  updateSchedulingPolicy(input: UpdateSchedulingPolicyInput): Promise<CompanySettings>;
}
```

### Repository Interfaces

```ts
interface CompanySettingsRepository {
  findByTenant(tenant: TenantContext): Promise<CompanySettings | null>;
  upsert(input: UpsertCompanySettingsRecord): Promise<CompanySettings>;
}
```

### Events Emitted

- `company_settings.branding_updated`
- `company_settings.candidate_policy_updated`
- `company_settings.invitation_policy_updated`
- `company_settings.scheduling_policy_updated`

### Events Consumed

- `company.profile_updated` for display name sync if needed.

### Validation Rules

- Branding color must meet contrast constraints when used in candidate UI.
- Invitation default expiration must be between platform minimum and maximum.
- Candidate duplicate mode can only be enabled if entitlement allows it.
- Settings payloads must include a schema version.

### Future Extension Points

- Custom sender domain selection.
- Custom privacy notice.
- Candidate accommodation instructions.
- Region-specific retention policy overrides.

## Module: Departments

### Purpose

Represent tenant-specific organizational departments for job and reporting structure.

### Responsibilities

- Create, update, archive departments.
- Associate jobs and teams with departments.
- Provide report grouping dimensions.

### Relationships

- Company has many departments.
- Department has many teams.
- Job may belong to one department.

### Ownership

Owned by Organization Module.

### Dependencies

- Tenant Module.
- Identity for actor attribution.
- Audit Module.

### Aggregate Root

`Department`

Invariants:

- Department key unique within company.
- Archived departments cannot be assigned to new jobs.
- Existing jobs retain historical department reference after archive.

### Value Objects

- `DepartmentName`: 2-120 characters.
- `DepartmentKey`: slug-like, unique within company.

### Enumerations

- `DepartmentStatus`: `active`, `archived`.

### Database Entities

`departments`

Fields:

- `id`
- `companyId`
- `name`
- `key`
- `description`
- `status`
- `createdByUserId`
- `createdAt`
- `updatedAt`
- `archivedAt`

Indexes:

- Unique `companyId, id`
- Unique `companyId, key`
- `companyId, status`

### Service Interfaces

```ts
interface DepartmentService {
  createDepartment(input: CreateDepartmentInput): Promise<Department>;
  updateDepartment(input: UpdateDepartmentInput): Promise<Department>;
  archiveDepartment(input: ArchiveDepartmentInput): Promise<Department>;
  listDepartments(tenant: TenantContext): Promise<readonly Department[]>;
}
```

### Repository Interfaces

```ts
interface DepartmentRepository {
  create(input: CreateDepartmentRecord): Promise<Department>;
  findById(tenant: TenantContext, id: DepartmentId): Promise<Department | null>;
  findByKey(tenant: TenantContext, key: DepartmentKey): Promise<Department | null>;
  update(input: UpdateDepartmentRecord): Promise<Department>;
  listActive(tenant: TenantContext): Promise<readonly Department[]>;
}
```

### Events Emitted

- `department.created`
- `department.updated`
- `department.archived`

### Events Consumed

- None initially.

### Validation Rules

- Name required.
- Key auto-generated from name but editable before save.
- Key cannot conflict with active or archived department key.
- Archive requires reason if department has active jobs.

### Future Extension Points

- HR analytics by department.
- ATS department sync.
- Department-level permissions.

## Module: Teams

### Purpose

Represent hiring teams or functional groups that own jobs and review workflows.

### Responsibilities

- Manage teams.
- Associate users with hiring teams.
- Assign jobs to teams.
- Prepare for reviewer assignment and workload reporting.

### Relationships

- Company has many teams.
- Team optionally belongs to department.
- Team has many team members.
- Job may belong to a team.

### Ownership

Owned by Organization Module.

### Dependencies

- Tenant Module.
- Identity Module.
- Departments.
- Audit Module.

### Aggregate Root

`Team`

Invariants:

- Team key unique within company.
- Archived teams cannot own new jobs.
- Team membership references active or disabled users but not deleted users.

### Value Objects

- `TeamName`
- `TeamKey`
- `TeamMemberRole`

### Enumerations

- `TeamStatus`: `active`, `archived`
- `TeamMemberRole`: `owner`, `member`

### Database Entities

`teams`

Fields:

- `id`
- `companyId`
- `departmentId`
- `name`
- `key`
- `description`
- `status`
- `createdByUserId`
- `createdAt`
- `updatedAt`
- `archivedAt`

Indexes:

- Unique `companyId, id`
- Unique `companyId, key`
- `companyId, departmentId`
- `companyId, status`

`team_members`

Fields:

- `companyId`
- `teamId`
- `userId`
- `role`
- `createdAt`

Indexes:

- Primary key `companyId, teamId, userId`
- `companyId, userId`

### Service Interfaces

```ts
interface TeamService {
  createTeam(input: CreateTeamInput): Promise<Team>;
  updateTeam(input: UpdateTeamInput): Promise<Team>;
  archiveTeam(input: ArchiveTeamInput): Promise<Team>;
  addTeamMember(input: AddTeamMemberInput): Promise<void>;
  removeTeamMember(input: RemoveTeamMemberInput): Promise<void>;
}
```

### Repository Interfaces

```ts
interface TeamRepository {
  create(input: CreateTeamRecord): Promise<Team>;
  findById(tenant: TenantContext, id: TeamId): Promise<Team | null>;
  update(input: UpdateTeamRecord): Promise<Team>;
  addMember(input: AddTeamMemberRecord): Promise<void>;
  removeMember(input: RemoveTeamMemberRecord): Promise<void>;
}
```

### Events Emitted

- `team.created`
- `team.updated`
- `team.archived`
- `team_member.added`
- `team_member.removed`

### Events Consumed

- `user.disabled` later to flag inactive team members.

### Validation Rules

- User must belong to same company.
- Team owner cannot be removed if they are the last owner.
- Archived teams cannot receive new members.

### Future Extension Points

- Team-specific permissions.
- Reviewer workload balancing.
- ATS team sync.

## Module: Locations

### Purpose

Represent job locations for operational filtering, candidate communication, and reporting.

### Responsibilities

- Manage reusable location records.
- Support remote, hybrid, onsite, and unspecified location modes.
- Provide normalized location fields for search and reporting.

### Relationships

- Company has many locations.
- Job may reference one primary location and optional additional locations later.

### Ownership

Owned by Organization Module.

### Dependencies

- Tenant Module.
- Audit Module.

### Aggregate Root

`Location`

Invariants:

- Location key unique within company.
- Archived locations cannot be assigned to new jobs.

### Value Objects

- `LocationName`
- `LocationMode`
- `CountryCode`
- `Region`
- `City`
- `TimeZone`

### Enumerations

- `LocationStatus`: `active`, `archived`
- `LocationMode`: `remote`, `hybrid`, `onsite`, `unspecified`

### Database Entities

`locations`

Fields:

- `id`
- `companyId`
- `name`
- `key`
- `mode`
- `countryCode`
- `region`
- `city`
- `timeZone`
- `status`
- `createdAt`
- `updatedAt`
- `archivedAt`

Indexes:

- Unique `companyId, id`
- Unique `companyId, key`
- `companyId, status`
- `companyId, mode`

### Service Interfaces

```ts
interface LocationService {
  createLocation(input: CreateLocationInput): Promise<Location>;
  updateLocation(input: UpdateLocationInput): Promise<Location>;
  archiveLocation(input: ArchiveLocationInput): Promise<Location>;
}
```

### Events Emitted

- `location.created`
- `location.updated`
- `location.archived`

### Validation Rules

- Remote locations may omit city and region.
- Onsite and hybrid locations should include at least country and city.
- Time zone must be a valid IANA time zone when provided.

### Future Extension Points

- Candidate scheduling time-zone hints.
- Region-based data residency.
- ATS location sync.

## Module: Job Architecture

### Purpose

Model the hiring role or requisition that candidates apply or are invited against.

### Responsibilities

- Create and manage jobs.
- Attach departments, teams, locations, hiring pipelines, and interview plans.
- Provide immutable references for invitations.
- Track job lifecycle.

### Relationships

- Company has many jobs.
- Job optionally references department, team, and location.
- Job has one active hiring pipeline.
- Job has many interview plans.
- Job has many candidates through applications or candidate-job links.
- Job has many invitations.

### Ownership

Owned by Jobs Module.

### Dependencies

- Tenant Module.
- Organization Module.
- Identity Module.
- Pipelines Module.
- Audit Module.

### Aggregate Root

`Job`

Invariants:

- Job number or slug unique within company.
- Job can be published only with an active pipeline.
- Job can receive invitations only if active.
- Archived jobs are read-only.
- Closing a job does not delete candidates, invitations, or interview plans.

### Value Objects

- `JobTitle`
- `JobCode`
- `EmploymentType`
- `WorkplaceType`
- `JobDescription`
- `CompensationRange`

### Enumerations

- `JobStatus`: `draft`, `active`, `paused`, `closed`, `archived`
- `EmploymentType`: `full_time`, `part_time`, `contract`, `temporary`, `internship`, `other`
- `WorkplaceType`: `remote`, `hybrid`, `onsite`, `unspecified`
- `SeniorityLevel`: `intern`, `junior`, `mid`, `senior`, `lead`, `manager`, `director`, `executive`, `unspecified`

### Database Entities

`jobs`

Fields:

- `id`
- `companyId`
- `jobTemplateId`
- `departmentId`
- `teamId`
- `locationId`
- `pipelineId`
- `title`
- `jobCode`
- `description`
- `status`
- `employmentType`
- `workplaceType`
- `seniorityLevel`
- `openedAt`
- `closedAt`
- `createdByUserId`
- `createdAt`
- `updatedAt`
- `deletedAt`

Indexes:

- Unique `companyId, id`
- Unique `companyId, jobCode`
- `companyId, status`
- `companyId, departmentId`
- `companyId, teamId`
- `companyId, locationId`
- `companyId, title`

Note:

- This should replace or supersede the earlier `job_roles` concept. If implementation retains `job_roles` naming temporarily, it must expose domain language as `Job` and map cleanly to the database.

### Service Interfaces

```ts
interface JobService {
  createJob(input: CreateJobInput): Promise<Job>;
  updateJob(input: UpdateJobInput): Promise<Job>;
  activateJob(input: ActivateJobInput): Promise<Job>;
  pauseJob(input: PauseJobInput): Promise<Job>;
  closeJob(input: CloseJobInput): Promise<Job>;
  archiveJob(input: ArchiveJobInput): Promise<Job>;
}
```

### Repository Interfaces

```ts
interface JobRepository {
  create(input: CreateJobRecord): Promise<Job>;
  findById(tenant: TenantContext, id: JobId): Promise<Job | null>;
  findByCode(tenant: TenantContext, code: JobCode): Promise<Job | null>;
  update(input: UpdateJobRecord): Promise<Job>;
  list(input: ListJobsQuery): Promise<PaginatedResult<Job>>;
}
```

### Events Emitted

- `job.created`
- `job.updated`
- `job.activated`
- `job.paused`
- `job.closed`
- `job.archived`

### Events Consumed

- `pipeline.archived` to prevent active jobs from referencing archived pipelines.
- `department.archived`, `team.archived`, `location.archived` for assignment warnings.

### Validation Rules

- Title required.
- Job code unique within company if provided; otherwise generated.
- Active job requires pipeline.
- Active job should have at least one published interview plan before invitations can be created.
- Closing requires reason.

### Future Extension Points

- ATS requisition mapping.
- Job approval workflows.
- Headcount planning.
- Compensation bands.
- Public job postings.

## Module: Job Templates

### Purpose

Provide reusable defaults for jobs, pipelines, interview plans, and evaluation rubrics.

### Responsibilities

- Create reusable job templates.
- Clone template settings into jobs.
- Keep templates mutable while cloned jobs remain independent.

### Relationships

- Company has many job templates.
- Job may reference source template.
- Template may reference default pipeline template and interview plan template.

### Ownership

Owned by Jobs Module.

### Dependencies

- Tenant Module.
- Pipelines Module.
- Interview Plan Module.
- Audit Module.

### Aggregate Root

`JobTemplate`

Invariants:

- Template key unique within company.
- Archived templates cannot create new jobs.
- Changing a template does not mutate existing jobs.

### Value Objects

- `JobTemplateName`
- `JobTemplateKey`
- `TemplateDefaults`

### Enumerations

- `JobTemplateStatus`: `active`, `archived`

### Database Entities

`job_templates`

Fields:

- `id`
- `companyId`
- `name`
- `key`
- `description`
- `defaultDepartmentId`
- `defaultTeamId`
- `defaultLocationId`
- `defaultEmploymentType`
- `defaultWorkplaceType`
- `defaultSeniorityLevel`
- `defaultDescription`
- `status`
- `createdByUserId`
- `createdAt`
- `updatedAt`
- `archivedAt`

Indexes:

- Unique `companyId, id`
- Unique `companyId, key`
- `companyId, status`

### Service Interfaces

```ts
interface JobTemplateService {
  createTemplate(input: CreateJobTemplateInput): Promise<JobTemplate>;
  updateTemplate(input: UpdateJobTemplateInput): Promise<JobTemplate>;
  archiveTemplate(input: ArchiveJobTemplateInput): Promise<JobTemplate>;
  createJobFromTemplate(input: CreateJobFromTemplateInput): Promise<Job>;
}
```

### Events Emitted

- `job_template.created`
- `job_template.updated`
- `job_template.archived`
- `job.created_from_template`

### Validation Rules

- Template name required.
- Defaults must reference active department/team/location records.
- Template clone captures values at creation time.

### Future Extension Points

- Platform-provided template library.
- Role-specific recommended rubrics.
- AI-assisted template suggestions later, behind AI governance.

## Module: Hiring Pipelines

### Purpose

Define ordered hiring stages for jobs and candidate progression.

### Responsibilities

- Create and manage reusable hiring pipelines.
- Define ordered stages.
- Attach pipelines to jobs.
- Support candidate movement through stages.

### Relationships

- Company has many pipelines.
- Pipeline has many stages.
- Job references one pipeline.
- Candidate application references current stage.

### Ownership

Owned by Pipelines Module.

### Dependencies

- Tenant Module.
- Jobs Module.
- Audit Module.

### Aggregate Root

`HiringPipeline`

Invariants:

- Pipeline must have at least one active stage before activation.
- Stage order unique within pipeline.
- Pipeline key unique within company.
- Archived pipelines cannot be assigned to active jobs.

### Value Objects

- `PipelineName`
- `PipelineKey`
- `StageOrder`

### Enumerations

- `PipelineStatus`: `draft`, `active`, `archived`

### Database Entities

`hiring_pipelines`

Fields:

- `id`
- `companyId`
- `name`
- `key`
- `description`
- `status`
- `isDefault`
- `createdByUserId`
- `createdAt`
- `updatedAt`
- `archivedAt`

Indexes:

- Unique `companyId, id`
- Unique `companyId, key`
- `companyId, status`
- Partial unique default per company if supported, otherwise service-enforced

### Service Interfaces

```ts
interface HiringPipelineService {
  createPipeline(input: CreatePipelineInput): Promise<HiringPipeline>;
  updatePipeline(input: UpdatePipelineInput): Promise<HiringPipeline>;
  activatePipeline(input: ActivatePipelineInput): Promise<HiringPipeline>;
  archivePipeline(input: ArchivePipelineInput): Promise<HiringPipeline>;
  setDefaultPipeline(input: SetDefaultPipelineInput): Promise<void>;
}
```

### Events Emitted

- `pipeline.created`
- `pipeline.updated`
- `pipeline.activated`
- `pipeline.archived`
- `pipeline.default_changed`

### Validation Rules

- Pipeline activation requires at least one active stage.
- Default pipeline must be active.
- Archive blocked while active jobs reference pipeline unless force option with reason is approved.

### Future Extension Points

- Pipeline templates.
- Conditional stage requirements.
- ATS stage mapping.

## Module: Pipeline Stages

### Purpose

Define ordered stages inside a hiring pipeline.

### Responsibilities

- Manage stage labels, ordering, and stage categories.
- Indicate terminal outcomes.
- Provide candidate status mapping.

### Relationships

- Pipeline has many stages.
- Candidate application references current stage.
- Invitation and interview records may be associated with a stage.

### Ownership

Owned by Pipelines Module.

### Dependencies

- Tenant Module.
- Hiring Pipelines.
- Audit Module.

### Aggregate Root

Pipeline stages are child entities of `HiringPipeline`.

### Value Objects

- `PipelineStageName`
- `PipelineStageKey`
- `StageOrder`

### Enumerations

- `PipelineStageStatus`: `active`, `archived`
- `PipelineStageCategory`: `sourced`, `screen`, `interview`, `review`, `offer`, `hired`, `rejected`, `withdrawn`

### Database Entities

`pipeline_stages`

Fields:

- `id`
- `companyId`
- `pipelineId`
- `name`
- `key`
- `description`
- `category`
- `sortOrder`
- `status`
- `isTerminal`
- `createdAt`
- `updatedAt`
- `archivedAt`

Indexes:

- Unique `companyId, id`
- Unique `companyId, pipelineId, key`
- Unique `companyId, pipelineId, sortOrder`
- `companyId, pipelineId, status`

### Service Interfaces

```ts
interface PipelineStageService {
  addStage(input: AddPipelineStageInput): Promise<PipelineStage>;
  updateStage(input: UpdatePipelineStageInput): Promise<PipelineStage>;
  reorderStages(input: ReorderPipelineStagesInput): Promise<readonly PipelineStage[]>;
  archiveStage(input: ArchivePipelineStageInput): Promise<PipelineStage>;
}
```

### Events Emitted

- `pipeline_stage.created`
- `pipeline_stage.updated`
- `pipeline_stage.reordered`
- `pipeline_stage.archived`

### Validation Rules

- Stage name required.
- Stage order must be contiguous after reorder.
- Cannot archive the only active stage in an active pipeline.
- Terminal stage categories must set `isTerminal = true`.

### Future Extension Points

- Stage-level automation.
- Stage-level interview plan defaults.
- Stage SLA reporting.

## Module: Interview Plan Definitions

### Purpose

Define structured interview plans, rubric configuration, and immutable published snapshots used by invitations and interviews.

### Responsibilities

- Create draft interview plans.
- Update draft plans.
- Publish immutable snapshots.
- Archive plans.
- Attach published plans to jobs.
- Ensure invitations reference snapshots, not drafts.

### Relationships

- Job has many interview plans.
- Interview plan has many versions/snapshots.
- Invitation references a published snapshot.
- Future evaluation references snapshot rubric version.

### Ownership

Owned by Jobs/Interview Plan Module.

### Dependencies

- Tenant Module.
- Jobs Module.
- Pipelines Module optionally for stage association.
- Audit Module.
- AI Governance later for prompt/rubric versioning.

### Aggregate Roots

- `InterviewPlan`
- `InterviewPlanVersion`

Invariants:

- Draft can be edited.
- Published version is immutable.
- A plan can have at most one current published version.
- Invitations require a published version.
- Version number increments monotonically per plan.

### Value Objects

- `InterviewPlanName`
- `DurationMinutes`
- `QuestionPlan`
- `RubricDefinition`
- `CompetencyDefinition`
- `PlanVersionNumber`

### Enumerations

- `InterviewPlanStatus`: `draft`, `active`, `archived`
- `InterviewPlanVersionStatus`: `draft`, `published`, `superseded`, `archived`
- `QuestionType`: `opening`, `technical`, `behavioral`, `situational`, `follow_up`, `closing`

### Database Entities

`interview_plans`

Fields:

- `id`
- `companyId`
- `jobId`
- `pipelineStageId`
- `name`
- `description`
- `status`
- `durationMinutes`
- `createdByUserId`
- `createdAt`
- `updatedAt`
- `archivedAt`

Indexes:

- Unique `companyId, id`
- `companyId, jobId, status`
- `companyId, pipelineStageId`

`interview_plan_versions`

Fields:

- `id`
- `companyId`
- `interviewPlanId`
- `version`
- `status`
- `questionPlanJson`
- `rubricJson`
- `instructionsJson`
- `publishedByUserId`
- `publishedAt`
- `createdAt`
- `updatedAt`

Indexes:

- Unique `companyId, id`
- Unique `companyId, interviewPlanId, version`
- `companyId, interviewPlanId, status`

JSON rules:

- `questionPlanJson`, `rubricJson`, and `instructionsJson` must include `schemaVersion`.
- Rubric JSON must include competency keys and scoring scale.
- Future normalized rubric tables may be added before Phase 9 if reporting requires it.

### Service Interfaces

```ts
interface InterviewPlanService {
  createPlan(input: CreateInterviewPlanInput): Promise<InterviewPlan>;
  updateDraft(input: UpdateInterviewPlanDraftInput): Promise<InterviewPlanVersion>;
  publishPlan(input: PublishInterviewPlanInput): Promise<InterviewPlanVersion>;
  archivePlan(input: ArchiveInterviewPlanInput): Promise<InterviewPlan>;
  getPublishedSnapshot(input: GetPublishedSnapshotInput): Promise<InterviewPlanVersion>;
}
```

### Repository Interfaces

```ts
interface InterviewPlanRepository {
  createPlan(input: CreateInterviewPlanRecord): Promise<InterviewPlan>;
  findPlanById(tenant: TenantContext, id: InterviewPlanId): Promise<InterviewPlan | null>;
  createVersion(input: CreateInterviewPlanVersionRecord): Promise<InterviewPlanVersion>;
  publishVersion(input: PublishInterviewPlanVersionRecord): Promise<InterviewPlanVersion>;
  findCurrentPublishedVersion(input: FindPublishedPlanInput): Promise<InterviewPlanVersion | null>;
}
```

### Events Emitted

- `interview_plan.created`
- `interview_plan.updated`
- `interview_plan.published`
- `interview_plan.archived`

### Events Consumed

- `job.archived` to prevent new plan publishing for archived jobs.

### Validation Rules

- Duration must be within platform limits, default 15-90 minutes.
- Plan must have at least one candidate-facing question before publish.
- Rubric competency keys must be unique.
- Rubric max score must be positive.
- Published snapshot cannot be updated.

### Future Extension Points

- AI-assisted plan suggestions.
- Prompt template linkage.
- Rubric normalization.
- Plan approval workflows.
- Version comparison UI.

## Module: Candidate Domain

### Purpose

Represent people being considered for roles within a company. Candidates do not have accounts.

### Responsibilities

- Create and manage candidate profiles.
- Enforce company-scoped uniqueness policy.
- Track lifecycle status.
- Support merge, archive, and anonymization handoff.
- Associate candidates with jobs through applications.

### Relationships

- Company has many candidates.
- Candidate may have many applications.
- Candidate may have many documents, tags, notes, invitations, and future interviews.
- Candidate may be linked to privacy requests.

### Ownership

Owned by Candidate Module.

### Dependencies

- Tenant Module.
- Identity Module for HR actor references.
- Compliance and Privacy Module.
- Data Lifecycle Module.
- Audit Module.

### Aggregate Root

`Candidate`

Invariants:

- Candidate belongs to exactly one company.
- Normalized email unique within company unless duplicate candidate mode is enabled.
- Archived candidates cannot receive new invitations unless restored.
- Merged candidates become read-only and point to target candidate.
- Candidate deletion requests should anonymize rather than hard-delete if audit history must remain.

### Value Objects

- `CandidateName`
- `CandidateEmail`
- `NormalizedEmail`
- `PhoneNumber`
- `CandidateExternalRef`
- `CandidateSource`

### Enumerations

- `CandidateStatus`: `active`, `archived`, `merged`, `anonymized`
- `CandidateSourceType`: `manual`, `import`, `referral`, `ats`, `api`, `unknown`

### Database Entities

`candidates`

Fields:

- `id`
- `companyId`
- `email`
- `normalizedEmail`
- `name`
- `phone`
- `externalRef`
- `sourceType`
- `sourceDetail`
- `status`
- `mergedIntoCandidateId`
- `createdByUserId`
- `createdAt`
- `updatedAt`
- `deletedAt`
- `anonymizedAt`

Indexes:

- Unique `companyId, id`
- Unique `companyId, normalizedEmail` where possible.
- `companyId, status`
- `companyId, externalRef`
- `companyId, name`

Note:

- PostgreSQL partial uniqueness may be required to allow anonymized candidates with null email or archived duplicates. If Prisma cannot express the desired partial index, use a manual migration.

### Service Interfaces

```ts
interface CandidateService {
  createCandidate(input: CreateCandidateInput): Promise<Candidate>;
  updateCandidate(input: UpdateCandidateInput): Promise<Candidate>;
  archiveCandidate(input: ArchiveCandidateInput): Promise<Candidate>;
  restoreCandidate(input: RestoreCandidateInput): Promise<Candidate>;
  mergeCandidates(input: MergeCandidatesInput): Promise<CandidateMergeResult>;
  anonymizeCandidate(input: AnonymizeCandidateInput): Promise<Candidate>;
}
```

### Repository Interfaces

```ts
interface CandidateRepository {
  create(input: CreateCandidateRecord): Promise<Candidate>;
  findById(tenant: TenantContext, id: CandidateId): Promise<Candidate | null>;
  findByNormalizedEmail(tenant: TenantContext, email: NormalizedEmail): Promise<Candidate | null>;
  update(input: UpdateCandidateRecord): Promise<Candidate>;
  list(input: ListCandidatesQuery): Promise<PaginatedResult<Candidate>>;
}
```

### Events Emitted

- `candidate.created`
- `candidate.updated`
- `candidate.archived`
- `candidate.restored`
- `candidate.merged`
- `candidate.anonymized`

### Events Consumed

- `privacy_request.created` later to coordinate access/deletion/anonymization workflows.

### Validation Rules

- Name required for manual creation.
- Email required unless explicit candidate policy allows email-less placeholders.
- Email normalized lower-case.
- Merge requires source and target in same company.
- Merge requires reason.
- Merge cannot target archived, merged, or anonymized candidate.
- Anonymization blocked by active legal hold.

### Future Extension Points

- ATS candidate sync.
- Candidate duplicate detection.
- Candidate enrichment provider.
- Candidate communication preferences.
- Global suppression list.

## Module: Candidate Applications

### Purpose

Represent a candidate's relationship to a specific job and current pipeline stage.

### Responsibilities

- Link candidates to jobs.
- Track current pipeline stage.
- Track application lifecycle.
- Support review assignment foundation.

### Relationships

- Candidate has many applications.
- Job has many applications.
- Application references current pipeline stage.
- Invitation references application where possible.

### Ownership

Owned by Candidate Module or Applications submodule.

### Dependencies

- Candidate Module.
- Jobs Module.
- Pipelines Module.
- Identity Module.
- Audit Module.

### Aggregate Root

`CandidateApplication`

Invariants:

- Candidate and job must belong to same company.
- Candidate should have at most one active application per job unless duplicate applications are explicitly enabled.
- Current stage must belong to job pipeline.
- Terminal application cannot move back without reason.

### Enumerations

- `ApplicationStatus`: `active`, `hired`, `rejected`, `withdrawn`, `archived`

### Database Entities

`candidate_applications`

Fields:

- `id`
- `companyId`
- `candidateId`
- `jobId`
- `currentStageId`
- `status`
- `sourceType`
- `createdByUserId`
- `createdAt`
- `updatedAt`
- `closedAt`

Indexes:

- Unique `companyId, id`
- Unique `companyId, candidateId, jobId` for active applications if supported.
- `companyId, jobId, status`
- `companyId, candidateId`
- `companyId, currentStageId`

### Service Interfaces

```ts
interface CandidateApplicationService {
  createApplication(input: CreateApplicationInput): Promise<CandidateApplication>;
  moveStage(input: MoveCandidateStageInput): Promise<CandidateApplication>;
  closeApplication(input: CloseApplicationInput): Promise<CandidateApplication>;
}
```

### Events Emitted

- `candidate_application.created`
- `candidate_application.stage_changed`
- `candidate_application.closed`

### Validation Rules

- Job must be active or paused to create application.
- Stage must be active.
- Stage must belong to job pipeline.
- Stage changes require audit reason when moving to terminal stage.

### Future Extension Points

- Hiring SLA reporting.
- Reviewer assignment.
- Offer workflow.
- ATS application sync.

## Module: Candidate Documents

### Purpose

Track candidate document metadata without storing file contents in the database.

### Responsibilities

- Store document metadata.
- Prepare for object storage integration.
- Track document status and data classification.
- Support resume/CV and other attachments.

### Relationships

- Candidate has many documents.
- Document may relate to application.
- Future object storage record owns file location.

### Ownership

Owned by Candidate Module.

### Dependencies

- Tenant Module.
- Candidate Module.
- Data Lifecycle Module.
- Audit Module.
- Future Media/Object Storage Module.

### Aggregate Root

Candidate document is a child entity of Candidate.

### Value Objects

- `DocumentName`
- `MimeType`
- `FileSizeBytes`
- `StorageKeyReference`

### Enumerations

- `CandidateDocumentType`: `resume`, `cover_letter`, `portfolio`, `certificate`, `other`
- `CandidateDocumentStatus`: `pending_upload`, `uploaded`, `ready`, `failed`, `deleted`

### Database Entities

`candidate_documents`

Fields:

- `id`
- `companyId`
- `candidateId`
- `applicationId`
- `type`
- `status`
- `fileName`
- `mimeType`
- `sizeBytes`
- `storageKey`
- `uploadedByUserId`
- `retentionDeleteAt`
- `createdAt`
- `updatedAt`
- `deletedAt`

Indexes:

- Unique `companyId, id`
- `companyId, candidateId`
- `companyId, applicationId`
- `companyId, status`

### Service Interfaces

```ts
interface CandidateDocumentService {
  createDocumentMetadata(input: CreateCandidateDocumentInput): Promise<CandidateDocument>;
  markDocumentUploaded(input: MarkCandidateDocumentUploadedInput): Promise<CandidateDocument>;
  deleteDocument(input: DeleteCandidateDocumentInput): Promise<CandidateDocument>;
}
```

### Events Emitted

- `candidate_document.created`
- `candidate_document.uploaded`
- `candidate_document.deleted`

### Validation Rules

- File contents are never accepted by generic candidate services.
- Storage key must not be a signed URL.
- MIME type must be allowlisted.
- Deletion blocked by legal hold.

### Future Extension Points

- Resume parsing.
- Malware scanning.
- Candidate document export.
- ATS attachment sync.

## Module: Candidate Tags

### Purpose

Provide tenant-specific tagging for candidate organization and search.

### Responsibilities

- Manage tag definitions.
- Assign/remove tags from candidates.
- Support filtering and search facets.

### Relationships

- Company has many tag definitions.
- Candidate has many tags.

### Ownership

Owned by Candidate Module.

### Dependencies

- Tenant Module.
- Candidate Module.
- Audit Module.

### Aggregate Root

`CandidateTag`

Candidate-tag assignments are child entities.

### Value Objects

- `TagName`
- `TagKey`
- `TagColor`

### Enumerations

- `CandidateTagStatus`: `active`, `archived`

### Database Entities

`candidate_tags`

Fields:

- `id`
- `companyId`
- `name`
- `key`
- `color`
- `status`
- `createdByUserId`
- `createdAt`
- `updatedAt`
- `archivedAt`

Indexes:

- Unique `companyId, id`
- Unique `companyId, key`
- `companyId, status`

`candidate_tag_assignments`

Fields:

- `companyId`
- `candidateId`
- `tagId`
- `assignedByUserId`
- `createdAt`

Indexes:

- Primary key `companyId, candidateId, tagId`
- `companyId, tagId`

### Service Interfaces

```ts
interface CandidateTagService {
  createTag(input: CreateCandidateTagInput): Promise<CandidateTag>;
  updateTag(input: UpdateCandidateTagInput): Promise<CandidateTag>;
  archiveTag(input: ArchiveCandidateTagInput): Promise<CandidateTag>;
  assignTag(input: AssignCandidateTagInput): Promise<void>;
  removeTag(input: RemoveCandidateTagInput): Promise<void>;
}
```

### Events Emitted

- `candidate_tag.created`
- `candidate_tag.updated`
- `candidate_tag.archived`
- `candidate_tag.assigned`
- `candidate_tag.removed`

### Validation Rules

- Tag key unique per company.
- Archived tags cannot be newly assigned.
- Candidate and tag must share tenant.

### Future Extension Points

- Automation rules by tag.
- Reporting by tag.
- ATS tag sync.

## Module: Candidate Notes

### Purpose

Capture HR notes and collaboration context before interview artifacts exist.

### Responsibilities

- Create, update, soft-delete notes.
- Associate notes with candidate, application, or future interview.
- Preserve audit trail for note changes.

### Relationships

- Candidate has many notes.
- Application may have many notes.
- Author is a company user.

### Ownership

Owned by Candidate Module.

### Dependencies

- Tenant Module.
- Identity Module.
- Candidate Module.
- Audit Module.

### Aggregate Root

Candidate note is a child entity of Candidate or Application.

### Value Objects

- `CandidateNoteBody`
- `CandidateNoteVisibility`

### Enumerations

- `CandidateNoteVisibility`: `internal`, `restricted`
- `CandidateNoteStatus`: `active`, `deleted`

### Database Entities

`candidate_notes`

Fields:

- `id`
- `companyId`
- `candidateId`
- `applicationId`
- `authorUserId`
- `body`
- `visibility`
- `status`
- `createdAt`
- `updatedAt`
- `deletedAt`

Indexes:

- Unique `companyId, id`
- `companyId, candidateId, createdAt`
- `companyId, applicationId, createdAt`
- `companyId, authorUserId`

### Service Interfaces

```ts
interface CandidateNoteService {
  createNote(input: CreateCandidateNoteInput): Promise<CandidateNote>;
  updateNote(input: UpdateCandidateNoteInput): Promise<CandidateNote>;
  deleteNote(input: DeleteCandidateNoteInput): Promise<CandidateNote>;
}
```

### Events Emitted

- `candidate_note.created`
- `candidate_note.updated`
- `candidate_note.deleted`

### Validation Rules

- Note body required and size-limited.
- Notes are never included in low-detail domain event payloads.
- Restricted notes require elevated permission to read.
- Delete is soft delete.

### Future Extension Points

- Mentions and notifications.
- Note-level permissions.
- Interview review notes in later phases.

## Module: Candidate Statuses And Lifecycle

### Purpose

Define allowed candidate and application state transitions independent of UI.

### Responsibilities

- Enforce candidate profile lifecycle.
- Enforce application lifecycle.
- Coordinate archive, merge, anonymize, and withdraw flows.

### Candidate States

- `active`
- `archived`
- `merged`
- `anonymized`

Allowed transitions:

- `active -> archived`
- `archived -> active`
- `active -> merged`
- `archived -> merged`
- `active -> anonymized`
- `archived -> anonymized`

Terminal states:

- `merged`
- `anonymized`

### Application States

- `active`
- `hired`
- `rejected`
- `withdrawn`
- `archived`

Terminal states:

- `hired`
- `rejected`
- `withdrawn`

### Validation Rules

- Terminal candidate records are read-only except audit/compliance references.
- Anonymization requires privacy/legal validation.
- Merge requires source and target candidate in same company.
- Active application cannot be created for archived or terminal candidate.
- Application terminal transitions require reason.

### Events Emitted

- `candidate.lifecycle_changed`
- `candidate_application.lifecycle_changed`

### Future Extension Points

- Candidate dispute workflow.
- Offer workflow.
- Background retention/anonymization jobs.

## Module: Invitations

### Purpose

Represent invitations for candidates to complete browser-based interviews. In Phase 3, invitations can be drafted and prepared but not emailed.

### Responsibilities

- Create invitation records.
- Reference candidate, application, job, and published interview plan version.
- Track invitation lifecycle fields.
- Prepare magic-token hash fields for Phase 4/5.
- Support revoke and expiration updates.

### Relationships

- Candidate has many invitations.
- Job has many invitations.
- Application has many invitations.
- Invitation references a published interview plan version.
- Invitation will create candidate session in Phase 5.

### Ownership

Owned by Invitation Module.

### Dependencies

- Tenant Module.
- Candidate Module.
- Jobs Module.
- Interview Plan Module.
- Audit Module.
- Domain Events.

### Aggregate Root

`Invitation`

Invariants:

- Invitation belongs to one company.
- Candidate, application, job, and plan version must belong to same company.
- Invitation requires a published interview plan version.
- Active invitation must have future expiration.
- Raw token is never stored.
- Token hash may remain null in draft/pre-send state.
- Sent/opened/completed statuses are reserved for later phases.

### Value Objects

- `InvitationId`
- `InvitationTokenHash`
- `InvitationExpiration`
- `InvitationRecipient`

### Enumerations

- `InvitationStatus`: `draft`, `pending_send`, `sent`, `opened`, `expired`, `revoked`, `completed`

### Database Entities

`candidate_invitations`

Fields:

- `id`
- `companyId`
- `candidateId`
- `applicationId`
- `jobId`
- `interviewPlanVersionId`
- `status`
- `tokenHash`
- `expiresAt`
- `sentAt`
- `openedAt`
- `consumedAt`
- `revokedAt`
- `revokedByUserId`
- `createdByUserId`
- `createdAt`
- `updatedAt`

Indexes:

- Unique `companyId, id`
- Unique `tokenHash`
- `companyId, status`
- `companyId, candidateId`
- `companyId, applicationId`
- `companyId, jobId`
- `expiresAt`

### Service Interfaces

```ts
interface InvitationService {
  createDraft(input: CreateInvitationDraftInput): Promise<Invitation>;
  prepareForSend(input: PrepareInvitationForSendInput): Promise<Invitation>;
  extendExpiration(input: ExtendInvitationInput): Promise<Invitation>;
  revokeInvitation(input: RevokeInvitationInput): Promise<Invitation>;
}
```

### Repository Interfaces

```ts
interface InvitationRepository {
  create(input: CreateInvitationRecord): Promise<Invitation>;
  findById(tenant: TenantContext, id: InvitationId): Promise<Invitation | null>;
  update(input: UpdateInvitationRecord): Promise<Invitation>;
  list(input: ListInvitationsQuery): Promise<PaginatedResult<Invitation>>;
}
```

### Events Emitted

- `invitation.draft_created`
- `invitation.prepared_for_send`
- `invitation.expiration_extended`
- `invitation.revoked`

### Events Consumed

- `candidate.archived` to prevent new invitation creation.
- `job.closed` to prevent new invitation creation.
- `interview_plan.archived` to prevent use of inactive plans.

### Validation Rules

- Candidate must be active.
- Job must be active.
- Application must be active.
- Interview plan version must be published.
- ExpiresAt must be in future and within company/platform policy.
- Revocation requires reason.

### Future Extension Points

- Email queue integration in Phase 4.
- Magic token generation in Phase 5.
- Reminder scheduling.
- Bulk invitations.
- ATS invitation sync.

## Module: Magic Links

### Purpose

Define magic-link architecture and token lifecycle for later candidate portal implementation.

### Responsibilities

- Define token generation and hashing contracts.
- Define single-use semantics.
- Define token rotation/resend behavior.
- Define candidate session creation handoff.

### Relationships

- Invitation owns token hash.
- Candidate session later consumes invitation token.

### Ownership

Owned by Invitation/Candidate Session boundary.

### Dependencies

- Invitation Module.
- Audit Module.
- Idempotency Module.
- Future Rate Limiting.

### Value Objects

- `RawMagicToken`: never persisted, never logged.
- `MagicTokenHash`: persisted.
- `MagicLinkUrl`: created only for email rendering later.

### Service Interfaces

```ts
interface MagicLinkTokenService {
  generateToken(): Promise<RawMagicToken>;
  hashToken(token: RawMagicToken): Promise<MagicTokenHash>;
  verifyToken(input: VerifyMagicTokenInput): Promise<MagicTokenVerification>;
}
```

Phase 3 implementation should define only interfaces and value objects if needed. Token exchange behavior belongs to Phase 5.

### Events Emitted

- None in Phase 3 unless token hash is prepared.
- Later: `invitation.magic_token_rotated`, `candidate_session.created`.

### Validation Rules

- Token entropy at least 128 bits.
- Raw token must not appear in logs, audit metadata, queue payloads, or database.
- Token hash unique globally.
- Magic tokens are single-use for session creation.

### Future Extension Points

- Rate limiting by IP/token attempt.
- Resume token mechanism.
- Referrer protection.

## Module: Interview Lifecycle Foundation

### Purpose

Define planned interview lifecycle records and state model before browser interview execution.

### Responsibilities

- Create interview session shell when invitation is prepared or candidate starts later.
- Define state transitions.
- Reference candidate, application, invitation, job, and plan version.
- Preserve immutable plan snapshot reference.

### Relationships

- Invitation may have one interview session.
- Candidate/application/job can have many sessions historically.
- Interview session later owns turns, readiness, recording, transcript, evaluation, and report.

### Ownership

Owned by Interview Module.

### Dependencies

- Candidate Module.
- Invitation Module.
- Interview Plan Module.
- Audit Module.

### Aggregate Root

`InterviewSession`

Invariants:

- One active interview session per invitation.
- Session references published plan version used by invitation.
- Invalid transitions are rejected and audited.
- Candidate cannot start interview if invitation revoked, expired, or already completed.

### Enumerations

Use architecture state machine:

- `invited`
- `opened`
- `consented`
- `checks_in_progress`
- `checks_failed`
- `ready`
- `in_progress`
- `interrupted`
- `completed`
- `processing`
- `results_ready`
- `expired`
- `cancelled`
- `withdrawn`
- `upload_recovery`
- `processing_failed`

### Database Entities

`interview_sessions`

Fields:

- `id`
- `companyId`
- `candidateId`
- `applicationId`
- `invitationId`
- `jobId`
- `interviewPlanVersionId`
- `status`
- `startedAt`
- `completedAt`
- `interruptedAt`
- `lastActivityAt`
- `durationSeconds`
- `currentQuestionSequence`
- `resumeAllowedUntil`
- `createdAt`
- `updatedAt`

Indexes:

- Unique `companyId, id`
- Unique `companyId, invitationId`
- `companyId, status`
- `companyId, candidateId`
- `companyId, applicationId`
- `companyId, jobId`

### Service Interfaces

```ts
interface InterviewLifecycleService {
  createSessionShell(input: CreateInterviewSessionShellInput): Promise<InterviewSession>;
  transition(input: TransitionInterviewSessionInput): Promise<InterviewSession>;
  getSessionForInvitation(input: GetSessionForInvitationInput): Promise<InterviewSession | null>;
}
```

### Events Emitted

- `interview_session.created`
- `interview_session.status_changed`

### Events Consumed

- `invitation.prepared_for_send` may create shell depending on implementation choice.
- `invitation.revoked` should cancel unstarted sessions.

### Validation Rules

- Session shell cannot be created for draft invitation.
- State transitions must follow explicit transition table.
- Manual cancellation requires reason.

### Future Extension Points

- Browser interview execution.
- Readiness checks.
- Recording lifecycle.
- Workflow processing.

## Module: Scheduling Architecture

### Purpose

Prepare calendar-neutral scheduling for future live coordination, reminders, and interview windows without depending on a specific calendar provider.

### Responsibilities

- Model schedule holds and interview windows.
- Define calendar abstraction.
- Support future Google/Microsoft calendar adapters.
- Emit scheduling events for notifications.

### Relationships

- Candidate application may have schedule events.
- Invitation may have optional interview window.
- Users may be participants/reviewers.

### Ownership

Owned by Scheduling Module.

### Dependencies

- Tenant Module.
- Candidate Module.
- Jobs Module.
- Identity Module.
- Domain Events.
- Notification foundation.

### Aggregate Root

`ScheduleEvent`

Invariants:

- Schedule event belongs to company.
- Participants belong to same company unless external participant is candidate.
- Calendar provider data remains provider-specific metadata.
- Cancelling schedule event does not revoke invitation unless explicitly requested.

### Value Objects

- `DateTimeRange`
- `TimeZone`
- `CalendarProviderRef`
- `ExternalCalendarEventRef`

### Enumerations

- `ScheduleEventType`: `interview_window`, `review_meeting`, `reminder_hold`, `other`
- `ScheduleEventStatus`: `scheduled`, `rescheduled`, `cancelled`, `completed`
- `CalendarProvider`: `internal`, `google`, `microsoft`, `other`

### Database Entities

`schedule_events`

Fields:

- `id`
- `companyId`
- `candidateId`
- `applicationId`
- `invitationId`
- `jobId`
- `type`
- `status`
- `title`
- `description`
- `startsAt`
- `endsAt`
- `timeZone`
- `provider`
- `providerEventRef`
- `metadataJson`
- `createdByUserId`
- `createdAt`
- `updatedAt`
- `cancelledAt`

Indexes:

- Unique `companyId, id`
- `companyId, candidateId`
- `companyId, applicationId`
- `companyId, invitationId`
- `companyId, startsAt`
- `companyId, status`

`schedule_event_participants`

Fields:

- `companyId`
- `scheduleEventId`
- `participantType`: `user`, `candidate`, `external`
- `participantId`
- `email`
- `responseStatus`
- `createdAt`

Indexes:

- Primary key `companyId, scheduleEventId, participantType, participantId`
- `companyId, participantType, participantId`

### Calendar Abstraction

```ts
interface CalendarProviderAdapter {
  createEvent(input: CreateCalendarEventInput): Promise<CalendarProviderResult>;
  updateEvent(input: UpdateCalendarEventInput): Promise<CalendarProviderResult>;
  cancelEvent(input: CancelCalendarEventInput): Promise<void>;
}
```

Phase 3 should not implement external adapters.

### Service Interfaces

```ts
interface SchedulingService {
  createScheduleEvent(input: CreateScheduleEventInput): Promise<ScheduleEvent>;
  rescheduleEvent(input: RescheduleEventInput): Promise<ScheduleEvent>;
  cancelEvent(input: CancelScheduleEventInput): Promise<ScheduleEvent>;
}
```

### Events Emitted

- `schedule_event.created`
- `schedule_event.rescheduled`
- `schedule_event.cancelled`

### Events Consumed

- `invitation.prepared_for_send` may schedule reminder holds later.

### Validation Rules

- Start time before end time.
- Time zone valid IANA zone.
- Candidate schedule event must reference candidate or invitation.
- External provider refs stored only as refs, not provider credentials.

### Future Extension Points

- Google Calendar adapter.
- Microsoft Graph adapter.
- Availability search.
- Interview panel scheduling.
- Reminder automation.

## Module: Notification Architecture

### Purpose

Define notification intent records and event-driven contracts before email delivery is implemented.

### Responsibilities

- Convert domain events into notification intents later.
- Support in-app, email, and future Slack/webhook notification channels.
- Keep notification decisions separate from email transport.

### Relationships

- Domain events produce notification intents.
- Email Module later consumes email notification intents.

### Ownership

Owned by Notification Module.

### Dependencies

- Domain Events.
- Tenant Module.
- Identity Module.
- Email Module later.

### Aggregate Root

`NotificationIntent`

Invariants:

- Notification intent payload contains only IDs and safe variables.
- No raw magic tokens in notification intent.
- Delivery-specific records belong to Email Module later.

### Enumerations

- `NotificationIntentType`: `invitation_created`, `invitation_ready_to_send`, `candidate_stage_changed`, `schedule_created`, `schedule_cancelled`, `review_assigned`
- `NotificationChannel`: `email`, `in_app`, `webhook`
- `NotificationIntentStatus`: `pending`, `suppressed`, `queued`, `cancelled`

### Database Entities

Optional in Phase 3:

`notification_intents`

Fields:

- `id`
- `companyId`
- `type`
- `channel`
- `status`
- `recipientType`
- `recipientId`
- `recipientEmail`
- `subjectType`
- `subjectId`
- `payloadJson`
- `createdAt`
- `updatedAt`

Indexes:

- Unique `companyId, id`
- `companyId, status`
- `companyId, recipientType, recipientId`
- `companyId, subjectType, subjectId`

### Service Interfaces

```ts
interface NotificationIntentService {
  createIntent(input: CreateNotificationIntentInput): Promise<NotificationIntent>;
  suppressIntent(input: SuppressNotificationIntentInput): Promise<NotificationIntent>;
  markQueued(input: MarkNotificationQueuedInput): Promise<NotificationIntent>;
}
```

### Events Consumed

- `invitation.prepared_for_send`
- `candidate_application.stage_changed`
- `schedule_event.created`
- `schedule_event.cancelled`

### Events Emitted

- `notification_intent.created`
- `notification_intent.suppressed`
- `notification_intent.queued`

### Validation Rules

- Payload JSON must include `schemaVersion`.
- Payload cannot include secrets, raw token, signed URL, note body, transcript, or restricted content.
- Email notifications require normalized recipient email.

### Future Extension Points

- User notification preferences.
- Digest notifications.
- Slack/MS Teams integrations.
- External webhooks.

## Domain Events Catalog

Phase 3 should define event types even if dispatch remains in-process.

Company:

- `company.profile_updated`
- `company_settings.branding_updated`
- `company_settings.candidate_policy_updated`
- `company_settings.invitation_policy_updated`
- `company_settings.scheduling_policy_updated`

Organization:

- `department.created`
- `department.updated`
- `department.archived`
- `team.created`
- `team.updated`
- `team.archived`
- `team_member.added`
- `team_member.removed`
- `location.created`
- `location.updated`
- `location.archived`

Jobs and plans:

- `job.created`
- `job.updated`
- `job.activated`
- `job.paused`
- `job.closed`
- `job.archived`
- `job_template.created`
- `job_template.updated`
- `job_template.archived`
- `pipeline.created`
- `pipeline.updated`
- `pipeline.activated`
- `pipeline.archived`
- `pipeline_stage.created`
- `pipeline_stage.updated`
- `pipeline_stage.reordered`
- `pipeline_stage.archived`
- `interview_plan.created`
- `interview_plan.updated`
- `interview_plan.published`
- `interview_plan.archived`

Candidates:

- `candidate.created`
- `candidate.updated`
- `candidate.archived`
- `candidate.restored`
- `candidate.merged`
- `candidate.anonymized`
- `candidate_application.created`
- `candidate_application.stage_changed`
- `candidate_application.closed`
- `candidate_document.created`
- `candidate_document.uploaded`
- `candidate_document.deleted`
- `candidate_tag.created`
- `candidate_tag.updated`
- `candidate_tag.archived`
- `candidate_tag.assigned`
- `candidate_tag.removed`
- `candidate_note.created`
- `candidate_note.updated`
- `candidate_note.deleted`

Invitations and interviews:

- `invitation.draft_created`
- `invitation.prepared_for_send`
- `invitation.expiration_extended`
- `invitation.revoked`
- `interview_session.created`
- `interview_session.status_changed`

Scheduling and notifications:

- `schedule_event.created`
- `schedule_event.rescheduled`
- `schedule_event.cancelled`
- `notification_intent.created`
- `notification_intent.suppressed`
- `notification_intent.queued`

## API Contracts Required Later

Phase 3 implementation may include route handlers only if approved for coding. The domain design should support these future APIs.

Company settings:

- `GET /api/company/settings`
- `PATCH /api/company/settings/profile`
- `PATCH /api/company/settings/branding`
- `PATCH /api/company/settings/candidate-policy`
- `PATCH /api/company/settings/invitation-policy`
- `PATCH /api/company/settings/scheduling`

Organization:

- `GET /api/company/departments`
- `POST /api/company/departments`
- `PATCH /api/company/departments/:departmentId`
- `POST /api/company/departments/:departmentId/archive`
- `GET /api/company/teams`
- `POST /api/company/teams`
- `PATCH /api/company/teams/:teamId`
- `POST /api/company/teams/:teamId/archive`
- `POST /api/company/teams/:teamId/members`
- `DELETE /api/company/teams/:teamId/members/:userId`
- `GET /api/company/locations`
- `POST /api/company/locations`
- `PATCH /api/company/locations/:locationId`
- `POST /api/company/locations/:locationId/archive`

Jobs:

- `GET /api/jobs`
- `POST /api/jobs`
- `GET /api/jobs/:jobId`
- `PATCH /api/jobs/:jobId`
- `POST /api/jobs/:jobId/activate`
- `POST /api/jobs/:jobId/pause`
- `POST /api/jobs/:jobId/close`
- `POST /api/jobs/:jobId/archive`
- `GET /api/job-templates`
- `POST /api/job-templates`
- `POST /api/jobs/from-template`

Pipelines:

- `GET /api/pipelines`
- `POST /api/pipelines`
- `PATCH /api/pipelines/:pipelineId`
- `POST /api/pipelines/:pipelineId/activate`
- `POST /api/pipelines/:pipelineId/archive`
- `POST /api/pipelines/:pipelineId/stages`
- `PATCH /api/pipelines/:pipelineId/stages/:stageId`
- `PUT /api/pipelines/:pipelineId/stages/order`
- `POST /api/pipelines/:pipelineId/stages/:stageId/archive`

Interview plans:

- `GET /api/jobs/:jobId/interview-plans`
- `POST /api/jobs/:jobId/interview-plans`
- `PATCH /api/interview-plans/:planId`
- `POST /api/interview-plans/:planId/publish`
- `POST /api/interview-plans/:planId/archive`

Candidates:

- `GET /api/candidates`
- `POST /api/candidates`
- `GET /api/candidates/:candidateId`
- `PATCH /api/candidates/:candidateId`
- `POST /api/candidates/:candidateId/archive`
- `POST /api/candidates/:candidateId/restore`
- `POST /api/candidates/merge`
- `POST /api/candidates/:candidateId/applications`
- `POST /api/applications/:applicationId/stage`
- `POST /api/applications/:applicationId/close`
- `POST /api/candidates/:candidateId/tags/:tagId`
- `DELETE /api/candidates/:candidateId/tags/:tagId`
- `POST /api/candidates/:candidateId/notes`
- `PATCH /api/candidate-notes/:noteId`
- `DELETE /api/candidate-notes/:noteId`

Invitations:

- `GET /api/invitations`
- `POST /api/invitations/drafts`
- `POST /api/invitations/:invitationId/prepare`
- `POST /api/invitations/:invitationId/extend`
- `POST /api/invitations/:invitationId/revoke`

Scheduling:

- `GET /api/schedule-events`
- `POST /api/schedule-events`
- `PATCH /api/schedule-events/:eventId`
- `POST /api/schedule-events/:eventId/cancel`

API rules:

- Mutations use idempotency keys where duplicate side effects are possible.
- List endpoints use cursor pagination.
- Responses include request ID.
- Sensitive mutations audit before/after context.
- Route handlers remain thin and delegate to application services.

## Future UI Dependencies

Company workspace:

- Settings screens need company profile, branding, candidate policy, invitation policy, support access visibility, retention summary.
- Organization screens need departments, teams, locations, and team membership.
- Jobs screens need job list, job detail, template picker, pipeline selector, interview plan version history.
- Candidate screens need searchable candidate list, candidate profile, applications, tags, notes, documents, invitation history.
- Invitation screens need draft management, plan snapshot selector, expiration controls, revoke/extend actions.
- Scheduling screens need event list, date/time fields, timezone handling, and participant selectors.

UI constraints:

- Use operational tables and forms, not AI-themed interface.
- Do not expose raw technical IDs except where needed for admin support.
- Destructive actions require confirmation and reason where audit requires it.
- Candidate notes and restricted records need visible permission boundaries.

## Future AI Dependencies

Phase 3 should not integrate AI, but it must prepare structured inputs:

- Job title, department, seniority, employment type, and description.
- Interview plan version, question plan, rubric, duration.
- Candidate application context.
- Pipeline stage category.

Future AI modules may consume:

- Published interview plan snapshots.
- Rubric definitions with schema version.
- Job and candidate metadata after redaction policy.

AI rules:

- No AI-generated decisions in Phase 3.
- No provider-specific fields in job, candidate, or invitation core tables.
- AI suggestion features must create draft artifacts requiring human review.

## Future Reporting Dependencies

Phase 3 must preserve reporting dimensions:

- Company.
- Department.
- Team.
- Location.
- Job.
- Pipeline.
- Pipeline stage.
- Candidate source.
- Candidate status.
- Application status.
- Invitation status.
- Interview plan version.

Reporting requirements:

- Avoid storing only JSON for fields used as report dimensions.
- Stage changes should be evented and eventually persisted for history.
- Candidate merge should preserve source/target lineage.
- Invitation lifecycle timestamps must support conversion metrics later.

## Future Analytics Dependencies

Analytics event capture may consume low-detail domain events.

Allowed analytics properties:

- IDs.
- Statuses.
- Stage categories.
- Duration buckets.
- Counts.
- Non-sensitive labels where safe.

Disallowed analytics properties:

- Candidate note body.
- Full candidate email where not required.
- Raw token or token hash.
- Document contents.
- Interview transcript.
- Evaluation payload.
- Signed URLs.

Future analytics events:

- `candidate_created`
- `candidate_application_created`
- `candidate_stage_changed`
- `job_activated`
- `interview_plan_published`
- `invitation_prepared`
- `invitation_revoked`

## Search Foundation Dependencies

Phase 3 should prepare search-safe fields:

- Candidate name and normalized email.
- Job title and job code.
- Department/team/location names.
- Tags.
- Invitation status.

Search rules:

- Search must always include tenant scope.
- Search must respect permissions.
- Restricted note bodies should not be indexed in general workspace search.
- Candidate document contents should not be indexed in Phase 3.

## Database Schema Additions Summary

Organization:

- `departments`
- `teams`
- `team_members`
- `locations`

Jobs:

- `jobs`
- `job_templates`
- `hiring_pipelines`
- `pipeline_stages`
- `interview_plans`
- `interview_plan_versions`

Candidates:

- `candidates`
- `candidate_applications`
- `candidate_documents`
- `candidate_tags`
- `candidate_tag_assignments`
- `candidate_notes`
- `candidate_merge_events`

Invitations and interviews:

- `candidate_invitations`
- `interview_sessions`

Scheduling and notifications:

- `schedule_events`
- `schedule_event_participants`
- Optional `notification_intents`
- Optional `domain_events`

Every tenant-owned table:

- `companyId` required.
- `@@unique([companyId, id])`.
- Tenant-leading indexes.
- Foreign keys should use tenant-qualified references where possible.

## Permission Catalog Additions

Recommended Phase 3 permissions:

- `company_settings:read`
- `company_settings:manage`
- `departments:read`
- `departments:manage`
- `teams:read`
- `teams:manage`
- `locations:read`
- `locations:manage`
- `jobs:read`
- `jobs:manage`
- `job_templates:read`
- `job_templates:manage`
- `pipelines:read`
- `pipelines:manage`
- `interview_plans:read`
- `interview_plans:manage`
- `candidates:read`
- `candidates:manage`
- `candidate_notes:read`
- `candidate_notes:manage`
- `candidate_documents:read`
- `candidate_documents:manage`
- `invitations:read`
- `invitations:manage`
- `scheduling:read`
- `scheduling:manage`

Default role guidance:

- Company Admin: all Phase 3 permissions.
- HR: manage jobs, candidates, invitations, notes, and scheduling; read settings.
- Read-only Reviewer: read jobs, candidates, interview plans, invitations, and scheduling; no manage permissions.

## Implementation Build Order For Phase 3

1. Shared domain event envelope and optional event store interface.
2. Company settings service expansion.
3. Permission catalog additions and role templates.
4. Departments.
5. Teams and team members.
6. Locations.
7. Hiring pipelines.
8. Pipeline stages.
9. Jobs.
10. Job templates.
11. Interview plans.
12. Interview plan versions and publish snapshots.
13. Candidate profiles.
14. Candidate applications.
15. Candidate tags.
16. Candidate notes.
17. Candidate documents metadata.
18. Candidate merge/archive/anonymization handoff.
19. Invitation drafts.
20. Invitation prepare/revoke/extend lifecycle without sending.
21. Interview session shell and lifecycle transition foundation.
22. Scheduling foundation.
23. Notification intent foundation if needed by Phase 4.
24. Search-safe repository query foundations.
25. Integration tests for tenant isolation and snapshot immutability.

## Phase 3 Acceptance Criteria

- Company admins can manage settings domain through services.
- Organization entities exist: departments, teams, locations.
- Jobs can be created, updated, activated, paused, closed, and archived.
- Hiring pipelines and stages can be managed and attached to jobs.
- Interview plans can be drafted and published as immutable versions.
- Candidates can be created, updated, archived, merged, tagged, noted, and linked to jobs.
- Invitation drafts can be created and prepared against published plan snapshots.
- Invitation lifecycle rules exist for revoke and expiration.
- Interview session shell and state machine foundation exist.
- Scheduling abstractions exist without external calendar provider coupling.
- Domain events are defined for Phase 3 business changes.
- Tenant isolation tests exist for each new tenant-owned resource.
- Sensitive changes produce audit events.
- No email sending, candidate portal, live interview, media, transcript, evaluation, or report generation exists.

## Required Test Coverage

- Tenant isolation for every repository.
- Cross-tenant FK rejection or service-level denial.
- Permission matrix for company admin, HR, and read-only reviewer.
- Department/team/location uniqueness.
- Job lifecycle transitions.
- Pipeline activation and stage ordering.
- Interview plan publish immutability.
- Invitation requires published plan version.
- Candidate uniqueness and duplicate policy.
- Candidate merge audit and lineage.
- Candidate archive blocks new invitations.
- Legal hold blocks anonymization/deletion handoff.
- Notes do not leak into domain event payloads.
- Schedule time range validation.
- Domain event payload redaction tests.

## Open Decisions Before Coding

These should be resolved at the start of Phase 3 implementation:

1. Whether to physically name the primary job table `jobs` or retain `job_roles` for backward continuity. Product/domain language should be `Job`.
2. Whether Phase 3 should persist `domain_events` immediately or keep an in-process event bus until Phase 4.
3. Whether `notification_intents` are needed in Phase 3 or should wait until Phase 4 email delivery.
4. Whether candidate duplicate policy should use a manual partial unique index for active normalized emails.
5. Whether module folders should be reorganized into `domain`, `application`, and `persistence` during Phase 3 or remain flat until modules grow.

## Final Design Position

Phase 3 should turn Aptly from an infrastructure foundation into a coherent recruitment domain foundation. The most important design commitments are immutable interview plan snapshots, tenant-scoped candidate and job ownership, evented lifecycle changes, auditable sensitive actions, and strict separation between invitation preparation and later email/candidate portal execution.

If implemented according to this design, later phases can add email, candidate entry, live browser interviews, media, AI evaluation, reporting, and integrations without redesigning the core business domain.
