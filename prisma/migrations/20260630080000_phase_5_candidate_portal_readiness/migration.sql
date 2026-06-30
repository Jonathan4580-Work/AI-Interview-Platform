-- Phase 5 candidate portal and readiness foundation.

CREATE TYPE "candidate_session_status" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED', 'COMPLETED');
CREATE TYPE "candidate_token_attempt_outcome" AS ENUM ('SUCCESS', 'MALFORMED', 'NOT_FOUND', 'EXPIRED', 'REVOKED', 'CONSUMED', 'COMPLETED', 'RATE_LIMITED');
CREATE TYPE "candidate_consent_type" AS ENUM ('INTERVIEW_PARTICIPATION', 'CAMERA_USE', 'MICROPHONE_USE', 'WEBCAM_SNAPSHOT', 'FUTURE_AUDIO_VIDEO_RECORDING', 'FUTURE_BROWSER_MONITORING', 'PRIVACY_NOTICE', 'DATA_PROCESSING_RETENTION');
CREATE TYPE "readiness_check_type" AS ENUM ('CAMERA', 'MICROPHONE', 'BROWSER', 'SECURE_CONTEXT', 'MEDIA_DEVICES', 'NETWORK', 'DEVICE', 'SCREEN_SIZE', 'AUDIO_OUTPUT');
CREATE TYPE "readiness_check_status" AS ENUM ('PASS', 'WARNING', 'FAIL');
CREATE TYPE "identity_verification_provider" AS ENUM ('INTERNAL_SELF_ATTESTATION');
CREATE TYPE "identity_verification_status" AS ENUM ('PENDING', 'SELF_ATTESTED', 'SNAPSHOT_SUBMITTED', 'NEEDS_REVIEW');
CREATE TYPE "accommodation_request_type" AS ENUM ('WEBCAM_ALTERNATIVE', 'TIME_EXTENSION', 'ACCESSIBILITY_SUPPORT', 'OTHER');
CREATE TYPE "candidate_request_status" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'CANCELLED');
CREATE TYPE "candidate_support_category" AS ENUM ('TECHNICAL', 'ACCESSIBILITY', 'SCHEDULING', 'PRIVACY', 'OTHER');

ALTER TABLE "candidate_invitations"
  ADD COLUMN "token_consumed_at" TIMESTAMP(3),
  ADD COLUMN "token_revoked_at" TIMESTAMP(3),
  ADD COLUMN "token_rotated_at" TIMESTAMP(3),
  ADD COLUMN "resend_count" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "candidate_sessions" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "invitation_id" TEXT NOT NULL,
    "interview_session_id" TEXT,
    "session_token_hash" TEXT NOT NULL,
    "csrf_token_hash" TEXT NOT NULL,
    "active_lock_key" TEXT,
    "status" "candidate_session_status" NOT NULL DEFAULT 'ACTIVE',
    "created_from_ip_hash" TEXT,
    "created_from_user_agent" TEXT,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "metadata_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidate_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "candidate_session_continuations" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "candidate_session_id" TEXT NOT NULL,
    "resume_token_hash" TEXT NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidate_session_continuations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "candidate_token_attempts" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "invitation_id" TEXT,
    "token_hash_prefix" TEXT,
    "ip_address_hash" TEXT,
    "outcome" "candidate_token_attempt_outcome" NOT NULL,
    "attempted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata_json" JSONB NOT NULL,

    CONSTRAINT "candidate_token_attempts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "candidate_consent_records" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "invitation_id" TEXT NOT NULL,
    "candidate_session_id" TEXT NOT NULL,
    "interview_session_id" TEXT,
    "type" "candidate_consent_type" NOT NULL,
    "consent_version" TEXT NOT NULL,
    "policy_version" TEXT NOT NULL,
    "accepted" BOOLEAN NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "denied_at" TIMESTAMP(3),
    "ip_address_hash" TEXT,
    "user_agent" TEXT,
    "metadata_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidate_consent_records_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "candidate_consent_records_decision_check" CHECK (
      (accepted = true AND accepted_at IS NOT NULL AND denied_at IS NULL) OR
      (accepted = false AND denied_at IS NOT NULL AND accepted_at IS NULL)
    )
);

