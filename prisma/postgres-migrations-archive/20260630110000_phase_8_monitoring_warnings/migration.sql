-- CreateEnum
CREATE TYPE "monitoring_event_type" AS ENUM (
    'LOOKING_AWAY',
    'MULTIPLE_FACES',
    'FACE_NOT_DETECTED',
    'LEFT_FRAME',
    'CAMERA_OBSTRUCTED',
    'CAMERA_PERMISSION_REMOVED',
    'MICROPHONE_UNAVAILABLE',
    'WINDOW_FOCUS_LOST',
    'TAB_HIDDEN',
    'FULLSCREEN_EXITED',
    'COPY_OCCURRED',
    'PASTE_OCCURRED',
    'NETWORK_DEGRADED',
    'CONNECTION_LOST',
    'RECORDING_INTERRUPTED',
    'REPEATED_RESUME',
    'EXTENDED_INACTIVITY',
    'MONITORING_UNAVAILABLE'
);

-- CreateEnum
CREATE TYPE "monitoring_severity" AS ENUM ('INFORMATIONAL', 'LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "monitoring_review_state" AS ENUM ('UNREVIEWED', 'ACKNOWLEDGED', 'DISMISSED', 'NOTED');

-- CreateEnum
CREATE TYPE "monitoring_detector_category" AS ENUM (
    'CAMERA_PRESENCE',
    'MULTIPLE_FACE',
    'FACE_POSITION',
    'CAMERA_OBSTRUCTION',
    'PAGE_VISIBILITY',
    'WINDOW_FOCUS',
    'NETWORK_QUALITY',
    'RECORDING_HEALTH',
    'ACTIVITY'
);

-- CreateEnum
CREATE TYPE "monitoring_batch_status" AS ENUM ('ACCEPTED', 'PARTIALLY_ACCEPTED', 'REJECTED', 'DUPLICATE');

-- CreateTable
CREATE TABLE "monitoring_configurations" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "threshold_version" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "detector_flags_json" JSONB NOT NULL,
    "thresholds_json" JSONB NOT NULL,
    "effective_at" TIMESTAMP(3) NOT NULL,
    "retired_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monitoring_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monitoring_event_batches" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "interview_session_id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "candidate_session_id" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "status" "monitoring_batch_status" NOT NULL DEFAULT 'ACCEPTED',
    "accepted_count" INTEGER NOT NULL DEFAULT 0,
    "rejected_count" INTEGER NOT NULL DEFAULT 0,
    "deduplicated_count" INTEGER NOT NULL DEFAULT 0,
    "payload_hash" TEXT NOT NULL,
    "metadata_json" JSONB NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monitoring_event_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monitoring_events" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "interview_session_id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "batch_id" TEXT,
    "type" "monitoring_event_type" NOT NULL,
    "severity" "monitoring_severity" NOT NULL,
    "review_state" "monitoring_review_state" NOT NULL DEFAULT 'UNREVIEWED',
    "source_detector" TEXT NOT NULL,
    "detector_category" "monitoring_detector_category" NOT NULL,
    "detector_version" TEXT NOT NULL,
    "threshold_version" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "occurrence_count" INTEGER NOT NULL DEFAULT 1,
    "confidence" DOUBLE PRECISION,
    "safe_metadata_json" JSONB NOT NULL,
    "aggregation_key" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "retention_delete_at" TIMESTAMP(3) NOT NULL,
    "legal_hold_id" TEXT,
    "legal_hold_active" BOOLEAN NOT NULL DEFAULT false,
    "reviewed_by_user_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monitoring_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "monitoring_configurations_company_id_id_key" ON "monitoring_configurations"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "monitoring_configurations_company_id_version_key" ON "monitoring_configurations"("company_id", "version");

-- CreateIndex
CREATE INDEX "monitoring_configurations_company_id_enabled_effective_at_idx" ON "monitoring_configurations"("company_id", "enabled", "effective_at");

-- CreateIndex
CREATE UNIQUE INDEX "monitoring_event_batches_company_id_id_key" ON "monitoring_event_batches"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "monitoring_event_batches_company_id_idempotency_key_key" ON "monitoring_event_batches"("company_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "monitoring_event_batches_company_id_interview_session_id_received_at_idx" ON "monitoring_event_batches"("company_id", "interview_session_id", "received_at");

-- CreateIndex
CREATE INDEX "monitoring_event_batches_company_id_status_received_at_idx" ON "monitoring_event_batches"("company_id", "status", "received_at");

-- CreateIndex
CREATE UNIQUE INDEX "monitoring_events_company_id_id_key" ON "monitoring_events"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "monitoring_events_company_id_idempotency_key_key" ON "monitoring_events"("company_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "monitoring_events_company_id_interview_session_id_aggregation_key_key" ON "monitoring_events"("company_id", "interview_session_id", "aggregation_key");

-- CreateIndex
CREATE INDEX "monitoring_events_company_id_interview_session_id_occurred_at_idx" ON "monitoring_events"("company_id", "interview_session_id", "occurred_at");

-- CreateIndex
CREATE INDEX "monitoring_events_company_id_type_occurred_at_idx" ON "monitoring_events"("company_id", "type", "occurred_at");

-- CreateIndex
CREATE INDEX "monitoring_events_company_id_severity_occurred_at_idx" ON "monitoring_events"("company_id", "severity", "occurred_at");

-- CreateIndex
CREATE INDEX "monitoring_events_company_id_review_state_occurred_at_idx" ON "monitoring_events"("company_id", "review_state", "occurred_at");

-- CreateIndex
CREATE INDEX "monitoring_events_company_id_retention_delete_at_idx" ON "monitoring_events"("company_id", "retention_delete_at");

-- AddForeignKey
ALTER TABLE "monitoring_configurations" ADD CONSTRAINT "monitoring_configurations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitoring_event_batches" ADD CONSTRAINT "monitoring_event_batches_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitoring_event_batches" ADD CONSTRAINT "monitoring_event_batches_company_id_interview_session_id_fkey" FOREIGN KEY ("company_id", "interview_session_id") REFERENCES "interview_sessions"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitoring_event_batches" ADD CONSTRAINT "monitoring_event_batches_company_id_candidate_id_fkey" FOREIGN KEY ("company_id", "candidate_id") REFERENCES "candidates"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitoring_events" ADD CONSTRAINT "monitoring_events_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitoring_events" ADD CONSTRAINT "monitoring_events_company_id_interview_session_id_fkey" FOREIGN KEY ("company_id", "interview_session_id") REFERENCES "interview_sessions"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitoring_events" ADD CONSTRAINT "monitoring_events_company_id_candidate_id_fkey" FOREIGN KEY ("company_id", "candidate_id") REFERENCES "candidates"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitoring_events" ADD CONSTRAINT "monitoring_events_company_id_batch_id_fkey" FOREIGN KEY ("company_id", "batch_id") REFERENCES "monitoring_event_batches"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitoring_events" ADD CONSTRAINT "monitoring_events_company_id_legal_hold_id_fkey" FOREIGN KEY ("company_id", "legal_hold_id") REFERENCES "legal_holds"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
