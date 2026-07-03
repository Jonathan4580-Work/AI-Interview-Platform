-- Phase 4 email system foundation: provider-neutral email configuration, templates, deliveries, attempts, and provider events.

CREATE TYPE "email_provider" AS ENUM ('SMTP', 'PREVIEW');
CREATE TYPE "smtp_profile_status" AS ENUM ('ACTIVE', 'DISABLED', 'ARCHIVED');
CREATE TYPE "sender_domain_status" AS ENUM ('PENDING', 'VERIFIED', 'FAILED', 'REVOKED');
CREATE TYPE "email_template_key" AS ENUM ('INTERVIEW_INVITATION', 'INTERVIEW_REMINDER', 'INVITATION_EXPIRED', 'EMAIL_VERIFICATION', 'PASSWORD_RESET');
CREATE TYPE "email_template_status" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "email_delivery_status" AS ENUM ('PENDING', 'QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'DEFERRED', 'BOUNCED', 'COMPLAINED', 'FAILED', 'CANCELLED');
CREATE TYPE "email_delivery_attempt_status" AS ENUM ('SENDING', 'SENT', 'DEFERRED', 'FAILED');
CREATE TYPE "email_event_type" AS ENUM ('DELIVERED', 'DEFERRED', 'BOUNCED', 'COMPLAINED', 'FAILED');

CREATE TABLE "email_settings" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "default_smtp_profile_id" TEXT,
    "tenant_email_disabled_at" TIMESTAMP(3),
    "disabled_reason" TEXT,
    "metadata_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "smtp_profiles" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "provider" "email_provider" NOT NULL DEFAULT 'SMTP',
    "name" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "secure" BOOLEAN NOT NULL DEFAULT true,
    "from_name" TEXT NOT NULL,
    "from_email" TEXT NOT NULL,
    "normalized_from_email" TEXT NOT NULL,
    "reply_to_email" TEXT,
    "normalized_reply_to_email" TEXT,
    "secret_ref" TEXT NOT NULL,
    "status" "smtp_profile_status" NOT NULL DEFAULT 'ACTIVE',
    "domain_verification_status" "sender_domain_status" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "smtp_profiles_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "smtp_profiles_port_check" CHECK ("port" > 0 AND "port" <= 65535)
);

CREATE TABLE "verified_sender_domains" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "normalized_domain" TEXT NOT NULL,
    "status" "sender_domain_status" NOT NULL DEFAULT 'PENDING',
    "verification_token_hash" TEXT NOT NULL,
    "dns_txt_name" TEXT NOT NULL,
    "dns_txt_value" TEXT NOT NULL,
    "failure_reason" TEXT,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verified_sender_domains_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "email_templates" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "key" "email_template_key" NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "html_body" TEXT NOT NULL,
    "text_body" TEXT NOT NULL,
    "schema_version" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "email_template_status" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "published_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "email_templates_version_check" CHECK ("version" > 0),
    CONSTRAINT "email_templates_schema_version_check" CHECK ("schema_version" > 0)
);

CREATE TABLE "email_deliveries" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "notification_intent_id" TEXT,
    "template_id" TEXT,
    "template_key" "email_template_key" NOT NULL,
    "template_version" INTEGER,
    "smtp_profile_id" TEXT,
    "recipient_email" TEXT NOT NULL,
    "normalized_recipient_email" TEXT NOT NULL,
    "recipient_name" TEXT,
    "subject" TEXT NOT NULL,
    "status" "email_delivery_status" NOT NULL DEFAULT 'PENDING',
    "idempotency_key" TEXT,
    "provider" "email_provider" NOT NULL,
    "provider_message_id" TEXT,
    "queued_at" TIMESTAMP(3),
    "sending_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "deferred_at" TIMESTAMP(3),
    "bounced_at" TIMESTAMP(3),
    "complained_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "error_code" TEXT,
    "error_message" TEXT,
    "metadata_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "email_delivery_attempts" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "delivery_id" TEXT NOT NULL,
    "attempt_number" INTEGER NOT NULL,
    "status" "email_delivery_attempt_status" NOT NULL,
    "provider" "email_provider" NOT NULL,
    "provider_message_id" TEXT,
    "error_code" TEXT,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "metadata_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_delivery_attempts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "email_delivery_attempts_attempt_number_check" CHECK ("attempt_number" > 0)
);

