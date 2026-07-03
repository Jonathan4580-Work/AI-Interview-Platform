-- CreateEnum
CREATE TYPE "workflow_status" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'PARTIALLY_COMPLETED');

-- CreateEnum
CREATE TYPE "workflow_step_status" AS ENUM ('PENDING', 'QUEUED', 'RUNNING', 'SUCCEEDED', 'RETRY_SCHEDULED', 'FAILED', 'CANCELLED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "workflow_failure_kind" AS ENUM ('RETRYABLE', 'TERMINAL');

-- CreateEnum
CREATE TYPE "workflow_dead_letter_status" AS ENUM ('OPEN', 'REPLAYED', 'CANCELLED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "media_owner_type" AS ENUM ('CANDIDATE', 'CANDIDATE_SESSION', 'INVITATION', 'INTERVIEW_SESSION', 'IDENTITY_VERIFICATION', 'EXPORT');

-- CreateEnum
CREATE TYPE "media_purpose" AS ENUM ('IDENTITY_SNAPSHOT', 'INTERVIEW_RECORDING', 'REPORT_EXPORT', 'GENERAL_ATTACHMENT');

-- CreateEnum
CREATE TYPE "media_upload_status" AS ENUM ('PENDING', 'AUTHORIZED', 'UPLOADING', 'COMPLETED', 'ABORTED', 'EXPIRED', 'FAILED');

-- CreateEnum
CREATE TYPE "media_processing_status" AS ENUM ('PENDING', 'READY', 'PROCESSING', 'FAILED', 'QUARANTINED', 'DELETED');

-- CreateEnum
CREATE TYPE "media_retention_class" AS ENUM ('IDENTITY_VERIFICATION', 'RECORDING', 'EXPORT', 'OPERATIONAL');

-- CreateEnum
CREATE TYPE "media_upload_kind" AS ENUM ('SINGLE_PART', 'MULTIPART');

-- CreateTable
CREATE TABLE "processing_workflows" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "workflow_type" TEXT NOT NULL,
    "subject_type" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "status" "workflow_status" NOT NULL DEFAULT 'PENDING',
    "idempotency_key" TEXT NOT NULL,
    "current_step_key" TEXT,
    "request_id" TEXT,
    "correlation_id" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "failure_kind" "workflow_failure_kind",
    "failure_code" TEXT,
    "failure_message" TEXT,
    "checkpoint_json" JSONB NOT NULL,
    "metadata_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "processing_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processing_workflow_steps" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "step_key" TEXT NOT NULL,
    "queue_name" TEXT NOT NULL,
    "status" "workflow_step_status" NOT NULL DEFAULT 'PENDING',
    "sequence" INTEGER NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "dependency_step_keys" TEXT[],
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "next_run_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "failure_kind" "workflow_failure_kind",
    "failure_code" TEXT,
    "failure_message" TEXT,
    "checkpoint_json" JSONB NOT NULL,
    "metadata_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "processing_workflow_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_step_attempts" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "step_id" TEXT NOT NULL,
    "attempt_number" INTEGER NOT NULL,
    "status" "workflow_step_status" NOT NULL,
    "failure_kind" "workflow_failure_kind",
    "error_code" TEXT,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "checkpoint_json" JSONB NOT NULL,
    "metadata_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_step_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_dead_letter_jobs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "queue_name" TEXT NOT NULL,
    "job_name" TEXT NOT NULL,
    "bull_job_id" TEXT,
    "workflow_id" TEXT,
    "step_id" TEXT,
    "status" "workflow_dead_letter_status" NOT NULL DEFAULT 'OPEN',
    "failure_kind" "workflow_failure_kind" NOT NULL,
    "error_code" TEXT,
    "error_message" TEXT,
    "payload_summary_json" JSONB NOT NULL,
    "request_id" TEXT,
    "correlation_id" TEXT,
    "replayed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_dead_letter_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_objects" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "owner_type" "media_owner_type" NOT NULL,
    "owner_id" TEXT NOT NULL,
    "subject_type" "media_owner_type" NOT NULL,
    "subject_id" TEXT NOT NULL,
    "purpose" "media_purpose" NOT NULL,
    "storage_provider" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "region" TEXT,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" BIGINT,
    "expected_size_bytes" BIGINT,
    "checksum_sha256" TEXT,
    "expected_checksum_sha256" TEXT,
    "upload_status" "media_upload_status" NOT NULL DEFAULT 'PENDING',
    "processing_status" "media_processing_status" NOT NULL DEFAULT 'PENDING',
    "retention_class" "media_retention_class" NOT NULL,
    "encryption_ref" TEXT,
    "retention_delete_at" TIMESTAMP(3) NOT NULL,
    "legal_hold_id" TEXT,
    "legal_hold_active" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "deletion_requested_at" TIMESTAMP(3),
    "provider_metadata_json" JSONB NOT NULL,
    "metadata_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_objects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_upload_sessions" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "media_object_id" TEXT NOT NULL,
    "kind" "media_upload_kind" NOT NULL,
    "status" "media_upload_status" NOT NULL DEFAULT 'AUTHORIZED',
    "provider_upload_id" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "part_size_bytes" INTEGER,
    "expected_part_count" INTEGER,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "aborted_at" TIMESTAMP(3),
    "request_id" TEXT,
    "correlation_id" TEXT,
    "provider_metadata_json" JSONB NOT NULL,
    "metadata_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_upload_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_upload_parts" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "upload_session_id" TEXT NOT NULL,
    "media_object_id" TEXT NOT NULL,
    "part_number" INTEGER NOT NULL,
    "etag" TEXT,
    "checksum_sha256" TEXT,
    "size_bytes" BIGINT,
    "uploaded_at" TIMESTAMP(3),
    "metadata_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_upload_parts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "processing_workflows_company_id_status_created_at_idx" ON "processing_workflows"("company_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "processing_workflows_company_id_subject_type_subject_id_idx" ON "processing_workflows"("company_id", "subject_type", "subject_id");

-- CreateIndex
CREATE INDEX "processing_workflows_company_id_workflow_type_status_idx" ON "processing_workflows"("company_id", "workflow_type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "processing_workflows_company_id_id_key" ON "processing_workflows"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "processing_workflows_company_id_idempotency_key_key" ON "processing_workflows"("company_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "processing_workflow_steps_company_id_workflow_id_sequence_idx" ON "processing_workflow_steps"("company_id", "workflow_id", "sequence");

-- CreateIndex
CREATE INDEX "processing_workflow_steps_company_id_status_next_run_at_idx" ON "processing_workflow_steps"("company_id", "status", "next_run_at");

-- CreateIndex
CREATE INDEX "processing_workflow_steps_company_id_queue_name_status_idx" ON "processing_workflow_steps"("company_id", "queue_name", "status");

-- CreateIndex
CREATE UNIQUE INDEX "processing_workflow_steps_company_id_id_key" ON "processing_workflow_steps"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "processing_workflow_steps_company_id_idempotency_key_key" ON "processing_workflow_steps"("company_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "processing_workflow_steps_company_id_workflow_id_step_key_key" ON "processing_workflow_steps"("company_id", "workflow_id", "step_key");

-- CreateIndex
CREATE INDEX "workflow_step_attempts_company_id_workflow_id_created_at_idx" ON "workflow_step_attempts"("company_id", "workflow_id", "created_at");

-- CreateIndex
CREATE INDEX "workflow_step_attempts_company_id_status_created_at_idx" ON "workflow_step_attempts"("company_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_step_attempts_company_id_id_key" ON "workflow_step_attempts"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_step_attempts_company_id_step_id_attempt_number_key" ON "workflow_step_attempts"("company_id", "step_id", "attempt_number");

-- CreateIndex
CREATE INDEX "workflow_dead_letter_jobs_company_id_status_created_at_idx" ON "workflow_dead_letter_jobs"("company_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "workflow_dead_letter_jobs_company_id_queue_name_status_idx" ON "workflow_dead_letter_jobs"("company_id", "queue_name", "status");

-- CreateIndex
CREATE INDEX "workflow_dead_letter_jobs_company_id_workflow_id_idx" ON "workflow_dead_letter_jobs"("company_id", "workflow_id");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_dead_letter_jobs_company_id_id_key" ON "workflow_dead_letter_jobs"("company_id", "id");

-- CreateIndex
CREATE INDEX "media_objects_company_id_owner_type_owner_id_idx" ON "media_objects"("company_id", "owner_type", "owner_id");

-- CreateIndex
CREATE INDEX "media_objects_company_id_subject_type_subject_id_idx" ON "media_objects"("company_id", "subject_type", "subject_id");

-- CreateIndex
CREATE INDEX "media_objects_company_id_purpose_upload_status_idx" ON "media_objects"("company_id", "purpose", "upload_status");

-- CreateIndex
CREATE INDEX "media_objects_company_id_processing_status_created_at_idx" ON "media_objects"("company_id", "processing_status", "created_at");

-- CreateIndex
CREATE INDEX "media_objects_company_id_retention_delete_at_idx" ON "media_objects"("company_id", "retention_delete_at");

-- CreateIndex
CREATE UNIQUE INDEX "media_objects_company_id_id_key" ON "media_objects"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "media_objects_company_id_storage_key_key" ON "media_objects"("company_id", "storage_key");

-- CreateIndex
CREATE INDEX "media_upload_sessions_company_id_media_object_id_status_idx" ON "media_upload_sessions"("company_id", "media_object_id", "status");

-- CreateIndex
CREATE INDEX "media_upload_sessions_company_id_status_expires_at_idx" ON "media_upload_sessions"("company_id", "status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "media_upload_sessions_company_id_id_key" ON "media_upload_sessions"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "media_upload_sessions_company_id_idempotency_key_key" ON "media_upload_sessions"("company_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "media_upload_parts_company_id_media_object_id_idx" ON "media_upload_parts"("company_id", "media_object_id");

-- CreateIndex
CREATE UNIQUE INDEX "media_upload_parts_company_id_id_key" ON "media_upload_parts"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "media_upload_parts_company_id_upload_session_id_part_number_key" ON "media_upload_parts"("company_id", "upload_session_id", "part_number");

-- AddForeignKey
ALTER TABLE "processing_workflows" ADD CONSTRAINT "processing_workflows_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_workflow_steps" ADD CONSTRAINT "processing_workflow_steps_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_workflow_steps" ADD CONSTRAINT "processing_workflow_steps_company_id_workflow_id_fkey" FOREIGN KEY ("company_id", "workflow_id") REFERENCES "processing_workflows"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_step_attempts" ADD CONSTRAINT "workflow_step_attempts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_step_attempts" ADD CONSTRAINT "workflow_step_attempts_company_id_step_id_fkey" FOREIGN KEY ("company_id", "step_id") REFERENCES "processing_workflow_steps"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_dead_letter_jobs" ADD CONSTRAINT "workflow_dead_letter_jobs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_dead_letter_jobs" ADD CONSTRAINT "workflow_dead_letter_jobs_company_id_step_id_fkey" FOREIGN KEY ("company_id", "step_id") REFERENCES "processing_workflow_steps"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_objects" ADD CONSTRAINT "media_objects_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_upload_sessions" ADD CONSTRAINT "media_upload_sessions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_upload_sessions" ADD CONSTRAINT "media_upload_sessions_company_id_media_object_id_fkey" FOREIGN KEY ("company_id", "media_object_id") REFERENCES "media_objects"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_upload_parts" ADD CONSTRAINT "media_upload_parts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_upload_parts" ADD CONSTRAINT "media_upload_parts_company_id_upload_session_id_fkey" FOREIGN KEY ("company_id", "upload_session_id") REFERENCES "media_upload_sessions"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

