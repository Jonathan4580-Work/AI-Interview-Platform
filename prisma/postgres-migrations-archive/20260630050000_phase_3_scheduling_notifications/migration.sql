-- Phase 3 scheduling and notification intent foundations.

CREATE TYPE "schedule_event_type" AS ENUM ('INTERVIEW', 'DEADLINE', 'REMINDER');
CREATE TYPE "schedule_event_status" AS ENUM ('SCHEDULED', 'CANCELLED', 'COMPLETED');
CREATE TYPE "calendar_provider" AS ENUM ('INTERNAL', 'GOOGLE', 'MICROSOFT');
CREATE TYPE "schedule_participant_type" AS ENUM ('CANDIDATE', 'USER', 'EXTERNAL');
CREATE TYPE "schedule_response_status" AS ENUM ('NEEDS_ACTION', 'ACCEPTED', 'DECLINED', 'TENTATIVE');
CREATE TYPE "notification_intent_type" AS ENUM ('INVITATION_CREATED', 'INVITATION_REMINDER', 'SCHEDULE_CREATED', 'SCHEDULE_UPDATED');
CREATE TYPE "notification_channel" AS ENUM ('EMAIL');
CREATE TYPE "notification_intent_status" AS ENUM ('PENDING', 'CANCELLED', 'DISPATCHED', 'FAILED');

CREATE TABLE "schedule_events" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "type" "schedule_event_type" NOT NULL,
    "status" "schedule_event_status" NOT NULL DEFAULT 'SCHEDULED',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "time_zone" TEXT NOT NULL,
    "provider" "calendar_provider" NOT NULL DEFAULT 'INTERNAL',
    "provider_event_ref" TEXT,
    "target_resource_type" TEXT,
    "target_resource_id" TEXT,
    "metadata_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "cancelled_at" TIMESTAMP(3),

    CONSTRAINT "schedule_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "schedule_events_time_range_check" CHECK ("ends_at" > "starts_at")
);

CREATE TABLE "schedule_participants" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "schedule_event_id" TEXT NOT NULL,
    "type" "schedule_participant_type" NOT NULL,
    "display_name" TEXT NOT NULL,
    "email" TEXT,
    "user_id" TEXT,
    "candidate_id" TEXT,
    "response_status" "schedule_response_status" NOT NULL DEFAULT 'NEEDS_ACTION',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_participants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notification_intents" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "type" "notification_intent_type" NOT NULL,
    "channel" "notification_channel" NOT NULL,
    "status" "notification_intent_status" NOT NULL DEFAULT 'PENDING',
    "recipient_email" TEXT NOT NULL,
    "recipient_name" TEXT,
    "target_resource_type" TEXT NOT NULL,
    "target_resource_id" TEXT NOT NULL,
    "payload_json" JSONB NOT NULL,
    "scheduled_for" TIMESTAMP(3),
    "dispatched_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_intents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "schedule_events_company_id_id_key" ON "schedule_events"("company_id", "id");
CREATE INDEX "schedule_events_company_id_status_starts_at_idx" ON "schedule_events"("company_id", "status", "starts_at");
CREATE INDEX "schedule_events_company_id_target_resource_type_target_resource_id_idx" ON "schedule_events"("company_id", "target_resource_type", "target_resource_id");

CREATE UNIQUE INDEX "schedule_participants_company_id_id_key" ON "schedule_participants"("company_id", "id");
CREATE INDEX "schedule_participants_company_id_schedule_event_id_idx" ON "schedule_participants"("company_id", "schedule_event_id");
CREATE INDEX "schedule_participants_company_id_user_id_idx" ON "schedule_participants"("company_id", "user_id");
CREATE INDEX "schedule_participants_company_id_candidate_id_idx" ON "schedule_participants"("company_id", "candidate_id");

CREATE UNIQUE INDEX "notification_intents_company_id_id_key" ON "notification_intents"("company_id", "id");
CREATE INDEX "notification_intents_company_id_status_scheduled_for_idx" ON "notification_intents"("company_id", "status", "scheduled_for");
CREATE INDEX "notification_intents_company_id_target_resource_type_target_resource_id_idx" ON "notification_intents"("company_id", "target_resource_type", "target_resource_id");

ALTER TABLE "schedule_events" ADD CONSTRAINT "schedule_events_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "schedule_participants" ADD CONSTRAINT "schedule_participants_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "schedule_participants" ADD CONSTRAINT "schedule_participants_company_id_schedule_event_id_fkey" FOREIGN KEY ("company_id", "schedule_event_id") REFERENCES "schedule_events"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_intents" ADD CONSTRAINT "notification_intents_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
