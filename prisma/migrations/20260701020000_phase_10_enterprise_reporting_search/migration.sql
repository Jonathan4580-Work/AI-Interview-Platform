BEGIN;

-- AlterEnum
ALTER TYPE "export_request_type" ADD VALUE IF NOT EXISTS 'CANDIDATE_TRANSCRIPT';
ALTER TYPE "export_request_type" ADD VALUE IF NOT EXISTS 'ROLE_PIPELINE_CSV';
ALTER TYPE "export_request_type" ADD VALUE IF NOT EXISTS 'CANDIDATE_COMPARISON';
ALTER TYPE "export_request_type" ADD VALUE IF NOT EXISTS 'EMAIL_DELIVERABILITY';
ALTER TYPE "export_request_type" ADD VALUE IF NOT EXISTS 'COMPLIANCE_ACCESS';

-- AlterEnum
ALTER TYPE "export_request_status" ADD VALUE IF NOT EXISTS 'REQUESTED';
ALTER TYPE "export_request_status" ADD VALUE IF NOT EXISTS 'QUEUED';
ALTER TYPE "export_request_status" ADD VALUE IF NOT EXISTS 'GENERATING';
ALTER TYPE "export_request_status" ADD VALUE IF NOT EXISTS 'CANCELLED';

COMMIT;

BEGIN;

-- CreateEnum
CREATE TYPE "aggregate_report_type" AS ENUM ('ROLE_PIPELINE', 'INVITATION_CONVERSION', 'INVITATION_DELIVERY', 'CANDIDATE_PORTAL_ENTRY', 'READINESS_DROPOFF', 'INTERVIEW_COMPLETION', 'INTERVIEW_INTERRUPTION', 'PROCESSING_LATENCY', 'EVALUATION_DISTRIBUTION', 'CONFIDENCE_DISTRIBUTION', 'MONITORING_WARNING_FREQUENCY', 'REVIEWER_WORKLOAD', 'TIME_TO_REVIEW', 'HUMAN_DECISION_DISTRIBUTION', 'EMAIL_DELIVERABILITY', 'COMPLIANCE_ACCESS', 'SUPPORT_ACCESS');

