-- CreateEnum
CREATE TYPE "transcript_status" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "transcript_speaker" AS ENUM ('INTERVIEWER', 'CANDIDATE', 'SYSTEM', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ai_artifact_status" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "evaluation_provider_key" AS ENUM ('DEVELOPMENT', 'DEEPSEEK');

-- CreateEnum
CREATE TYPE "evaluation_status" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "evaluation_review_status" AS ENUM ('UNREVIEWED', 'REVIEWED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "confidence_level" AS ENUM ('HIGH', 'MODERATE', 'LIMITED', 'INSUFFICIENT_EVIDENCE');

-- CreateEnum
CREATE TYPE "hr_report_status" AS ENUM ('PENDING', 'READY', 'FAILED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "evaluation_override_target" AS ENUM ('OVERALL', 'COMPETENCY');

-- CreateEnum
CREATE TYPE "human_decision_value" AS ENUM ('ADVANCE', 'HOLD', 'REJECT', 'UNDECIDED');

-- AlterEnum
ALTER TYPE "notification_intent_type" ADD VALUE 'RESULTS_READY';

-- CreateTable
CREATE TABLE "transcripts" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "interview_session_id" TEXT NOT NULL,
    "status" "transcript_status" NOT NULL DEFAULT 'PENDING',
    "active_version_id" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "provider" TEXT NOT NULL,
    "provider_model" TEXT,
    "provider_version" TEXT,
    "transcript_quality" "confidence_level" NOT NULL DEFAULT 'MODERATE',
    "retention_delete_at" TIMESTAMP(3) NOT NULL,
    "legal_hold_id" TEXT,
    "legal_hold_active" BOOLEAN NOT NULL DEFAULT false,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by_user_id" TEXT,
    "review_reason" TEXT,
    "failure_code" TEXT,
    "failure_message" TEXT,
    "metadata_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transcripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transcript_versions" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "transcript_id" TEXT NOT NULL,
    "interview_session_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "status" "transcript_status" NOT NULL DEFAULT 'PROCESSING',
    "source" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "provider" TEXT NOT NULL,
    "provider_model" TEXT,
    "provider_version" TEXT,
    "provider_reference" TEXT,
    "confidence" DOUBLE PRECISION,
    "transcript_quality" "confidence_level" NOT NULL DEFAULT 'MODERATE',
    "correction_of_version_id" TEXT,
    "correction_reason" TEXT,
    "corrected_by_user_id" TEXT,
    "superseded_by_version_id" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "failure_code" TEXT,
    "failure_message" TEXT,
    "metadata_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transcript_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transcript_segments" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "transcript_id" TEXT NOT NULL,
    "transcript_version_id" TEXT NOT NULL,
    "interview_session_id" TEXT NOT NULL,
    "interview_turn_id" TEXT,
    "sequence" INTEGER NOT NULL,
    "speaker" "transcript_speaker" NOT NULL,
    "start_ms" INTEGER,
    "end_ms" INTEGER,
    "text" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "language" TEXT NOT NULL DEFAULT 'en',
    "provider_metadata_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transcript_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_prompt_templates" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ai_artifact_status" NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "ai_prompt_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_prompt_versions" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "prompt_template_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "status" "ai_artifact_status" NOT NULL DEFAULT 'DRAFT',
    "prompt_hash" TEXT NOT NULL,
    "system_prompt" TEXT NOT NULL,
    "user_prompt_template" TEXT NOT NULL,
    "evaluation_schema_json" JSONB NOT NULL,
    "redaction_policy_version" TEXT NOT NULL,
    "published_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_prompt_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_rubric_templates" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ai_artifact_status" NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "ai_rubric_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_rubric_versions" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "rubric_template_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "status" "ai_artifact_status" NOT NULL DEFAULT 'DRAFT',
    "rubric_hash" TEXT NOT NULL,
    "score_min" INTEGER NOT NULL DEFAULT 1,
    "score_max" INTEGER NOT NULL DEFAULT 5,
    "competency_schema_json" JSONB NOT NULL,
    "published_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_rubric_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_runs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "interview_session_id" TEXT NOT NULL,
    "transcript_id" TEXT NOT NULL,
    "transcript_version_id" TEXT NOT NULL,
    "prompt_version_id" TEXT NOT NULL,
    "rubric_version_id" TEXT NOT NULL,
    "provider" "evaluation_provider_key" NOT NULL,
    "provider_model" TEXT NOT NULL,
    "provider_model_version" TEXT,
    "status" "evaluation_status" NOT NULL DEFAULT 'PENDING',
    "redaction_policy_version" TEXT NOT NULL,
    "output_normalization_version" TEXT NOT NULL,
    "request_started_at" TIMESTAMP(3),
    "response_received_at" TIMESTAMP(3),
    "latency_ms" INTEGER,
    "usage_json" JSONB NOT NULL,
    "estimated_cost_cents" INTEGER,
    "failure_kind" "workflow_failure_kind",
    "failure_code" TEXT,
    "failure_message" TEXT,
    "metadata_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evaluation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_versions" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "evaluation_run_id" TEXT NOT NULL,
    "interview_session_id" TEXT NOT NULL,
    "transcript_id" TEXT NOT NULL,
    "transcript_version_id" TEXT NOT NULL,
    "prompt_version_id" TEXT NOT NULL,
    "rubric_version_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "status" "evaluation_status" NOT NULL DEFAULT 'PROCESSING',
    "review_status" "evaluation_review_status" NOT NULL DEFAULT 'UNREVIEWED',
    "overall_score" DOUBLE PRECISION,
    "score_min" INTEGER NOT NULL,
    "score_max" INTEGER NOT NULL,
    "overall_confidence" "confidence_level" NOT NULL DEFAULT 'MODERATE',
    "transcript_confidence" "confidence_level" NOT NULL DEFAULT 'MODERATE',
    "summary" TEXT NOT NULL,
    "recommendation" TEXT,
    "decision_support_disclaimer" TEXT NOT NULL,
    "superseded_by_version_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by_user_id" TEXT,
    "review_reason" TEXT,
    "completed_at" TIMESTAMP(3),
    "failure_code" TEXT,
    "failure_message" TEXT,
    "metadata_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evaluation_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_competency_scores" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "evaluation_version_id" TEXT NOT NULL,
    "interview_session_id" TEXT NOT NULL,
    "competency_key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "max_score" INTEGER NOT NULL,
    "confidence" "confidence_level" NOT NULL,
    "rationale" TEXT NOT NULL,
    "incomplete" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluation_competency_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_evidence_citations" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "evaluation_version_id" TEXT NOT NULL,
    "competency_score_id" TEXT,
    "interview_session_id" TEXT NOT NULL,
    "transcript_segment_id" TEXT,
    "interview_turn_id" TEXT,
    "competency_key" TEXT NOT NULL,
    "claim" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "start_ms" INTEGER,
    "end_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluation_evidence_citations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_observations" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "evaluation_version_id" TEXT NOT NULL,
    "interview_session_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "confidence" "confidence_level" NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "disputed_at" TIMESTAMP(3),
    "reviewed_by_user_id" TEXT,
    "review_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evaluation_observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_limitations" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "evaluation_version_id" TEXT NOT NULL,
    "interview_session_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "confidence_impact" "confidence_level" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluation_limitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_provider_payloads" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "evaluation_run_id" TEXT NOT NULL,
    "provider" "evaluation_provider_key" NOT NULL,
    "request_hash" TEXT NOT NULL,
    "response_hash" TEXT,
    "payload_ref" TEXT,
    "metadata_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluation_provider_payloads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_reports" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "interview_session_id" TEXT NOT NULL,
    "transcript_id" TEXT NOT NULL,
    "evaluation_version_id" TEXT NOT NULL,
    "active_version_id" TEXT,
    "status" "hr_report_status" NOT NULL DEFAULT 'PENDING',
    "retention_delete_at" TIMESTAMP(3) NOT NULL,
    "legal_hold_id" TEXT,
    "legal_hold_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_report_versions" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "hr_report_id" TEXT NOT NULL,
    "interview_session_id" TEXT NOT NULL,
    "evaluation_version_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "status" "hr_report_status" NOT NULL DEFAULT 'PENDING',
    "report_json" JSONB NOT NULL,
    "executive_summary" TEXT NOT NULL,
    "disclaimer" TEXT NOT NULL,
    "superseded_by_version_id" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_report_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_overrides" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "interview_session_id" TEXT NOT NULL,
    "evaluation_version_id" TEXT NOT NULL,
    "competency_score_id" TEXT,
    "target" "evaluation_override_target" NOT NULL,
    "previous_score" DOUBLE PRECISION,
    "new_score" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluation_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "human_decision_history" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "interview_session_id" TEXT NOT NULL,
    "from_decision" "human_decision_value",
    "to_decision" "human_decision_value" NOT NULL,
    "reason" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "human_decision_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "transcripts_company_id_status_created_at_idx" ON "transcripts"("company_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "transcripts_company_id_retention_delete_at_idx" ON "transcripts"("company_id", "retention_delete_at");

-- CreateIndex
CREATE UNIQUE INDEX "transcripts_company_id_id_key" ON "transcripts"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "transcripts_company_id_interview_session_id_key" ON "transcripts"("company_id", "interview_session_id");

-- CreateIndex
CREATE INDEX "transcript_versions_company_id_interview_session_id_status_idx" ON "transcript_versions"("company_id", "interview_session_id", "status");

-- CreateIndex
CREATE INDEX "transcript_versions_company_id_transcript_id_created_at_idx" ON "transcript_versions"("company_id", "transcript_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "transcript_versions_company_id_id_key" ON "transcript_versions"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "transcript_versions_company_id_transcript_id_version_number_key" ON "transcript_versions"("company_id", "transcript_id", "version_number");

-- CreateIndex
CREATE INDEX "transcript_segments_company_id_interview_session_id_sequenc_idx" ON "transcript_segments"("company_id", "interview_session_id", "sequence");

-- CreateIndex
CREATE INDEX "transcript_segments_company_id_transcript_version_id_sequen_idx" ON "transcript_segments"("company_id", "transcript_version_id", "sequence");

-- CreateIndex
CREATE INDEX "transcript_segments_company_id_interview_turn_id_idx" ON "transcript_segments"("company_id", "interview_turn_id");

-- CreateIndex
CREATE UNIQUE INDEX "transcript_segments_company_id_id_key" ON "transcript_segments"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "transcript_segments_company_id_transcript_version_id_sequen_key" ON "transcript_segments"("company_id", "transcript_version_id", "sequence");

-- CreateIndex
CREATE INDEX "ai_prompt_templates_company_id_status_idx" ON "ai_prompt_templates"("company_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ai_prompt_templates_company_id_id_key" ON "ai_prompt_templates"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_prompt_templates_company_id_key_key" ON "ai_prompt_templates"("company_id", "key");

-- CreateIndex
CREATE INDEX "ai_prompt_versions_company_id_status_idx" ON "ai_prompt_versions"("company_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ai_prompt_versions_company_id_id_key" ON "ai_prompt_versions"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_prompt_versions_prompt_template_id_version_number_key" ON "ai_prompt_versions"("prompt_template_id", "version_number");

-- CreateIndex
CREATE INDEX "ai_rubric_templates_company_id_status_idx" ON "ai_rubric_templates"("company_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ai_rubric_templates_company_id_id_key" ON "ai_rubric_templates"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_rubric_templates_company_id_key_key" ON "ai_rubric_templates"("company_id", "key");

-- CreateIndex
CREATE INDEX "ai_rubric_versions_company_id_status_idx" ON "ai_rubric_versions"("company_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ai_rubric_versions_company_id_id_key" ON "ai_rubric_versions"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_rubric_versions_rubric_template_id_version_number_key" ON "ai_rubric_versions"("rubric_template_id", "version_number");

-- CreateIndex
CREATE INDEX "evaluation_runs_company_id_interview_session_id_status_idx" ON "evaluation_runs"("company_id", "interview_session_id", "status");

-- CreateIndex
CREATE INDEX "evaluation_runs_company_id_status_created_at_idx" ON "evaluation_runs"("company_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_runs_company_id_id_key" ON "evaluation_runs"("company_id", "id");

-- CreateIndex
CREATE INDEX "evaluation_versions_company_id_interview_session_id_status_idx" ON "evaluation_versions"("company_id", "interview_session_id", "status");

-- CreateIndex
CREATE INDEX "evaluation_versions_company_id_review_status_created_at_idx" ON "evaluation_versions"("company_id", "review_status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_versions_company_id_id_key" ON "evaluation_versions"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_versions_company_id_evaluation_run_id_version_nu_key" ON "evaluation_versions"("company_id", "evaluation_run_id", "version_number");

-- CreateIndex
CREATE INDEX "evaluation_competency_scores_company_id_interview_session_i_idx" ON "evaluation_competency_scores"("company_id", "interview_session_id", "competency_key");

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_competency_scores_company_id_id_key" ON "evaluation_competency_scores"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_competency_scores_company_id_evaluation_version__key" ON "evaluation_competency_scores"("company_id", "evaluation_version_id", "competency_key");

-- CreateIndex
CREATE INDEX "evaluation_evidence_citations_company_id_evaluation_version_idx" ON "evaluation_evidence_citations"("company_id", "evaluation_version_id", "competency_key");

-- CreateIndex
CREATE INDEX "evaluation_evidence_citations_company_id_transcript_segment_idx" ON "evaluation_evidence_citations"("company_id", "transcript_segment_id");

-- CreateIndex
CREATE INDEX "evaluation_evidence_citations_company_id_interview_turn_id_idx" ON "evaluation_evidence_citations"("company_id", "interview_turn_id");

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_evidence_citations_company_id_id_key" ON "evaluation_evidence_citations"("company_id", "id");

-- CreateIndex
CREATE INDEX "evaluation_observations_company_id_evaluation_version_id_ki_idx" ON "evaluation_observations"("company_id", "evaluation_version_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_observations_company_id_id_key" ON "evaluation_observations"("company_id", "id");

-- CreateIndex
CREATE INDEX "evaluation_limitations_company_id_evaluation_version_id_idx" ON "evaluation_limitations"("company_id", "evaluation_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_limitations_company_id_id_key" ON "evaluation_limitations"("company_id", "id");

-- CreateIndex
CREATE INDEX "evaluation_provider_payloads_company_id_evaluation_run_id_idx" ON "evaluation_provider_payloads"("company_id", "evaluation_run_id");

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_provider_payloads_company_id_id_key" ON "evaluation_provider_payloads"("company_id", "id");

-- CreateIndex
CREATE INDEX "hr_reports_company_id_status_created_at_idx" ON "hr_reports"("company_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "hr_reports_company_id_retention_delete_at_idx" ON "hr_reports"("company_id", "retention_delete_at");

-- CreateIndex
CREATE UNIQUE INDEX "hr_reports_company_id_id_key" ON "hr_reports"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "hr_reports_company_id_interview_session_id_key" ON "hr_reports"("company_id", "interview_session_id");

-- CreateIndex
CREATE INDEX "hr_report_versions_company_id_interview_session_id_status_idx" ON "hr_report_versions"("company_id", "interview_session_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "hr_report_versions_company_id_id_key" ON "hr_report_versions"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "hr_report_versions_company_id_hr_report_id_version_number_key" ON "hr_report_versions"("company_id", "hr_report_id", "version_number");

-- CreateIndex
CREATE INDEX "evaluation_overrides_company_id_interview_session_id_create_idx" ON "evaluation_overrides"("company_id", "interview_session_id", "created_at");

-- CreateIndex
CREATE INDEX "evaluation_overrides_company_id_evaluation_version_id_idx" ON "evaluation_overrides"("company_id", "evaluation_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_overrides_company_id_id_key" ON "evaluation_overrides"("company_id", "id");

-- CreateIndex
CREATE INDEX "human_decision_history_company_id_interview_session_id_crea_idx" ON "human_decision_history"("company_id", "interview_session_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "human_decision_history_company_id_id_key" ON "human_decision_history"("company_id", "id");

-- RenameForeignKey
ALTER TABLE "candidate_session_continuations" RENAME CONSTRAINT "candidate_session_continuations_company_id_candidate_session_id" TO "candidate_session_continuations_company_id_candidate_sessi_fkey";

-- RenameForeignKey
ALTER TABLE "interview_recovery_checkpoints" RENAME CONSTRAINT "interview_recovery_checkpoints_company_id_candidate_session_id_" TO "interview_recovery_checkpoints_company_id_candidate_sessio_fkey";

-- RenameForeignKey
ALTER TABLE "interview_recovery_checkpoints" RENAME CONSTRAINT "interview_recovery_checkpoints_company_id_interview_session_id_" TO "interview_recovery_checkpoints_company_id_interview_sessio_fkey";

-- AddForeignKey
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_company_id_interview_session_id_fkey" FOREIGN KEY ("company_id", "interview_session_id") REFERENCES "interview_sessions"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_company_id_active_version_id_fkey" FOREIGN KEY ("company_id", "active_version_id") REFERENCES "transcript_versions"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_company_id_legal_hold_id_fkey" FOREIGN KEY ("company_id", "legal_hold_id") REFERENCES "legal_holds"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcript_versions" ADD CONSTRAINT "transcript_versions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcript_versions" ADD CONSTRAINT "transcript_versions_company_id_transcript_id_fkey" FOREIGN KEY ("company_id", "transcript_id") REFERENCES "transcripts"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcript_versions" ADD CONSTRAINT "transcript_versions_company_id_interview_session_id_fkey" FOREIGN KEY ("company_id", "interview_session_id") REFERENCES "interview_sessions"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcript_versions" ADD CONSTRAINT "transcript_versions_company_id_correction_of_version_id_fkey" FOREIGN KEY ("company_id", "correction_of_version_id") REFERENCES "transcript_versions"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcript_versions" ADD CONSTRAINT "transcript_versions_company_id_superseded_by_version_id_fkey" FOREIGN KEY ("company_id", "superseded_by_version_id") REFERENCES "transcript_versions"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcript_segments" ADD CONSTRAINT "transcript_segments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcript_segments" ADD CONSTRAINT "transcript_segments_company_id_transcript_id_fkey" FOREIGN KEY ("company_id", "transcript_id") REFERENCES "transcripts"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcript_segments" ADD CONSTRAINT "transcript_segments_company_id_transcript_version_id_fkey" FOREIGN KEY ("company_id", "transcript_version_id") REFERENCES "transcript_versions"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcript_segments" ADD CONSTRAINT "transcript_segments_company_id_interview_session_id_fkey" FOREIGN KEY ("company_id", "interview_session_id") REFERENCES "interview_sessions"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcript_segments" ADD CONSTRAINT "transcript_segments_company_id_interview_turn_id_fkey" FOREIGN KEY ("company_id", "interview_turn_id") REFERENCES "interview_turns"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_prompt_templates" ADD CONSTRAINT "ai_prompt_templates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_prompt_versions" ADD CONSTRAINT "ai_prompt_versions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_prompt_versions" ADD CONSTRAINT "ai_prompt_versions_prompt_template_id_fkey" FOREIGN KEY ("prompt_template_id") REFERENCES "ai_prompt_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_rubric_templates" ADD CONSTRAINT "ai_rubric_templates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_rubric_versions" ADD CONSTRAINT "ai_rubric_versions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_rubric_versions" ADD CONSTRAINT "ai_rubric_versions_rubric_template_id_fkey" FOREIGN KEY ("rubric_template_id") REFERENCES "ai_rubric_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_runs" ADD CONSTRAINT "evaluation_runs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_runs" ADD CONSTRAINT "evaluation_runs_company_id_interview_session_id_fkey" FOREIGN KEY ("company_id", "interview_session_id") REFERENCES "interview_sessions"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_runs" ADD CONSTRAINT "evaluation_runs_company_id_transcript_id_fkey" FOREIGN KEY ("company_id", "transcript_id") REFERENCES "transcripts"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_runs" ADD CONSTRAINT "evaluation_runs_company_id_transcript_version_id_fkey" FOREIGN KEY ("company_id", "transcript_version_id") REFERENCES "transcript_versions"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_runs" ADD CONSTRAINT "evaluation_runs_prompt_version_id_fkey" FOREIGN KEY ("prompt_version_id") REFERENCES "ai_prompt_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_runs" ADD CONSTRAINT "evaluation_runs_rubric_version_id_fkey" FOREIGN KEY ("rubric_version_id") REFERENCES "ai_rubric_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_versions" ADD CONSTRAINT "evaluation_versions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_versions" ADD CONSTRAINT "evaluation_versions_company_id_evaluation_run_id_fkey" FOREIGN KEY ("company_id", "evaluation_run_id") REFERENCES "evaluation_runs"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_versions" ADD CONSTRAINT "evaluation_versions_company_id_interview_session_id_fkey" FOREIGN KEY ("company_id", "interview_session_id") REFERENCES "interview_sessions"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_versions" ADD CONSTRAINT "evaluation_versions_company_id_transcript_id_fkey" FOREIGN KEY ("company_id", "transcript_id") REFERENCES "transcripts"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_versions" ADD CONSTRAINT "evaluation_versions_company_id_transcript_version_id_fkey" FOREIGN KEY ("company_id", "transcript_version_id") REFERENCES "transcript_versions"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_versions" ADD CONSTRAINT "evaluation_versions_prompt_version_id_fkey" FOREIGN KEY ("prompt_version_id") REFERENCES "ai_prompt_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_versions" ADD CONSTRAINT "evaluation_versions_rubric_version_id_fkey" FOREIGN KEY ("rubric_version_id") REFERENCES "ai_rubric_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_versions" ADD CONSTRAINT "evaluation_versions_company_id_superseded_by_version_id_fkey" FOREIGN KEY ("company_id", "superseded_by_version_id") REFERENCES "evaluation_versions"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_competency_scores" ADD CONSTRAINT "evaluation_competency_scores_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_competency_scores" ADD CONSTRAINT "evaluation_competency_scores_company_id_evaluation_version_fkey" FOREIGN KEY ("company_id", "evaluation_version_id") REFERENCES "evaluation_versions"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_competency_scores" ADD CONSTRAINT "evaluation_competency_scores_company_id_interview_session__fkey" FOREIGN KEY ("company_id", "interview_session_id") REFERENCES "interview_sessions"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_evidence_citations" ADD CONSTRAINT "evaluation_evidence_citations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_evidence_citations" ADD CONSTRAINT "evaluation_evidence_citations_company_id_evaluation_versio_fkey" FOREIGN KEY ("company_id", "evaluation_version_id") REFERENCES "evaluation_versions"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_evidence_citations" ADD CONSTRAINT "evaluation_evidence_citations_company_id_competency_score__fkey" FOREIGN KEY ("company_id", "competency_score_id") REFERENCES "evaluation_competency_scores"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_evidence_citations" ADD CONSTRAINT "evaluation_evidence_citations_company_id_interview_session_fkey" FOREIGN KEY ("company_id", "interview_session_id") REFERENCES "interview_sessions"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_evidence_citations" ADD CONSTRAINT "evaluation_evidence_citations_company_id_transcript_segmen_fkey" FOREIGN KEY ("company_id", "transcript_segment_id") REFERENCES "transcript_segments"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_evidence_citations" ADD CONSTRAINT "evaluation_evidence_citations_company_id_interview_turn_id_fkey" FOREIGN KEY ("company_id", "interview_turn_id") REFERENCES "interview_turns"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_observations" ADD CONSTRAINT "evaluation_observations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_observations" ADD CONSTRAINT "evaluation_observations_company_id_evaluation_version_id_fkey" FOREIGN KEY ("company_id", "evaluation_version_id") REFERENCES "evaluation_versions"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_observations" ADD CONSTRAINT "evaluation_observations_company_id_interview_session_id_fkey" FOREIGN KEY ("company_id", "interview_session_id") REFERENCES "interview_sessions"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_limitations" ADD CONSTRAINT "evaluation_limitations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_limitations" ADD CONSTRAINT "evaluation_limitations_company_id_evaluation_version_id_fkey" FOREIGN KEY ("company_id", "evaluation_version_id") REFERENCES "evaluation_versions"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_limitations" ADD CONSTRAINT "evaluation_limitations_company_id_interview_session_id_fkey" FOREIGN KEY ("company_id", "interview_session_id") REFERENCES "interview_sessions"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_provider_payloads" ADD CONSTRAINT "evaluation_provider_payloads_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_provider_payloads" ADD CONSTRAINT "evaluation_provider_payloads_company_id_evaluation_run_id_fkey" FOREIGN KEY ("company_id", "evaluation_run_id") REFERENCES "evaluation_runs"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_reports" ADD CONSTRAINT "hr_reports_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_reports" ADD CONSTRAINT "hr_reports_company_id_interview_session_id_fkey" FOREIGN KEY ("company_id", "interview_session_id") REFERENCES "interview_sessions"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_reports" ADD CONSTRAINT "hr_reports_company_id_transcript_id_fkey" FOREIGN KEY ("company_id", "transcript_id") REFERENCES "transcripts"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_reports" ADD CONSTRAINT "hr_reports_company_id_evaluation_version_id_fkey" FOREIGN KEY ("company_id", "evaluation_version_id") REFERENCES "evaluation_versions"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_reports" ADD CONSTRAINT "hr_reports_company_id_active_version_id_fkey" FOREIGN KEY ("company_id", "active_version_id") REFERENCES "hr_report_versions"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_reports" ADD CONSTRAINT "hr_reports_company_id_legal_hold_id_fkey" FOREIGN KEY ("company_id", "legal_hold_id") REFERENCES "legal_holds"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_report_versions" ADD CONSTRAINT "hr_report_versions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_report_versions" ADD CONSTRAINT "hr_report_versions_company_id_hr_report_id_fkey" FOREIGN KEY ("company_id", "hr_report_id") REFERENCES "hr_reports"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_report_versions" ADD CONSTRAINT "hr_report_versions_company_id_interview_session_id_fkey" FOREIGN KEY ("company_id", "interview_session_id") REFERENCES "interview_sessions"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_report_versions" ADD CONSTRAINT "hr_report_versions_company_id_evaluation_version_id_fkey" FOREIGN KEY ("company_id", "evaluation_version_id") REFERENCES "evaluation_versions"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_report_versions" ADD CONSTRAINT "hr_report_versions_company_id_superseded_by_version_id_fkey" FOREIGN KEY ("company_id", "superseded_by_version_id") REFERENCES "hr_report_versions"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_overrides" ADD CONSTRAINT "evaluation_overrides_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_overrides" ADD CONSTRAINT "evaluation_overrides_company_id_interview_session_id_fkey" FOREIGN KEY ("company_id", "interview_session_id") REFERENCES "interview_sessions"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_overrides" ADD CONSTRAINT "evaluation_overrides_company_id_evaluation_version_id_fkey" FOREIGN KEY ("company_id", "evaluation_version_id") REFERENCES "evaluation_versions"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_overrides" ADD CONSTRAINT "evaluation_overrides_company_id_competency_score_id_fkey" FOREIGN KEY ("company_id", "competency_score_id") REFERENCES "evaluation_competency_scores"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_overrides" ADD CONSTRAINT "evaluation_overrides_company_id_created_by_user_id_fkey" FOREIGN KEY ("company_id", "created_by_user_id") REFERENCES "users"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "human_decision_history" ADD CONSTRAINT "human_decision_history_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "human_decision_history" ADD CONSTRAINT "human_decision_history_company_id_interview_session_id_fkey" FOREIGN KEY ("company_id", "interview_session_id") REFERENCES "interview_sessions"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "human_decision_history" ADD CONSTRAINT "human_decision_history_company_id_created_by_user_id_fkey" FOREIGN KEY ("company_id", "created_by_user_id") REFERENCES "users"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "candidate_consent_records_company_id_candidate_session_id_type_" RENAME TO "candidate_consent_records_company_id_candidate_session_id_t_idx";

-- RenameIndex
ALTER INDEX "candidate_session_continuations_company_id_candidate_session_id" RENAME TO "candidate_session_continuations_company_id_candidate_sessio_idx";

-- RenameIndex
ALTER INDEX "candidate_token_attempts_company_id_invitation_id_attempted_at_" RENAME TO "candidate_token_attempts_company_id_invitation_id_attempted_idx";

-- RenameIndex
ALTER INDEX "email_delivery_attempts_company_id_delivery_id_attempt_number_k" RENAME TO "email_delivery_attempts_company_id_delivery_id_attempt_numb_key";

-- RenameIndex
ALTER INDEX "interview_activity_events_company_id_interview_session_id_occur" RENAME TO "interview_activity_events_company_id_interview_session_id_o_idx";

-- RenameIndex
ALTER INDEX "interview_plan_versions_company_id_interview_plan_id_version_nu" RENAME TO "interview_plan_versions_company_id_interview_plan_id_versio_key";

-- RenameIndex
ALTER INDEX "interview_question_states_company_id_interview_session_id_quest" RENAME TO "interview_question_states_company_id_interview_session_id_q_key";

-- RenameIndex
ALTER INDEX "interview_question_states_company_id_interview_session_id_seque" RENAME TO "interview_question_states_company_id_interview_session_id_s_key";

-- RenameIndex
ALTER INDEX "interview_question_states_company_id_interview_session_id_statu" RENAME TO "interview_question_states_company_id_interview_session_id_s_idx";

-- RenameIndex
ALTER INDEX "interview_recovery_checkpoints_company_id_interview_session_id_" RENAME TO "interview_recovery_checkpoints_company_id_interview_session_idx";

-- RenameIndex
ALTER INDEX "interview_state_history_company_id_interview_session_id_created" RENAME TO "interview_state_history_company_id_interview_session_id_cre_idx";

-- RenameIndex
ALTER INDEX "interview_turn_media_company_id_interview_turn_id_chunk_sequenc" RENAME TO "interview_turn_media_company_id_interview_turn_id_chunk_seq_key";

-- RenameIndex
ALTER INDEX "interview_turn_media_company_id_interview_turn_id_media_object_" RENAME TO "interview_turn_media_company_id_interview_turn_id_media_obj_key";

-- RenameIndex
ALTER INDEX "interview_turns_company_id_interview_session_id_sequence_attemp" RENAME TO "interview_turns_company_id_interview_session_id_sequence_at_key";

-- RenameIndex
ALTER INDEX "monitoring_event_batches_company_id_interview_session_id_receiv" RENAME TO "monitoring_event_batches_company_id_interview_session_id_re_idx";

-- RenameIndex
ALTER INDEX "monitoring_events_company_id_interview_session_id_aggregation_k" RENAME TO "monitoring_events_company_id_interview_session_id_aggregati_key";

-- RenameIndex
ALTER INDEX "monitoring_events_company_id_interview_session_id_occurred_at_i" RENAME TO "monitoring_events_company_id_interview_session_id_occurred__idx";

-- RenameIndex
ALTER INDEX "notification_intents_company_id_target_resource_type_target_res" RENAME TO "notification_intents_company_id_target_resource_type_target_idx";

-- RenameIndex
ALTER INDEX "readiness_checks_company_id_candidate_session_id_type_checked_a" RENAME TO "readiness_checks_company_id_candidate_session_id_type_check_idx";

-- RenameIndex
ALTER INDEX "schedule_events_company_id_target_resource_type_target_resource" RENAME TO "schedule_events_company_id_target_resource_type_target_reso_idx";

