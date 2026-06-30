-- Phase 3 invitation and interview-session lifecycle foundation.

CREATE TYPE "invitation_status" AS ENUM ('DRAFT', 'QUEUED', 'SENT', 'OPENED', 'ACCEPTED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "interview_session_status" AS ENUM ('NOT_STARTED', 'READY_CHECK', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'EXPIRED');

CREATE TABLE "candidate_invitations" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "application_id" TEXT,
    "job_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "invitation_status" NOT NULL DEFAULT 'DRAFT',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "sent_at" TIMESTAMP(3),
    "opened_at" TIMESTAMP(3),
    "accepted_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidate_invitations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "interview_sessions" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "invitation_id" TEXT NOT NULL,
    "application_id" TEXT,
    "interview_plan_version_id" TEXT,
    "status" "interview_session_status" NOT NULL DEFAULT 'NOT_STARTED',
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "metadata_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interview_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "candidate_invitations_token_hash_key" ON "candidate_invitations"("token_hash");
CREATE UNIQUE INDEX "candidate_invitations_company_id_id_key" ON "candidate_invitations"("company_id", "id");
CREATE INDEX "candidate_invitations_company_id_candidate_id_idx" ON "candidate_invitations"("company_id", "candidate_id");
CREATE INDEX "candidate_invitations_company_id_application_id_idx" ON "candidate_invitations"("company_id", "application_id");
CREATE INDEX "candidate_invitations_company_id_status_idx" ON "candidate_invitations"("company_id", "status");
CREATE INDEX "candidate_invitations_expires_at_idx" ON "candidate_invitations"("expires_at");

CREATE UNIQUE INDEX "interview_sessions_company_id_id_key" ON "interview_sessions"("company_id", "id");
CREATE UNIQUE INDEX "interview_sessions_company_id_invitation_id_key" ON "interview_sessions"("company_id", "invitation_id");
CREATE INDEX "interview_sessions_company_id_candidate_id_idx" ON "interview_sessions"("company_id", "candidate_id");
CREATE INDEX "interview_sessions_company_id_application_id_idx" ON "interview_sessions"("company_id", "application_id");
CREATE INDEX "interview_sessions_company_id_status_idx" ON "interview_sessions"("company_id", "status");
CREATE INDEX "interview_sessions_expires_at_idx" ON "interview_sessions"("expires_at");

ALTER TABLE "candidate_invitations" ADD CONSTRAINT "candidate_invitations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "candidate_invitations" ADD CONSTRAINT "candidate_invitations_company_id_candidate_id_fkey" FOREIGN KEY ("company_id", "candidate_id") REFERENCES "candidates"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "candidate_invitations" ADD CONSTRAINT "candidate_invitations_company_id_application_id_fkey" FOREIGN KEY ("company_id", "application_id") REFERENCES "candidate_applications"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "candidate_invitations" ADD CONSTRAINT "candidate_invitations_company_id_job_id_fkey" FOREIGN KEY ("company_id", "job_id") REFERENCES "jobs"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_company_id_candidate_id_fkey" FOREIGN KEY ("company_id", "candidate_id") REFERENCES "candidates"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_company_id_invitation_id_fkey" FOREIGN KEY ("company_id", "invitation_id") REFERENCES "candidate_invitations"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_company_id_application_id_fkey" FOREIGN KEY ("company_id", "application_id") REFERENCES "candidate_applications"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_company_id_interview_plan_version_id_fkey" FOREIGN KEY ("company_id", "interview_plan_version_id") REFERENCES "interview_plan_versions"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