-- CreateEnum
CREATE TYPE "aggregate_report_run_status" AS ENUM ('REQUESTED', 'RUNNING', 'READY', 'FAILED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "export_artifact_status" AS ENUM ('PENDING', 'READY', 'FAILED', 'EXPIRED', 'DELETED');

-- CreateEnum
CREATE TYPE "export_access_event_type" AS ENUM ('SIGNED_URL_ISSUED', 'DOWNLOADED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "search_projection_status" AS ENUM ('ACTIVE', 'STALE', 'REBUILDING', 'FAILED');

-- AlterTable
ALTER TABLE "export_requests" ALTER COLUMN "status" SET DEFAULT 'REQUESTED';
ALTER TABLE "export_requests" ADD COLUMN "idempotency_key" TEXT;
ALTER TABLE "export_requests" ADD COLUMN "reason" TEXT;
ALTER TABLE "export_requests" ADD COLUMN "workflow_id" TEXT;

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "event_key" TEXT NOT NULL,
    "subject_type" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "schema_version" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "properties_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aggregate_report_runs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "requested_by_user_id" TEXT,
    "report_type" "aggregate_report_type" NOT NULL,
    "status" "aggregate_report_run_status" NOT NULL DEFAULT 'REQUESTED',
    "idempotency_key" TEXT,
    "date_range_start" TIMESTAMP(3) NOT NULL,
    "date_range_end" TIMESTAMP(3) NOT NULL,
    "filters_json" JSONB NOT NULL,
    "dimensions_json" JSONB NOT NULL,
    "result_json" JSONB,
    "row_count" INTEGER,
    "generated_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aggregate_report_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_artifacts" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "export_request_id" TEXT NOT NULL,
    "status" "export_artifact_status" NOT NULL DEFAULT 'PENDING',
    "storage_provider" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" BIGINT,
    "checksum_sha256" TEXT,
    "retention_delete_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "legal_hold_id" TEXT,
    "legal_hold_active" BOOLEAN NOT NULL DEFAULT false,
    "metadata_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "export_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_access_logs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "export_request_id" TEXT NOT NULL,
    "export_artifact_id" TEXT,
    "actor_user_id" TEXT,
    "event_type" "export_access_event_type" NOT NULL,
    "request_id" TEXT,
    "correlation_id" TEXT,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "metadata_json" JSONB NOT NULL,

    CONSTRAINT "export_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_projection_metadata" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "provider_key" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "status" "search_projection_status" NOT NULL DEFAULT 'ACTIVE',
    "last_indexed_at" TIMESTAMP(3),
    "cursor_value" TEXT,
    "metadata_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "search_projection_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "export_requests_company_id_idempotency_key_key" ON "export_requests"("company_id", "idempotency_key");
CREATE INDEX "export_requests_company_id_type_created_at_idx" ON "export_requests"("company_id", "type", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_events_company_id_id_key" ON "analytics_events"("company_id", "id");
CREATE UNIQUE INDEX "analytics_events_company_id_idempotency_key_key" ON "analytics_events"("company_id", "idempotency_key");
CREATE INDEX "analytics_events_company_id_event_key_occurred_at_idx" ON "analytics_events"("company_id", "event_key", "occurred_at");
CREATE INDEX "analytics_events_company_id_subject_type_subject_id_idx" ON "analytics_events"("company_id", "subject_type", "subject_id");
CREATE INDEX "analytics_events_company_id_occurred_at_idx" ON "analytics_events"("company_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "aggregate_report_runs_company_id_id_key" ON "aggregate_report_runs"("company_id", "id");
CREATE UNIQUE INDEX "aggregate_report_runs_company_id_idempotency_key_key" ON "aggregate_report_runs"("company_id", "idempotency_key");
CREATE INDEX "aggregate_report_runs_company_id_report_type_created_at_idx" ON "aggregate_report_runs"("company_id", "report_type", "created_at");
CREATE INDEX "aggregate_report_runs_company_id_status_created_at_idx" ON "aggregate_report_runs"("company_id", "status", "created_at");
CREATE INDEX "aggregate_report_runs_company_id_date_range_start_date_range_end_idx" ON "aggregate_report_runs"("company_id", "date_range_start", "date_range_end");

-- CreateIndex
CREATE UNIQUE INDEX "export_artifacts_company_id_id_key" ON "export_artifacts"("company_id", "id");
CREATE UNIQUE INDEX "export_artifacts_company_id_storage_key_key" ON "export_artifacts"("company_id", "storage_key");
CREATE INDEX "export_artifacts_company_id_export_request_id_status_idx" ON "export_artifacts"("company_id", "export_request_id", "status");
CREATE INDEX "export_artifacts_company_id_status_expires_at_idx" ON "export_artifacts"("company_id", "status", "expires_at");
CREATE INDEX "export_artifacts_company_id_retention_delete_at_idx" ON "export_artifacts"("company_id", "retention_delete_at");

-- CreateIndex
CREATE UNIQUE INDEX "export_access_logs_company_id_id_key" ON "export_access_logs"("company_id", "id");
CREATE INDEX "export_access_logs_company_id_export_request_id_issued_at_idx" ON "export_access_logs"("company_id", "export_request_id", "issued_at");
CREATE INDEX "export_access_logs_company_id_event_type_issued_at_idx" ON "export_access_logs"("company_id", "event_type", "issued_at");
CREATE INDEX "export_access_logs_company_id_actor_user_id_issued_at_idx" ON "export_access_logs"("company_id", "actor_user_id", "issued_at");

-- CreateIndex
CREATE UNIQUE INDEX "search_projection_metadata_company_id_id_key" ON "search_projection_metadata"("company_id", "id");
CREATE UNIQUE INDEX "search_projection_metadata_company_id_provider_key_entity_type_key" ON "search_projection_metadata"("company_id", "provider_key", "entity_type");
CREATE INDEX "search_projection_metadata_company_id_status_updated_at_idx" ON "search_projection_metadata"("company_id", "status", "updated_at");

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aggregate_report_runs" ADD CONSTRAINT "aggregate_report_runs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "aggregate_report_runs" ADD CONSTRAINT "aggregate_report_runs_company_id_requested_by_user_id_fkey" FOREIGN KEY ("company_id", "requested_by_user_id") REFERENCES "users"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_artifacts" ADD CONSTRAINT "export_artifacts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "export_artifacts" ADD CONSTRAINT "export_artifacts_company_id_export_request_id_fkey" FOREIGN KEY ("company_id", "export_request_id") REFERENCES "export_requests"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "export_artifacts" ADD CONSTRAINT "export_artifacts_company_id_legal_hold_id_fkey" FOREIGN KEY ("company_id", "legal_hold_id") REFERENCES "legal_holds"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_access_logs" ADD CONSTRAINT "export_access_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "export_access_logs" ADD CONSTRAINT "export_access_logs_company_id_export_request_id_fkey" FOREIGN KEY ("company_id", "export_request_id") REFERENCES "export_requests"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "export_access_logs" ADD CONSTRAINT "export_access_logs_company_id_export_artifact_id_fkey" FOREIGN KEY ("company_id", "export_artifact_id") REFERENCES "export_artifacts"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "export_access_logs" ADD CONSTRAINT "export_access_logs_company_id_actor_user_id_fkey" FOREIGN KEY ("company_id", "actor_user_id") REFERENCES "users"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_projection_metadata" ADD CONSTRAINT "search_projection_metadata_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
