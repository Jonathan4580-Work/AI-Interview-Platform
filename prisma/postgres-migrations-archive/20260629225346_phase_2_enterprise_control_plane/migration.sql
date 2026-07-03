-- CreateEnum
CREATE TYPE "support_access_status" AS ENUM ('REQUESTED', 'ACTIVE', 'EXPIRED', 'REVOKED', 'DENIED');

-- CreateEnum
CREATE TYPE "subscription_status" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "legal_hold_status" AS ENUM ('ACTIVE', 'RELEASED');

-- CreateEnum
CREATE TYPE "privacy_request_type" AS ENUM ('ACCESS', 'DELETION', 'ANONYMIZATION', 'EXPORT', 'CORRECTION');

-- CreateEnum
CREATE TYPE "privacy_request_status" AS ENUM ('RECEIVED', 'VERIFYING', 'PROCESSING', 'COMPLETED', 'DENIED');

-- CreateEnum
CREATE TYPE "export_request_type" AS ENUM ('CANDIDATE_REPORT', 'ROLE_SUMMARY', 'AUDIT_EXPORT', 'TENANT_EXPORT', 'COMPLIANCE_EXPORT');

-- CreateEnum
CREATE TYPE "export_request_status" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED', 'EXPIRED');

-- AlterEnum
ALTER TYPE "audit_actor_type" ADD VALUE 'CANDIDATE_SESSION';

-- AlterTable
ALTER TABLE "audit_events" ADD COLUMN     "support_access_session_id" TEXT;

-- CreateTable
CREATE TABLE "company_settings" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "branding_json" JSONB NOT NULL,
    "retention_policy_json" JSONB NOT NULL,
    "email_settings_json" JSONB NOT NULL,
    "feature_flags_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "status" "subscription_status" NOT NULL DEFAULT 'TRIALING',
    "plan_key" TEXT NOT NULL,
    "billing_provider" TEXT,
    "billing_customer_ref" TEXT,
    "billing_subscription_ref" TEXT,
    "current_period_start" TIMESTAMP(3),
    "current_period_end" TIMESTAMP(3),
    "usage_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entitlements" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "plan_key" TEXT NOT NULL,
    "feature_key" TEXT NOT NULL,
    "limit_value" INTEGER,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "override_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_counters" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "metric_key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "metadata_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usage_counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_access_sessions" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "platform_user_id" TEXT NOT NULL,
    "status" "support_access_status" NOT NULL DEFAULT 'REQUESTED',
    "reason_code" TEXT NOT NULL,
    "reason_text" TEXT NOT NULL,
    "approved_by_platform_user_id" TEXT,
    "started_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_access_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_holds" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "legal_hold_status" NOT NULL DEFAULT 'ACTIVE',
    "created_by_user_id" TEXT NOT NULL,
    "released_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "released_at" TIMESTAMP(3),

    CONSTRAINT "legal_holds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "privacy_requests" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "candidate_id" TEXT,
    "type" "privacy_request_type" NOT NULL,
    "status" "privacy_request_status" NOT NULL DEFAULT 'RECEIVED',
    "requester_email" TEXT NOT NULL,
    "reason" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "privacy_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_requests" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "requested_by_user_id" TEXT NOT NULL,
    "type" "export_request_type" NOT NULL,
    "status" "export_request_status" NOT NULL DEFAULT 'PENDING',
    "resource_type" TEXT,
    "resource_id" TEXT,
    "storage_key" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "export_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_settings_company_id_key" ON "company_settings"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_company_id_key" ON "subscriptions"("company_id");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- CreateIndex
CREATE INDEX "entitlements_company_id_plan_key_idx" ON "entitlements"("company_id", "plan_key");

-- CreateIndex
CREATE UNIQUE INDEX "entitlements_company_id_feature_key_key" ON "entitlements"("company_id", "feature_key");

-- CreateIndex
CREATE INDEX "usage_counters_company_id_metric_key_idx" ON "usage_counters"("company_id", "metric_key");

-- CreateIndex
CREATE UNIQUE INDEX "usage_counters_company_id_period_start_period_end_metric_ke_key" ON "usage_counters"("company_id", "period_start", "period_end", "metric_key");

-- CreateIndex
CREATE INDEX "support_access_sessions_company_id_status_idx" ON "support_access_sessions"("company_id", "status");

-- CreateIndex
CREATE INDEX "support_access_sessions_platform_user_id_status_idx" ON "support_access_sessions"("platform_user_id", "status");

-- CreateIndex
CREATE INDEX "support_access_sessions_expires_at_idx" ON "support_access_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "legal_holds_company_id_status_idx" ON "legal_holds"("company_id", "status");

-- CreateIndex
CREATE INDEX "privacy_requests_company_id_candidate_id_idx" ON "privacy_requests"("company_id", "candidate_id");

-- CreateIndex
CREATE INDEX "privacy_requests_company_id_status_idx" ON "privacy_requests"("company_id", "status");

-- CreateIndex
CREATE INDEX "export_requests_company_id_status_idx" ON "export_requests"("company_id", "status");

-- CreateIndex
CREATE INDEX "export_requests_company_id_requested_by_user_id_idx" ON "export_requests"("company_id", "requested_by_user_id");

-- CreateIndex
CREATE INDEX "audit_events_support_access_session_id_idx" ON "audit_events"("support_access_session_id");

-- RenameForeignKey
ALTER TABLE "user_roles" RENAME CONSTRAINT "user_roles_role_id_fkey" TO "user_roles_company_id_role_id_fkey";

-- RenameForeignKey
ALTER TABLE "user_roles" RENAME CONSTRAINT "user_roles_user_id_fkey" TO "user_roles_company_id_user_id_fkey";

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_support_access_session_id_fkey" FOREIGN KEY ("support_access_session_id") REFERENCES "support_access_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_counters" ADD CONSTRAINT "usage_counters_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_access_sessions" ADD CONSTRAINT "support_access_sessions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_access_sessions" ADD CONSTRAINT "support_access_sessions_platform_user_id_fkey" FOREIGN KEY ("platform_user_id") REFERENCES "platform_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_access_sessions" ADD CONSTRAINT "support_access_sessions_approved_by_platform_user_id_fkey" FOREIGN KEY ("approved_by_platform_user_id") REFERENCES "platform_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_holds" ADD CONSTRAINT "legal_holds_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_holds" ADD CONSTRAINT "legal_holds_company_id_created_by_user_id_fkey" FOREIGN KEY ("company_id", "created_by_user_id") REFERENCES "users"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_holds" ADD CONSTRAINT "legal_holds_company_id_released_by_user_id_fkey" FOREIGN KEY ("company_id", "released_by_user_id") REFERENCES "users"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "privacy_requests" ADD CONSTRAINT "privacy_requests_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_requests" ADD CONSTRAINT "export_requests_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_requests" ADD CONSTRAINT "export_requests_company_id_requested_by_user_id_fkey" FOREIGN KEY ("company_id", "requested_by_user_id") REFERENCES "users"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
