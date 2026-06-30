-- Phase 3 job architecture foundation: hiring pipelines, stages, job templates, jobs, and interview plan versions.

CREATE TYPE "hiring_pipeline_status" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "pipeline_stage_status" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "pipeline_stage_category" AS ENUM ('APPLICATION_REVIEW', 'SCREEN', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED');
CREATE TYPE "job_status" AS ENUM ('DRAFT', 'OPEN', 'PAUSED', 'CLOSED', 'ARCHIVED');
CREATE TYPE "job_template_status" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "employment_type" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'TEMPORARY', 'INTERNSHIP');
CREATE TYPE "workplace_type" AS ENUM ('ONSITE', 'HYBRID', 'REMOTE');
CREATE TYPE "seniority_level" AS ENUM ('ENTRY', 'MID', 'SENIOR', 'STAFF', 'EXECUTIVE');
CREATE TYPE "interview_plan_status" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "interview_plan_version_status" AS ENUM ('DRAFT', 'PUBLISHED', 'RETIRED');

CREATE TABLE "hiring_pipelines" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "status" "hiring_pipeline_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hiring_pipelines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pipeline_stages" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "pipeline_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" "pipeline_stage_category" NOT NULL,
    "position" INTEGER NOT NULL,
    "is_terminal" BOOLEAN NOT NULL DEFAULT false,
    "status" "pipeline_stage_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "pipeline_stages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "department_id" TEXT,
    "team_id" TEXT,
    "location_id" TEXT,
    "pipeline_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description_json" JSONB NOT NULL,
    "requirements_json" JSONB NOT NULL,
    "employment_type" "employment_type" NOT NULL,
    "workplace_type" "workplace_type" NOT NULL,
    "seniority_level" "seniority_level" NOT NULL,
    "status" "job_status" NOT NULL DEFAULT 'DRAFT',
    "opened_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "job_templates" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "pipeline_id" TEXT,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description_json" JSONB NOT NULL,
    "requirements_json" JSONB NOT NULL,
    "employment_type" "employment_type",
    "workplace_type" "workplace_type",
    "seniority_level" "seniority_level",
    "status" "job_template_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "job_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "interview_plans" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "job_id" TEXT,
    "job_template_id" TEXT,
    "name" TEXT NOT NULL,
    "status" "interview_plan_status" NOT NULL DEFAULT 'DRAFT',
    "active_version_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "interview_plans_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "interview_plans_exactly_one_owner_check" CHECK ((job_id IS NOT NULL)::integer + (job_template_id IS NOT NULL)::integer = 1)
);

CREATE TABLE "interview_plan_versions" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "interview_plan_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "status" "interview_plan_version_status" NOT NULL DEFAULT 'DRAFT',
    "competency_json" JSONB NOT NULL,
    "question_blueprint_json" JSONB NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interview_plan_versions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "interview_plan_versions_duration_check" CHECK ("duration_minutes" BETWEEN 5 AND 240)
);

CREATE UNIQUE INDEX "hiring_pipelines_company_id_id_key" ON "hiring_pipelines"("company_id", "id");
CREATE UNIQUE INDEX "hiring_pipelines_company_id_slug_key" ON "hiring_pipelines"("company_id", "slug");
CREATE INDEX "hiring_pipelines_company_id_status_idx" ON "hiring_pipelines"("company_id", "status");

CREATE UNIQUE INDEX "pipeline_stages_company_id_id_key" ON "pipeline_stages"("company_id", "id");
CREATE UNIQUE INDEX "pipeline_stages_company_id_pipeline_id_slug_key" ON "pipeline_stages"("company_id", "pipeline_id", "slug");
CREATE UNIQUE INDEX "pipeline_stages_company_id_pipeline_id_position_key" ON "pipeline_stages"("company_id", "pipeline_id", "position");
CREATE INDEX "pipeline_stages_company_id_pipeline_id_status_idx" ON "pipeline_stages"("company_id", "pipeline_id", "status");

