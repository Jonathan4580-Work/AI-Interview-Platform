-- Phase 4A authentication foundation: credentials, sessions, reset/verification tokens, and MFA-ready factors.

CREATE TYPE "auth_subject_type" AS ENUM ('USER', 'PLATFORM_USER');
CREATE TYPE "auth_session_status" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');
CREATE TYPE "mfa_factor_type" AS ENUM ('TOTP', 'WEBAUTHN', 'RECOVERY_CODE');
CREATE TYPE "mfa_factor_status" AS ENUM ('PENDING', 'ACTIVE', 'DISABLED');

CREATE TABLE "auth_credentials" (
    "id" TEXT NOT NULL,
    "subject_type" "auth_subject_type" NOT NULL,
    "company_id" TEXT,
    "user_id" TEXT,
    "platform_user_id" TEXT,
    "password_hash" TEXT NOT NULL,
    "email_verified_at" TIMESTAMP(3),
    "password_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_credentials_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "auth_credentials_subject_check" CHECK (
      (subject_type = 'USER' AND company_id IS NOT NULL AND user_id IS NOT NULL AND platform_user_id IS NULL) OR
      (subject_type = 'PLATFORM_USER' AND company_id IS NULL AND user_id IS NULL AND platform_user_id IS NOT NULL)
    )
);

CREATE TABLE "auth_sessions" (
    "id" TEXT NOT NULL,
    "subject_type" "auth_subject_type" NOT NULL,
    "company_id" TEXT,
    "user_id" TEXT,
    "platform_user_id" TEXT,
    "session_token_hash" TEXT NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "csrf_token_hash" TEXT NOT NULL,
    "status" "auth_session_status" NOT NULL DEFAULT 'ACTIVE',
    "ip_address" TEXT,
    "user_agent" TEXT,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "refresh_expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "auth_sessions_subject_check" CHECK (
      (subject_type = 'USER' AND company_id IS NOT NULL AND user_id IS NOT NULL AND platform_user_id IS NULL) OR
      (subject_type = 'PLATFORM_USER' AND company_id IS NULL AND user_id IS NULL AND platform_user_id IS NOT NULL)
    )
);

CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "subject_type" "auth_subject_type" NOT NULL,
    "company_id" TEXT,
    "user_id" TEXT,
    "platform_user_id" TEXT,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "password_reset_tokens_subject_check" CHECK (
      (subject_type = 'USER' AND company_id IS NOT NULL AND user_id IS NOT NULL AND platform_user_id IS NULL) OR
      (subject_type = 'PLATFORM_USER' AND company_id IS NULL AND user_id IS NULL AND platform_user_id IS NOT NULL)
    )
);

CREATE TABLE "email_verification_tokens" (
    "id" TEXT NOT NULL,
    "subject_type" "auth_subject_type" NOT NULL,
    "company_id" TEXT,
    "user_id" TEXT,
    "platform_user_id" TEXT,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "email_verification_tokens_subject_check" CHECK (
      (subject_type = 'USER' AND company_id IS NOT NULL AND user_id IS NOT NULL AND platform_user_id IS NULL) OR
      (subject_type = 'PLATFORM_USER' AND company_id IS NULL AND user_id IS NULL AND platform_user_id IS NOT NULL)
    )
);

CREATE TABLE "mfa_factors" (
    "id" TEXT NOT NULL,
    "subject_type" "auth_subject_type" NOT NULL,
    "company_id" TEXT,
    "user_id" TEXT,
    "platform_user_id" TEXT,
    "type" "mfa_factor_type" NOT NULL,
    "status" "mfa_factor_status" NOT NULL DEFAULT 'PENDING',
    "secret_ref" TEXT,
    "metadata_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "disabled_at" TIMESTAMP(3),

    CONSTRAINT "mfa_factors_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "mfa_factors_subject_check" CHECK (
      (subject_type = 'USER' AND company_id IS NOT NULL AND user_id IS NOT NULL AND platform_user_id IS NULL) OR
      (subject_type = 'PLATFORM_USER' AND company_id IS NULL AND user_id IS NULL AND platform_user_id IS NOT NULL)
    )
);