CREATE TABLE "readiness_checks" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "invitation_id" TEXT NOT NULL,
    "candidate_session_id" TEXT NOT NULL,
    "interview_session_id" TEXT,
    "type" "readiness_check_type" NOT NULL,
    "status" "readiness_check_status" NOT NULL,
    "details_json" JSONB NOT NULL,
    "checked_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "readiness_checks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "identity_verifications" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "invitation_id" TEXT NOT NULL,
    "candidate_session_id" TEXT NOT NULL,
    "interview_session_id" TEXT,
    "provider" "identity_verification_provider" NOT NULL DEFAULT 'INTERNAL_SELF_ATTESTATION',
    "status" "identity_verification_status" NOT NULL DEFAULT 'PENDING',
    "self_attested_name" TEXT NOT NULL,
    "confirmed_name" TEXT,
    "consented_at" TIMESTAMP(3),
    "metadata_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "identity_verifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "webcam_snapshots" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "invitation_id" TEXT NOT NULL,
    "candidate_session_id" TEXT NOT NULL,
    "interview_session_id" TEXT,
    "identity_verification_id" TEXT,
    "storage_ref" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "checksum_sha256" TEXT NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL,
    "metadata_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webcam_snapshots_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "webcam_snapshots_size_check" CHECK ("size_bytes" > 0),
    CONSTRAINT "webcam_snapshots_checksum_check" CHECK ("checksum_sha256" ~ '^[a-f0-9]{64}$')
);

CREATE TABLE "accommodation_requests" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "invitation_id" TEXT NOT NULL,
    "candidate_session_id" TEXT NOT NULL,
    "type" "accommodation_request_type" NOT NULL,
    "status" "candidate_request_status" NOT NULL DEFAULT 'OPEN',
    "contact_email" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "accommodation_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "candidate_support_requests" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "invitation_id" TEXT NOT NULL,
    "candidate_session_id" TEXT NOT NULL,
    "category" "candidate_support_category" NOT NULL,
    "status" "candidate_request_status" NOT NULL DEFAULT 'OPEN',
    "contact_email" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "candidate_support_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "candidate_withdrawals" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "invitation_id" TEXT NOT NULL,
    "candidate_session_id" TEXT NOT NULL,
    "reason" TEXT,
    "confirmed_at" TIMESTAMP(3) NOT NULL,
    "metadata_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidate_withdrawals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "candidate_sessions_company_id_id_key" ON "candidate_sessions"("company_id", "id");
CREATE UNIQUE INDEX "candidate_sessions_session_token_hash_key" ON "candidate_sessions"("session_token_hash");
CREATE UNIQUE INDEX "candidate_sessions_company_id_active_lock_key_key" ON "candidate_sessions"("company_id", "active_lock_key");
CREATE INDEX "candidate_sessions_company_id_invitation_id_status_idx" ON "candidate_sessions"("company_id", "invitation_id", "status");
CREATE INDEX "candidate_sessions_company_id_candidate_id_idx" ON "candidate_sessions"("company_id", "candidate_id");
CREATE INDEX "candidate_sessions_expires_at_idx" ON "candidate_sessions"("expires_at");

CREATE UNIQUE INDEX "candidate_session_continuations_company_id_id_key" ON "candidate_session_continuations"("company_id", "id");
CREATE UNIQUE INDEX "candidate_session_continuations_resume_token_hash_key" ON "candidate_session_continuations"("resume_token_hash");
CREATE INDEX "candidate_session_continuations_company_id_candidate_session_id_idx" ON "candidate_session_continuations"("company_id", "candidate_session_id");
CREATE INDEX "candidate_session_continuations_expires_at_idx" ON "candidate_session_continuations"("expires_at");

CREATE UNIQUE INDEX "candidate_token_attempts_company_id_id_key" ON "candidate_token_attempts"("company_id", "id");
CREATE INDEX "candidate_token_attempts_company_id_invitation_id_attempted_at_idx" ON "candidate_token_attempts"("company_id", "invitation_id", "attempted_at");
CREATE INDEX "candidate_token_attempts_ip_address_hash_attempted_at_idx" ON "candidate_token_attempts"("ip_address_hash", "attempted_at");
CREATE INDEX "candidate_token_attempts_token_hash_prefix_attempted_at_idx" ON "candidate_token_attempts"("token_hash_prefix", "attempted_at");

CREATE UNIQUE INDEX "candidate_consent_records_company_id_id_key" ON "candidate_consent_records"("company_id", "id");
CREATE INDEX "candidate_consent_records_company_id_candidate_session_id_type_idx" ON "candidate_consent_records"("company_id", "candidate_session_id", "type");
CREATE INDEX "candidate_consent_records_company_id_invitation_id_idx" ON "candidate_consent_records"("company_id", "invitation_id");

CREATE UNIQUE INDEX "readiness_checks_company_id_id_key" ON "readiness_checks"("company_id", "id");
CREATE INDEX "readiness_checks_company_id_candidate_session_id_type_checked_at_idx" ON "readiness_checks"("company_id", "candidate_session_id", "type", "checked_at");
CREATE INDEX "readiness_checks_company_id_invitation_id_idx" ON "readiness_checks"("company_id", "invitation_id");

