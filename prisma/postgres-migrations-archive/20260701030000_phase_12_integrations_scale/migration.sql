-- CreateEnum
CREATE TYPE "outbox_event_status" AS ENUM ('PENDING', 'PROCESSING', 'DELIVERED', 'RETRY_SCHEDULED', 'DEAD_LETTERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "webhook_subscription_status" AS ENUM ('ENABLED', 'DISABLED', 'PENDING_VERIFICATION', 'FAILED');

-- CreateEnum
CREATE TYPE "webhook_delivery_status" AS ENUM ('PENDING', 'SENDING', 'DELIVERED', 'RETRY_SCHEDULED', 'FAILED', 'DEAD_LETTERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "sso_provider" AS ENUM ('GOOGLE_OIDC', 'MICROSOFT_ENTRA_OIDC', 'DEVELOPMENT_OIDC', 'SAML_PLACEHOLDER');

-- CreateEnum
CREATE TYPE "sso_login_policy" AS ENUM ('LOCAL_ALLOWED', 'SSO_OPTIONAL', 'SSO_REQUIRED');

-- CreateEnum
CREATE TYPE "sso_configuration_status" AS ENUM ('DRAFT', 'ENABLED', 'DISABLED');

-- CreateEnum
CREATE TYPE "scim_configuration_status" AS ENUM ('ENABLED', 'DISABLED', 'ROTATING_TOKEN');

-- CreateEnum
CREATE TYPE "integration_provider" AS ENUM ('DEVELOPMENT_ATS', 'GREENHOUSE', 'LEVER', 'WORKDAY', 'ASHBY', 'SMARTRECRUITERS', 'OTHER');

-- CreateEnum
CREATE TYPE "integration_connection_status" AS ENUM ('DRAFT', 'CONNECTED', 'DISABLED', 'ERROR', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "integration_mapping_type" AS ENUM ('JOB', 'CANDIDATE', 'APPLICATION', 'STAGE', 'USER');

-- CreateEnum
CREATE TYPE "integration_conflict_policy" AS ENUM ('APTLY_WINS', 'EXTERNAL_WINS', 'MANUAL_REVIEW', 'FIELD_SPECIFIC');

-- CreateEnum
CREATE TYPE "integration_sync_job_status" AS ENUM ('QUEUED', 'RUNNING', 'PARTIALLY_FAILED', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "data_region_key" AS ENUM ('US', 'EU', 'APAC');

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "event_key" TEXT NOT NULL,
    "schema_version" TEXT NOT NULL,
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "available_at" TIMESTAMP(3) NOT NULL,
    "status" "outbox_event_status" NOT NULL DEFAULT 'PENDING',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3),
    "request_id" TEXT,
    "correlation_id" TEXT,
    "payload_json" JSONB NOT NULL,
    "last_error_code" TEXT,
    "last_error_message" TEXT,
    "delivered_at" TIMESTAMP(3),
    "dead_lettered_at" TIMESTAMP(3),
    "retention_delete_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_subscriptions" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "endpoint_url" TEXT NOT NULL,
    "status" "webhook_subscription_status" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "event_keys" TEXT[],
    "signing_secret_ref" TEXT NOT NULL,
    "schema_version" TEXT NOT NULL,
    "max_attempts" INTEGER NOT NULL DEFAULT 8,
    "created_by_user_id" TEXT,
    "verified_at" TIMESTAMP(3),
    "disabled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "webhook_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_deliveries" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "outbox_event_id" TEXT NOT NULL,
    "event_key" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "status" "webhook_delivery_status" NOT NULL DEFAULT 'PENDING',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3),
    "last_status_code" INTEGER,
    "last_error_code" TEXT,
    "delivered_at" TIMESTAMP(3),
    "dead_lettered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_delivery_attempts" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "delivery_id" TEXT NOT NULL,
    "attempt_number" INTEGER NOT NULL,
    "status" "webhook_delivery_status" NOT NULL,
    "status_code" INTEGER,
    "error_code" TEXT,
    "error_message" TEXT,
    "duration_ms" INTEGER,
    "started_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "metadata_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "webhook_delivery_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sso_configurations" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "provider" "sso_provider" NOT NULL,
    "status" "sso_configuration_status" NOT NULL DEFAULT 'DRAFT',
    "login_policy" "sso_login_policy" NOT NULL DEFAULT 'LOCAL_ALLOWED',
    "issuer_url" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "client_secret_ref" TEXT NOT NULL,
    "redirect_uri" TEXT NOT NULL,
    "metadata_ref" TEXT,
    "jit_provisioning_enabled" BOOLEAN NOT NULL DEFAULT false,
    "break_glass_enabled" BOOLEAN NOT NULL DEFAULT true,
    "role_mapping_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sso_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sso_domain_mappings" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "sso_configuration_id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "normalized_domain" TEXT NOT NULL,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sso_domain_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scim_configurations" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "status" "scim_configuration_status" NOT NULL DEFAULT 'DISABLED',
    "token_hash" TEXT NOT NULL,
    "token_secret_ref" TEXT,
    "external_tenant_ref" TEXT,
    "provisioning_enabled" BOOLEAN NOT NULL DEFAULT false,
    "deprovision_revokes_sessions" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "scim_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scim_external_mappings" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "scim_configuration_id" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "aptly_resource_type" TEXT NOT NULL,
    "aptly_resource_id" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "metadata_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "scim_external_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_connections" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "provider" "integration_provider" NOT NULL,
    "name" TEXT NOT NULL,
    "status" "integration_connection_status" NOT NULL DEFAULT 'DRAFT',
    "secret_ref" TEXT,
    "external_account_ref" TEXT,
    "sync_mode" TEXT NOT NULL,
    "import_enabled" BOOLEAN NOT NULL DEFAULT false,
    "export_enabled" BOOLEAN NOT NULL DEFAULT false,
    "conflict_policy" "integration_conflict_policy" NOT NULL DEFAULT 'MANUAL_REVIEW',
    "last_successful_sync_at" TIMESTAMP(3),
    "error_state" TEXT,
    "rate_limit_state_json" JSONB NOT NULL,
    "mapping_config_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "integration_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_mappings" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "integration_connection_id" TEXT NOT NULL,
    "mapping_type" "integration_mapping_type" NOT NULL,
    "external_id" TEXT NOT NULL,
    "aptly_resource_type" TEXT NOT NULL,
    "aptly_resource_id" TEXT NOT NULL,
    "conflict_policy" "integration_conflict_policy" NOT NULL,
    "last_synced_at" TIMESTAMP(3),
    "metadata_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "integration_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_sync_jobs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "integration_connection_id" TEXT NOT NULL,
    "workflow_id" TEXT,
    "status" "integration_sync_job_status" NOT NULL DEFAULT 'QUEUED',
    "sync_direction" TEXT NOT NULL,
    "cursor_json" JSONB NOT NULL,
    "checkpoint_json" JSONB NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "pages_processed" INTEGER NOT NULL DEFAULT 0,
    "records_processed" INTEGER NOT NULL DEFAULT 0,
    "conflict_count" INTEGER NOT NULL DEFAULT 0,
    "failure_code" TEXT,
    "failure_message" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "integration_sync_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_residency_settings" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "primary_region" "data_region_key" NOT NULL,
    "storage_region" "data_region_key" NOT NULL,
    "cross_region_transfers_allowed" BOOLEAN NOT NULL DEFAULT false,
    "residency_policy_version" TEXT NOT NULL,
    "migration_plan_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "data_residency_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "outbox_events_company_id_id_key" ON "outbox_events"("company_id", "id");
CREATE INDEX "outbox_events_company_id_status_available_at_idx" ON "outbox_events"("company_id", "status", "available_at");
CREATE INDEX "outbox_events_company_id_aggregate_type_aggregate_id_occurred_at_idx" ON "outbox_events"("company_id", "aggregate_type", "aggregate_id", "occurred_at");
CREATE INDEX "outbox_events_company_id_event_key_occurred_at_idx" ON "outbox_events"("company_id", "event_key", "occurred_at");
CREATE INDEX "outbox_events_company_id_retention_delete_at_idx" ON "outbox_events"("company_id", "retention_delete_at");

CREATE UNIQUE INDEX "webhook_subscriptions_company_id_id_key" ON "webhook_subscriptions"("company_id", "id");
CREATE INDEX "webhook_subscriptions_company_id_status_idx" ON "webhook_subscriptions"("company_id", "status");

CREATE UNIQUE INDEX "webhook_deliveries_company_id_id_key" ON "webhook_deliveries"("company_id", "id");
CREATE UNIQUE INDEX "webhook_deliveries_company_id_subscription_id_outbox_event_id_key" ON "webhook_deliveries"("company_id", "subscription_id", "outbox_event_id");
CREATE INDEX "webhook_deliveries_company_id_status_next_attempt_at_idx" ON "webhook_deliveries"("company_id", "status", "next_attempt_at");
CREATE INDEX "webhook_deliveries_company_id_event_key_created_at_idx" ON "webhook_deliveries"("company_id", "event_key", "created_at");

CREATE UNIQUE INDEX "webhook_delivery_attempts_company_id_id_key" ON "webhook_delivery_attempts"("company_id", "id");
CREATE UNIQUE INDEX "webhook_delivery_attempts_company_id_delivery_id_attempt_number_key" ON "webhook_delivery_attempts"("company_id", "delivery_id", "attempt_number");
CREATE INDEX "webhook_delivery_attempts_company_id_status_started_at_idx" ON "webhook_delivery_attempts"("company_id", "status", "started_at");

CREATE UNIQUE INDEX "sso_configurations_company_id_id_key" ON "sso_configurations"("company_id", "id");
CREATE UNIQUE INDEX "sso_configurations_company_id_provider_key" ON "sso_configurations"("company_id", "provider");
CREATE INDEX "sso_configurations_company_id_status_idx" ON "sso_configurations"("company_id", "status");

CREATE UNIQUE INDEX "sso_domain_mappings_company_id_id_key" ON "sso_domain_mappings"("company_id", "id");
CREATE UNIQUE INDEX "sso_domain_mappings_company_id_normalized_domain_key" ON "sso_domain_mappings"("company_id", "normalized_domain");
CREATE INDEX "sso_domain_mappings_company_id_sso_configuration_id_idx" ON "sso_domain_mappings"("company_id", "sso_configuration_id");

CREATE UNIQUE INDEX "scim_configurations_company_id_id_key" ON "scim_configurations"("company_id", "id");
CREATE UNIQUE INDEX "scim_configurations_company_id_token_hash_key" ON "scim_configurations"("company_id", "token_hash");
CREATE INDEX "scim_configurations_company_id_status_idx" ON "scim_configurations"("company_id", "status");

CREATE UNIQUE INDEX "scim_external_mappings_company_id_id_key" ON "scim_external_mappings"("company_id", "id");
CREATE UNIQUE INDEX "scim_external_mappings_company_id_scim_configuration_id_resource_type_external_id_key" ON "scim_external_mappings"("company_id", "scim_configuration_id", "resource_type", "external_id");
CREATE INDEX "scim_external_mappings_company_id_aptly_resource_type_aptly_resource_id_idx" ON "scim_external_mappings"("company_id", "aptly_resource_type", "aptly_resource_id");

CREATE UNIQUE INDEX "integration_connections_company_id_id_key" ON "integration_connections"("company_id", "id");
CREATE UNIQUE INDEX "integration_connections_company_id_provider_name_key" ON "integration_connections"("company_id", "provider", "name");
CREATE INDEX "integration_connections_company_id_provider_status_idx" ON "integration_connections"("company_id", "provider", "status");

CREATE UNIQUE INDEX "integration_mappings_company_id_id_key" ON "integration_mappings"("company_id", "id");
CREATE UNIQUE INDEX "integration_mappings_company_id_integration_connection_id_mapping_type_external_id_key" ON "integration_mappings"("company_id", "integration_connection_id", "mapping_type", "external_id");
CREATE INDEX "integration_mappings_company_id_aptly_resource_type_aptly_resource_id_idx" ON "integration_mappings"("company_id", "aptly_resource_type", "aptly_resource_id");

CREATE UNIQUE INDEX "integration_sync_jobs_company_id_id_key" ON "integration_sync_jobs"("company_id", "id");
CREATE UNIQUE INDEX "integration_sync_jobs_company_id_idempotency_key_key" ON "integration_sync_jobs"("company_id", "idempotency_key");
CREATE INDEX "integration_sync_jobs_company_id_integration_connection_id_status_idx" ON "integration_sync_jobs"("company_id", "integration_connection_id", "status");
CREATE INDEX "integration_sync_jobs_company_id_status_created_at_idx" ON "integration_sync_jobs"("company_id", "status", "created_at");

CREATE UNIQUE INDEX "data_residency_settings_company_id_key" ON "data_residency_settings"("company_id");
CREATE INDEX "data_residency_settings_company_id_primary_region_idx" ON "data_residency_settings"("company_id", "primary_region");

-- AddForeignKey
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "webhook_subscriptions" ADD CONSTRAINT "webhook_subscriptions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_company_id_subscription_id_fkey" FOREIGN KEY ("company_id", "subscription_id") REFERENCES "webhook_subscriptions"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_company_id_outbox_event_id_fkey" FOREIGN KEY ("company_id", "outbox_event_id") REFERENCES "outbox_events"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "webhook_delivery_attempts" ADD CONSTRAINT "webhook_delivery_attempts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "webhook_delivery_attempts" ADD CONSTRAINT "webhook_delivery_attempts_company_id_delivery_id_fkey" FOREIGN KEY ("company_id", "delivery_id") REFERENCES "webhook_deliveries"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sso_configurations" ADD CONSTRAINT "sso_configurations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sso_domain_mappings" ADD CONSTRAINT "sso_domain_mappings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sso_domain_mappings" ADD CONSTRAINT "sso_domain_mappings_company_id_sso_configuration_id_fkey" FOREIGN KEY ("company_id", "sso_configuration_id") REFERENCES "sso_configurations"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scim_configurations" ADD CONSTRAINT "scim_configurations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "scim_external_mappings" ADD CONSTRAINT "scim_external_mappings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "scim_external_mappings" ADD CONSTRAINT "scim_external_mappings_company_id_scim_configuration_id_fkey" FOREIGN KEY ("company_id", "scim_configuration_id") REFERENCES "scim_configurations"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "integration_mappings" ADD CONSTRAINT "integration_mappings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "integration_mappings" ADD CONSTRAINT "integration_mappings_company_id_integration_connection_id_fkey" FOREIGN KEY ("company_id", "integration_connection_id") REFERENCES "integration_connections"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "integration_sync_jobs" ADD CONSTRAINT "integration_sync_jobs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "integration_sync_jobs" ADD CONSTRAINT "integration_sync_jobs_company_id_integration_connection_id_fkey" FOREIGN KEY ("company_id", "integration_connection_id") REFERENCES "integration_connections"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "data_residency_settings" ADD CONSTRAINT "data_residency_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