CREATE TABLE "email_events" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "delivery_id" TEXT NOT NULL,
    "type" "email_event_type" NOT NULL,
    "provider" "email_provider" NOT NULL,
    "provider_message_id" TEXT,
    "reason_code" TEXT,
    "reason_text" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "metadata_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "email_settings_company_id_key" ON "email_settings"("company_id");
CREATE UNIQUE INDEX "email_settings_company_id_id_key" ON "email_settings"("company_id", "id");

CREATE UNIQUE INDEX "smtp_profiles_company_id_id_key" ON "smtp_profiles"("company_id", "id");
CREATE UNIQUE INDEX "smtp_profiles_company_id_name_key" ON "smtp_profiles"("company_id", "name");
CREATE INDEX "smtp_profiles_company_id_status_idx" ON "smtp_profiles"("company_id", "status");
CREATE INDEX "smtp_profiles_company_id_normalized_from_email_idx" ON "smtp_profiles"("company_id", "normalized_from_email");

CREATE UNIQUE INDEX "verified_sender_domains_company_id_id_key" ON "verified_sender_domains"("company_id", "id");
CREATE UNIQUE INDEX "verified_sender_domains_company_id_normalized_domain_key" ON "verified_sender_domains"("company_id", "normalized_domain");
CREATE INDEX "verified_sender_domains_company_id_status_idx" ON "verified_sender_domains"("company_id", "status");

CREATE UNIQUE INDEX "email_templates_company_id_id_key" ON "email_templates"("company_id", "id");
CREATE UNIQUE INDEX "email_templates_company_id_key_version_key" ON "email_templates"("company_id", "key", "version");
CREATE INDEX "email_templates_company_id_key_status_idx" ON "email_templates"("company_id", "key", "status");

CREATE UNIQUE INDEX "email_deliveries_company_id_id_key" ON "email_deliveries"("company_id", "id");
CREATE UNIQUE INDEX "email_deliveries_company_id_idempotency_key_key" ON "email_deliveries"("company_id", "idempotency_key");
CREATE INDEX "email_deliveries_company_id_status_created_at_idx" ON "email_deliveries"("company_id", "status", "created_at");
CREATE INDEX "email_deliveries_company_id_normalized_recipient_email_idx" ON "email_deliveries"("company_id", "normalized_recipient_email");
CREATE INDEX "email_deliveries_company_id_notification_intent_id_idx" ON "email_deliveries"("company_id", "notification_intent_id");

CREATE UNIQUE INDEX "email_delivery_attempts_company_id_id_key" ON "email_delivery_attempts"("company_id", "id");
CREATE UNIQUE INDEX "email_delivery_attempts_company_id_delivery_id_attempt_number_key" ON "email_delivery_attempts"("company_id", "delivery_id", "attempt_number");
CREATE INDEX "email_delivery_attempts_company_id_delivery_id_idx" ON "email_delivery_attempts"("company_id", "delivery_id");
CREATE INDEX "email_delivery_attempts_company_id_status_started_at_idx" ON "email_delivery_attempts"("company_id", "status", "started_at");

CREATE UNIQUE INDEX "email_events_company_id_id_key" ON "email_events"("company_id", "id");
CREATE INDEX "email_events_company_id_delivery_id_occurred_at_idx" ON "email_events"("company_id", "delivery_id", "occurred_at");
CREATE INDEX "email_events_company_id_type_occurred_at_idx" ON "email_events"("company_id", "type", "occurred_at");

ALTER TABLE "email_settings" ADD CONSTRAINT "email_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "smtp_profiles" ADD CONSTRAINT "smtp_profiles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "verified_sender_domains" ADD CONSTRAINT "verified_sender_domains_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "email_deliveries" ADD CONSTRAINT "email_deliveries_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "email_delivery_attempts" ADD CONSTRAINT "email_delivery_attempts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "email_delivery_attempts" ADD CONSTRAINT "email_delivery_attempts_company_id_delivery_id_fkey" FOREIGN KEY ("company_id", "delivery_id") REFERENCES "email_deliveries"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "email_events" ADD CONSTRAINT "email_events_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "email_events" ADD CONSTRAINT "email_events_company_id_delivery_id_fkey" FOREIGN KEY ("company_id", "delivery_id") REFERENCES "email_deliveries"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