CREATE UNIQUE INDEX "identity_verifications_company_id_id_key" ON "identity_verifications"("company_id", "id");
CREATE INDEX "identity_verifications_company_id_candidate_session_id_idx" ON "identity_verifications"("company_id", "candidate_session_id");
CREATE INDEX "identity_verifications_company_id_candidate_id_status_idx" ON "identity_verifications"("company_id", "candidate_id", "status");

CREATE UNIQUE INDEX "webcam_snapshots_company_id_id_key" ON "webcam_snapshots"("company_id", "id");
CREATE INDEX "webcam_snapshots_company_id_candidate_session_id_idx" ON "webcam_snapshots"("company_id", "candidate_session_id");
CREATE INDEX "webcam_snapshots_company_id_identity_verification_id_idx" ON "webcam_snapshots"("company_id", "identity_verification_id");

CREATE UNIQUE INDEX "accommodation_requests_company_id_id_key" ON "accommodation_requests"("company_id", "id");
CREATE INDEX "accommodation_requests_company_id_invitation_id_status_idx" ON "accommodation_requests"("company_id", "invitation_id", "status");
CREATE INDEX "accommodation_requests_company_id_candidate_session_id_idx" ON "accommodation_requests"("company_id", "candidate_session_id");

CREATE UNIQUE INDEX "candidate_support_requests_company_id_id_key" ON "candidate_support_requests"("company_id", "id");
CREATE INDEX "candidate_support_requests_company_id_invitation_id_status_idx" ON "candidate_support_requests"("company_id", "invitation_id", "status");
CREATE INDEX "candidate_support_requests_company_id_candidate_session_id_idx" ON "candidate_support_requests"("company_id", "candidate_session_id");

CREATE UNIQUE INDEX "candidate_withdrawals_company_id_id_key" ON "candidate_withdrawals"("company_id", "id");
CREATE UNIQUE INDEX "candidate_withdrawals_company_id_invitation_id_key" ON "candidate_withdrawals"("company_id", "invitation_id");
CREATE INDEX "candidate_withdrawals_company_id_candidate_session_id_idx" ON "candidate_withdrawals"("company_id", "candidate_session_id");

CREATE INDEX "candidate_invitations_company_id_token_consumed_at_idx" ON "candidate_invitations"("company_id", "token_consumed_at");