CREATE UNIQUE INDEX "jobs_company_id_id_key" ON "jobs"("company_id", "id");
CREATE UNIQUE INDEX "jobs_company_id_slug_key" ON "jobs"("company_id", "slug");
CREATE INDEX "jobs_company_id_status_idx" ON "jobs"("company_id", "status");
CREATE INDEX "jobs_company_id_pipeline_id_idx" ON "jobs"("company_id", "pipeline_id");
CREATE INDEX "jobs_company_id_department_id_idx" ON "jobs"("company_id", "department_id");
CREATE INDEX "jobs_company_id_team_id_idx" ON "jobs"("company_id", "team_id");
CREATE INDEX "jobs_company_id_location_id_idx" ON "jobs"("company_id", "location_id");

CREATE UNIQUE INDEX "job_templates_company_id_id_key" ON "job_templates"("company_id", "id");
CREATE UNIQUE INDEX "job_templates_company_id_slug_key" ON "job_templates"("company_id", "slug");
CREATE INDEX "job_templates_company_id_status_idx" ON "job_templates"("company_id", "status");
CREATE INDEX "job_templates_company_id_pipeline_id_idx" ON "job_templates"("company_id", "pipeline_id");

CREATE UNIQUE INDEX "interview_plans_company_id_id_key" ON "interview_plans"("company_id", "id");
CREATE INDEX "interview_plans_company_id_job_id_idx" ON "interview_plans"("company_id", "job_id");
CREATE INDEX "interview_plans_company_id_job_template_id_idx" ON "interview_plans"("company_id", "job_template_id");
CREATE INDEX "interview_plans_company_id_status_idx" ON "interview_plans"("company_id", "status");

CREATE UNIQUE INDEX "interview_plan_versions_company_id_id_key" ON "interview_plan_versions"("company_id", "id");
CREATE UNIQUE INDEX "interview_plan_versions_company_id_interview_plan_id_version_number_key" ON "interview_plan_versions"("company_id", "interview_plan_id", "version_number");
CREATE INDEX "interview_plan_versions_company_id_interview_plan_id_status_idx" ON "interview_plan_versions"("company_id", "interview_plan_id", "status");

ALTER TABLE "hiring_pipelines" ADD CONSTRAINT "hiring_pipelines_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pipeline_stages" ADD CONSTRAINT "pipeline_stages_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pipeline_stages" ADD CONSTRAINT "pipeline_stages_company_id_pipeline_id_fkey" FOREIGN KEY ("company_id", "pipeline_id") REFERENCES "hiring_pipelines"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_company_id_department_id_fkey" FOREIGN KEY ("company_id", "department_id") REFERENCES "departments"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_company_id_team_id_fkey" FOREIGN KEY ("company_id", "team_id") REFERENCES "teams"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_company_id_location_id_fkey" FOREIGN KEY ("company_id", "location_id") REFERENCES "locations"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_company_id_pipeline_id_fkey" FOREIGN KEY ("company_id", "pipeline_id") REFERENCES "hiring_pipelines"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "job_templates" ADD CONSTRAINT "job_templates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "job_templates" ADD CONSTRAINT "job_templates_company_id_pipeline_id_fkey" FOREIGN KEY ("company_id", "pipeline_id") REFERENCES "hiring_pipelines"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "interview_plans" ADD CONSTRAINT "interview_plans_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "interview_plans" ADD CONSTRAINT "interview_plans_company_id_job_id_fkey" FOREIGN KEY ("company_id", "job_id") REFERENCES "jobs"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "interview_plans" ADD CONSTRAINT "interview_plans_company_id_job_template_id_fkey" FOREIGN KEY ("company_id", "job_template_id") REFERENCES "job_templates"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "interview_plan_versions" ADD CONSTRAINT "interview_plan_versions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "interview_plan_versions" ADD CONSTRAINT "interview_plan_versions_company_id_interview_plan_id_fkey" FOREIGN KEY ("company_id", "interview_plan_id") REFERENCES "interview_plans"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
