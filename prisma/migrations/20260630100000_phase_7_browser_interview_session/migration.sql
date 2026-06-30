-- AlterEnum
ALTER TYPE "interview_session_status" ADD VALUE IF NOT EXISTS 'READY';
ALTER TYPE "interview_session_status" ADD VALUE IF NOT EXISTS 'INTERRUPTED';
ALTER TYPE "interview_session_status" ADD VALUE IF NOT EXISTS 'UPLOAD_RECOVERY';
ALTER TYPE "interview_session_status" ADD VALUE IF NOT EXISTS 'PROCESSING';
ALTER TYPE "interview_session_status" ADD VALUE IF NOT EXISTS 'WITHDRAWN';

-- CreateEnum
CREATE TYPE "interview_question_kind" AS ENUM ('OPENING', 'MAIN', 'CLOSING', 'FOLLOW_UP');

-- CreateEnum
CREATE TYPE "interview_question_state_status" AS ENUM ('PENDING', 'ACTIVE', 'ANSWERED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "interview_turn_speaker" AS ENUM ('INTERVIEWER', 'CANDIDATE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "interview_turn_status" AS ENUM ('STARTED', 'COMPLETED', 'RETRY_REQUESTED', 'SUPERSEDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "interview_turn_media_status" AS ENUM ('PENDING', 'UPLOADED', 'VERIFIED', 'FAILED');

-- CreateEnum
CREATE TYPE "interview_activity_type" AS ENUM ('HEARTBEAT', 'CONNECTION_LOST', 'CONNECTION_RESTORED', 'INTERRUPTED', 'RESUMED', 'UPLOAD_RECOVERY_STARTED');

-- CreateEnum
CREATE TYPE "interview_recovery_type" AS ENUM ('SESSION', 'INTERRUPTION', 'UPLOAD');

-- CreateEnum
CREATE TYPE "interview_recovery_status" AS ENUM ('OPEN', 'RESOLVED', 'EXPIRED');

-- AlterTable
ALTER TABLE "interview_sessions"
ADD COLUMN "interrupted_at" TIMESTAMP(3),
ADD COLUMN "last_activity_at" TIMESTAMP(3),
ADD COLUMN "duration_seconds" INTEGER,
ADD COLUMN "current_question_sequence" INTEGER,
ADD COLUMN "resume_allowed_until" TIMESTAMP(3),
ADD COLUMN "processing_workflow_id" TEXT,
ADD COLUMN "plan_snapshot_json" JSONB;

-- CreateTable
CREATE TABLE "interview_question_states" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "interview_session_id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "question_key" TEXT NOT NULL,
    "kind" "interview_question_kind" NOT NULL,
    "prompt" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "status" "interview_question_state_status" NOT NULL DEFAULT 'PENDING',
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "metadata_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interview_question_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_turns" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "interview_session_id" TEXT NOT NULL,
    "question_state_id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "attempt_number" INTEGER NOT NULL DEFAULT 1,
    "speaker" "interview_turn_speaker" NOT NULL,
    "status" "interview_turn_status" NOT NULL DEFAULT 'STARTED',
    "content" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "confirmed_at" TIMESTAMP(3),
    "metadata_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interview_turns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_turn_media" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "interview_session_id" TEXT NOT NULL,
    "interview_turn_id" TEXT NOT NULL,
    "media_object_id" TEXT NOT NULL,
    "chunk_sequence" INTEGER NOT NULL,
    "duration_ms" INTEGER,
    "status" "interview_turn_media_status" NOT NULL DEFAULT 'PENDING',
    "metadata_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interview_turn_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_activity_events" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "interview_session_id" TEXT NOT NULL,
    "candidate_session_id" TEXT,
    "type" "interview_activity_type" NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interview_activity_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_recovery_checkpoints" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "interview_session_id" TEXT NOT NULL,
    "candidate_session_id" TEXT,
    "type" "interview_recovery_type" NOT NULL,
    "status" "interview_recovery_status" NOT NULL DEFAULT 'OPEN',
    "checkpoint_json" JSONB NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interview_recovery_checkpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_state_history" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "interview_session_id" TEXT NOT NULL,
    "from_status" "interview_session_status",
    "to_status" "interview_session_status" NOT NULL,
    "reason" TEXT,
    "metadata_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interview_state_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "interview_question_states_company_id_id_key" ON "interview_question_states"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "interview_question_states_company_id_interview_session_id_sequence_key" ON "interview_question_states"("company_id", "interview_session_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "interview_question_states_company_id_interview_session_id_question_key_key" ON "interview_question_states"("company_id", "interview_session_id", "question_key");

-- CreateIndex
CREATE INDEX "interview_question_states_company_id_interview_session_id_status_idx" ON "interview_question_states"("company_id", "interview_session_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "interview_turns_company_id_id_key" ON "interview_turns"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "interview_turns_company_id_idempotency_key_key" ON "interview_turns"("company_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "interview_turns_company_id_interview_session_id_sequence_attempt_number_key" ON "interview_turns"("company_id", "interview_session_id", "sequence", "attempt_number");

-- CreateIndex
CREATE INDEX "interview_turns_company_id_interview_session_id_status_idx" ON "interview_turns"("company_id", "interview_session_id", "status");

-- CreateIndex
CREATE INDEX "interview_turns_company_id_question_state_id_idx" ON "interview_turns"("company_id", "question_state_id");

-- CreateIndex
CREATE UNIQUE INDEX "interview_turn_media_company_id_id_key" ON "interview_turn_media"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "interview_turn_media_company_id_interview_turn_id_chunk_sequence_key" ON "interview_turn_media"("company_id", "interview_turn_id", "chunk_sequence");

-- CreateIndex
CREATE UNIQUE INDEX "interview_turn_media_company_id_interview_turn_id_media_object_id_key" ON "interview_turn_media"("company_id", "interview_turn_id", "media_object_id");

-- CreateIndex
CREATE INDEX "interview_turn_media_company_id_interview_session_id_status_idx" ON "interview_turn_media"("company_id", "interview_session_id", "status");

-- CreateIndex
CREATE INDEX "interview_turn_media_company_id_media_object_id_idx" ON "interview_turn_media"("company_id", "media_object_id");

-- CreateIndex
CREATE UNIQUE INDEX "interview_activity_events_company_id_id_key" ON "interview_activity_events"("company_id", "id");

-- CreateIndex
CREATE INDEX "interview_activity_events_company_id_interview_session_id_occurred_at_idx" ON "interview_activity_events"("company_id", "interview_session_id", "occurred_at");

-- CreateIndex
CREATE INDEX "interview_activity_events_company_id_type_occurred_at_idx" ON "interview_activity_events"("company_id", "type", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "interview_recovery_checkpoints_company_id_id_key" ON "interview_recovery_checkpoints"("company_id", "id");

-- CreateIndex
CREATE INDEX "interview_recovery_checkpoints_company_id_interview_session_id_status_idx" ON "interview_recovery_checkpoints"("company_id", "interview_session_id", "status");

-- CreateIndex
CREATE INDEX "interview_recovery_checkpoints_company_id_status_expires_at_idx" ON "interview_recovery_checkpoints"("company_id", "status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "interview_state_history_company_id_id_key" ON "interview_state_history"("company_id", "id");

-- CreateIndex
CREATE INDEX "interview_state_history_company_id_interview_session_id_created_at_idx" ON "interview_state_history"("company_id", "interview_session_id", "created_at");

-- CreateIndex
CREATE INDEX "interview_state_history_company_id_to_status_created_at_idx" ON "interview_state_history"("company_id", "to_status", "created_at");

-- CreateIndex
CREATE INDEX "interview_sessions_company_id_processing_workflow_id_idx" ON "interview_sessions"("company_id", "processing_workflow_id");

-- AddForeignKey
ALTER TABLE "interview_question_states" ADD CONSTRAINT "interview_question_states_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_question_states" ADD CONSTRAINT "interview_question_states_company_id_interview_session_id_fkey" FOREIGN KEY ("company_id", "interview_session_id") REFERENCES "interview_sessions"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_turns" ADD CONSTRAINT "interview_turns_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_turns" ADD CONSTRAINT "interview_turns_company_id_interview_session_id_fkey" FOREIGN KEY ("company_id", "interview_session_id") REFERENCES "interview_sessions"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_turns" ADD CONSTRAINT "interview_turns_company_id_question_state_id_fkey" FOREIGN KEY ("company_id", "question_state_id") REFERENCES "interview_question_states"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_turn_media" ADD CONSTRAINT "interview_turn_media_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_turn_media" ADD CONSTRAINT "interview_turn_media_company_id_interview_session_id_fkey" FOREIGN KEY ("company_id", "interview_session_id") REFERENCES "interview_sessions"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_turn_media" ADD CONSTRAINT "interview_turn_media_company_id_interview_turn_id_fkey" FOREIGN KEY ("company_id", "interview_turn_id") REFERENCES "interview_turns"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_turn_media" ADD CONSTRAINT "interview_turn_media_company_id_media_object_id_fkey" FOREIGN KEY ("company_id", "media_object_id") REFERENCES "media_objects"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_activity_events" ADD CONSTRAINT "interview_activity_events_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_activity_events" ADD CONSTRAINT "interview_activity_events_company_id_interview_session_id_fkey" FOREIGN KEY ("company_id", "interview_session_id") REFERENCES "interview_sessions"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_activity_events" ADD CONSTRAINT "interview_activity_events_company_id_candidate_session_id_fkey" FOREIGN KEY ("company_id", "candidate_session_id") REFERENCES "candidate_sessions"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_recovery_checkpoints" ADD CONSTRAINT "interview_recovery_checkpoints_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_recovery_checkpoints" ADD CONSTRAINT "interview_recovery_checkpoints_company_id_interview_session_id_fkey" FOREIGN KEY ("company_id", "interview_session_id") REFERENCES "interview_sessions"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_recovery_checkpoints" ADD CONSTRAINT "interview_recovery_checkpoints_company_id_candidate_session_id_fkey" FOREIGN KEY ("company_id", "candidate_session_id") REFERENCES "candidate_sessions"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_state_history" ADD CONSTRAINT "interview_state_history_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_state_history" ADD CONSTRAINT "interview_state_history_company_id_interview_session_id_fkey" FOREIGN KEY ("company_id", "interview_session_id") REFERENCES "interview_sessions"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