CREATE UNIQUE INDEX "auth_credentials_company_id_user_id_key" ON "auth_credentials"("company_id", "user_id");
CREATE UNIQUE INDEX "auth_credentials_platform_user_id_key" ON "auth_credentials"("platform_user_id");
CREATE INDEX "auth_credentials_company_id_idx" ON "auth_credentials"("company_id");

CREATE UNIQUE INDEX "auth_sessions_session_token_hash_key" ON "auth_sessions"("session_token_hash");
CREATE UNIQUE INDEX "auth_sessions_refresh_token_hash_key" ON "auth_sessions"("refresh_token_hash");
CREATE UNIQUE INDEX "auth_sessions_company_id_id_key" ON "auth_sessions"("company_id", "id");
CREATE INDEX "auth_sessions_company_id_user_id_status_idx" ON "auth_sessions"("company_id", "user_id", "status");
CREATE INDEX "auth_sessions_platform_user_id_status_idx" ON "auth_sessions"("platform_user_id", "status");
CREATE INDEX "auth_sessions_expires_at_idx" ON "auth_sessions"("expires_at");
CREATE INDEX "auth_sessions_refresh_expires_at_idx" ON "auth_sessions"("refresh_expires_at");

CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");
CREATE INDEX "password_reset_tokens_company_id_user_id_idx" ON "password_reset_tokens"("company_id", "user_id");
CREATE INDEX "password_reset_tokens_platform_user_id_idx" ON "password_reset_tokens"("platform_user_id");
CREATE INDEX "password_reset_tokens_expires_at_idx" ON "password_reset_tokens"("expires_at");

CREATE UNIQUE INDEX "email_verification_tokens_token_hash_key" ON "email_verification_tokens"("token_hash");
CREATE INDEX "email_verification_tokens_company_id_user_id_idx" ON "email_verification_tokens"("company_id", "user_id");
CREATE INDEX "email_verification_tokens_platform_user_id_idx" ON "email_verification_tokens"("platform_user_id");
CREATE INDEX "email_verification_tokens_expires_at_idx" ON "email_verification_tokens"("expires_at");

CREATE UNIQUE INDEX "mfa_factors_company_id_user_id_type_key" ON "mfa_factors"("company_id", "user_id", "type");
CREATE UNIQUE INDEX "mfa_factors_platform_user_id_type_key" ON "mfa_factors"("platform_user_id", "type");
CREATE INDEX "mfa_factors_company_id_status_idx" ON "mfa_factors"("company_id", "status");

ALTER TABLE "auth_credentials" ADD CONSTRAINT "auth_credentials_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "auth_credentials" ADD CONSTRAINT "auth_credentials_company_id_user_id_fkey" FOREIGN KEY ("company_id", "user_id") REFERENCES "users"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "auth_credentials" ADD CONSTRAINT "auth_credentials_platform_user_id_fkey" FOREIGN KEY ("platform_user_id") REFERENCES "platform_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_company_id_user_id_fkey" FOREIGN KEY ("company_id", "user_id") REFERENCES "users"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_platform_user_id_fkey" FOREIGN KEY ("platform_user_id") REFERENCES "platform_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_company_id_user_id_fkey" FOREIGN KEY ("company_id", "user_id") REFERENCES "users"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_platform_user_id_fkey" FOREIGN KEY ("platform_user_id") REFERENCES "platform_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_company_id_user_id_fkey" FOREIGN KEY ("company_id", "user_id") REFERENCES "users"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_platform_user_id_fkey" FOREIGN KEY ("platform_user_id") REFERENCES "platform_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mfa_factors" ADD CONSTRAINT "mfa_factors_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mfa_factors" ADD CONSTRAINT "mfa_factors_company_id_user_id_fkey" FOREIGN KEY ("company_id", "user_id") REFERENCES "users"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mfa_factors" ADD CONSTRAINT "mfa_factors_platform_user_id_fkey" FOREIGN KEY ("platform_user_id") REFERENCES "platform_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