ALTER TABLE "candidate_sessions" ADD CONSTRAINT "candidate_sessions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "candidate_sessions" ADD CONSTRAINT "candidate_sessions_company_id_candidate_id_fkey" FOREIGN KEY ("company_id", "candidate_id") REFERENCES "candidates"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "candidate_sessions" ADD CONSTRAINT "candidate_sessions_company_id_invitation_id_fkey" FOREIGN KEY ("company_id", "invitation_id") REFERENCES "candidate_invitations"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "candidate_sessions" ADD CONSTRAINT "candidate_sessions_company_id_interview_session_id_fkey" FOREIGN KEY ("company_id", "interview_session_id") REFERENCES "interview_sessions"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "candidate_session_continuations" ADD CONSTRAINT "candidate_session_continuations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "candidate_session_continuations" ADD CONSTRAINT "candidate_session_continuations_company_id_candidate_session_id_fkey" FOREIGN KEY ("company_id", "candidate_session_id") REFERENCES "candidate_sessions"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "candidate_token_attempts" ADD CONSTRAINT "candidate_token_attempts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "candidate_token_attempts" ADD CONSTRAINT "candidate_token_attempts_company_id_invitation_id_fkey" FOREIGN KEY ("company_id", "invitation_id") REFERENCES "candidate_invitations"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "candidate_consent_records" ADD CONSTRAINT "candidate_consent_records_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "candidate_consent_records" ADD CONSTRAINT "candidate_consent_records_company_id_candidate_id_fkey" FOREIGN KEY ("company_id", "candidate_id") REFERENCES "candidates"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "candidate_consent_records" ADD CONSTRAINT "candidate_consent_records_company_id_invitation_id_fkey" FOREIGN KEY ("company_id", "invitation_id") REFERENCES "candidate_invitations"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "candidate_consent_records" ADD CONSTRAINT "candidate_consent_records_company_id_candidate_session_id_fkey" FOREIGN KEY ("company_id", "candidate_session_id") REFERENCES "candidate_sessions"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "candidate_consent_records" ADD CONSTRAINT "candidate_consent_records_company_id_interview_session_id_fkey" FOREIGN KEY ("company_id", "interview_session_id") REFERENCES "interview_sessions"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "readiness_checks" ADD CONSTRAINT "readiness_checks_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "readiness_checks" ADD CONSTRAINT "readiness_checks_company_id_candidate_id_fkey" FOREIGN KEY ("company_id", "candidate_id") REFERENCES "candidates"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "readiness_checks" ADD CONSTRAINT "readiness_checks_company_id_invitation_id_fkey" FOREIGN KEY ("company_id", "invitation_id") REFERENCES "candidate_invitations"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "readiness_checks" ADD CONSTRAINT "readiness_checks_company_id_candidate_session_id_fkey" FOREIGN KEY ("company_id", "candidate_session_id") REFERENCES "candidate_sessions"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "readiness_checks" ADD CONSTRAINT "readiness_checks_company_id_interview_session_id_fkey" FOREIGN KEY ("company_id", "interview_session_id") REFERENCES "interview_sessions"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "identity_verifications" ADD CONSTRAINT "identity_verifications_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "identity_verifications" ADD CONSTRAINT "identity_verifications_company_id_candidate_id_fkey" FOREIGN KEY ("company_id", "candidate_id") REFERENCES "candidates"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "identity_verifications" ADD CONSTRAINT "identity_verifications_company_id_invitation_id_fkey" FOREIGN KEY ("company_id", "invitation_id") REFERENCES "candidate_invitations"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "identity_verifications" ADD CONSTRAINT "identity_verifications_company_id_candidate_session_id_fkey" FOREIGN KEY ("company_id", "candidate_session_id") REFERENCES "candidate_sessions"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "identity_verifications" ADD CONSTRAINT "identity_verifications_company_id_interview_session_id_fkey" FOREIGN KEY ("company_id", "interview_session_id") REFERENCES "interview_sessions"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "webcam_snapshots" ADD CONSTRAINT "webcam_snapshots_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "webcam_snapshots" ADD CONSTRAINT "webcam_snapshots_company_id_candidate_id_fkey" FOREIGN KEY ("company_id", "candidate_id") REFERENCES "candidates"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "webcam_snapshots" ADD CONSTRAINT "webcam_snapshots_company_id_invitation_id_fkey" FOREIGN KEY ("company_id", "invitation_id") REFERENCES "candidate_invitations"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "webcam_snapshots" ADD CONSTRAINT "webcam_snapshots_company_id_candidate_session_id_fkey" FOREIGN KEY ("company_id", "candidate_session_id") REFERENCES "candidate_sessions"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "webcam_snapshots" ADD CONSTRAINT "webcam_snapshots_company_id_interview_session_id_fkey" FOREIGN KEY ("company_id", "interview_session_id") REFERENCES "interview_sessions"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "webcam_snapshots" ADD CONSTRAINT "webcam_snapshots_company_id_identity_verification_id_fkey" FOREIGN KEY ("company_id", "identity_verification_id") REFERENCES "identity_verifications"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accommodation_requests" ADD CONSTRAINT "accommodation_requests_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "accommodation_requests" ADD CONSTRAINT "accommodation_requests_company_id_candidate_id_fkey" FOREIGN KEY ("company_id", "candidate_id") REFERENCES "candidates"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "accommodation_requests" ADD CONSTRAINT "accommodation_requests_company_id_invitation_id_fkey" FOREIGN KEY ("company_id", "invitation_id") REFERENCES "candidate_invitations"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "accommodation_requests" ADD CONSTRAINT "accommodation_requests_company_id_candidate_session_id_fkey" FOREIGN KEY ("company_id", "candidate_session_id") REFERENCES "candidate_sessions"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "candidate_support_requests" ADD CONSTRAINT "candidate_support_requests_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "candidate_support_requests" ADD CONSTRAINT "candidate_support_requests_company_id_candidate_id_fkey" FOREIGN KEY ("company_id", "candidate_id") REFERENCES "candidates"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "candidate_support_requests" ADD CONSTRAINT "candidate_support_requests_company_id_invitation_id_fkey" FOREIGN KEY ("company_id", "invitation_id") REFERENCES "candidate_invitations"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "candidate_support_requests" ADD CONSTRAINT "candidate_support_requests_company_id_candidate_session_id_fkey" FOREIGN KEY ("company_id", "candidate_session_id") REFERENCES "candidate_sessions"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "candidate_withdrawals" ADD CONSTRAINT "candidate_withdrawals_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "candidate_withdrawals" ADD CONSTRAINT "candidate_withdrawals_company_id_candidate_id_fkey" FOREIGN KEY ("company_id", "candidate_id") REFERENCES "candidates"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "candidate_withdrawals" ADD CONSTRAINT "candidate_withdrawals_company_id_invitation_id_fkey" FOREIGN KEY ("company_id", "invitation_id") REFERENCES "candidate_invitations"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "candidate_withdrawals" ADD CONSTRAINT "candidate_withdrawals_company_id_candidate_session_id_fkey" FOREIGN KEY ("company_id", "candidate_session_id") REFERENCES "candidate_sessions"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
