-- Phase 3 candidate foundation: profiles, applications, documents, tags, notes, and merge records.

CREATE TYPE "candidate_status" AS ENUM ('ACTIVE', 'ARCHIVED', 'MERGED');
CREATE TYPE "candidate_source_type" AS ENUM ('MANUAL', 'REFERRAL', 'IMPORT', 'APPLICATION', 'INVITATION');
CREATE TYPE "application_status" AS ENUM ('NEW', 'IN_REVIEW', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED', 'WITHDRAWN', 'ARCHIVED');
CREATE TYPE "candidate_document_type" AS ENUM ('RESUME', 'COVER_LETTER', 'PORTFOLIO', 'OTHER');
CREATE TYPE "candidate_document_status" AS ENUM ('ACTIVE', 'DELETED');
CREATE TYPE "candidate_tag_status" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "candidate_note_visibility" AS ENUM ('INTERNAL', 'PRIVATE');
CREATE TYPE "candidate_note_status" AS ENUM ('ACTIVE', 'DELETED');

CREATE TABLE "candidates" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "primary_email" TEXT,
    "normalized_email" TEXT,
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "source_type" "candidate_source_type" NOT NULL DEFAULT 'MANUAL',
    "source_label" TEXT,
    "status" "candidate_status" NOT NULL DEFAULT 'ACTIVE',
    "profile_json" JSONB NOT NULL,
    "merged_into_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "candidate_applications" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "current_stage_id" TEXT,
    "status" "application_status" NOT NULL DEFAULT 'NEW',
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rejected_at" TIMESTAMP(3),
    "hired_at" TIMESTAMP(3),
    "metadata_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "candidate_applications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "candidate_documents" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "type" "candidate_document_type" NOT NULL,
    "status" "candidate_document_status" NOT NULL DEFAULT 'ACTIVE',
    "file_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "checksum_sha256" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "candidate_documents_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "candidate_documents_size_bytes_check" CHECK ("size_bytes" > 0)
);

CREATE TABLE "candidate_tags" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "color" TEXT,
    "status" "candidate_tag_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "candidate_tags_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "candidate_tag_assignments" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidate_tag_assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "candidate_notes" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "author_user_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "visibility" "candidate_note_visibility" NOT NULL DEFAULT 'INTERNAL',
    "status" "candidate_note_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "candidate_notes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "candidate_merge_events" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "source_candidate_id" TEXT NOT NULL,
    "target_candidate_id" TEXT NOT NULL,
    "merged_by_user_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "metadata_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidate_merge_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "candidate_merge_events_distinct_candidates_check" CHECK ("source_candidate_id" <> "target_candidate_id")
);

CREATE UNIQUE INDEX "candidates_company_id_id_key" ON "candidates"("company_id", "id");
CREATE UNIQUE INDEX "candidates_company_id_normalized_email_key" ON "candidates"("company_id", "normalized_email");
CREATE INDEX "candidates_company_id_status_idx" ON "candidates"("company_id", "status");
CREATE INDEX "candidates_company_id_full_name_idx" ON "candidates"("company_id", "full_name");

CREATE UNIQUE INDEX "candidate_applications_company_id_id_key" ON "candidate_applications"("company_id", "id");
CREATE UNIQUE INDEX "candidate_applications_company_id_candidate_id_job_id_key" ON "candidate_applications"("company_id", "candidate_id", "job_id");
CREATE INDEX "candidate_applications_company_id_job_id_status_idx" ON "candidate_applications"("company_id", "job_id", "status");
CREATE INDEX "candidate_applications_company_id_candidate_id_idx" ON "candidate_applications"("company_id", "candidate_id");
CREATE INDEX "candidate_applications_company_id_current_stage_id_idx" ON "candidate_applications"("company_id", "current_stage_id");

CREATE UNIQUE INDEX "candidate_documents_company_id_id_key" ON "candidate_documents"("company_id", "id");
CREATE UNIQUE INDEX "candidate_documents_company_id_storage_key_key" ON "candidate_documents"("company_id", "storage_key");
CREATE INDEX "candidate_documents_company_id_candidate_id_status_idx" ON "candidate_documents"("company_id", "candidate_id", "status");

CREATE UNIQUE INDEX "candidate_tags_company_id_id_key" ON "candidate_tags"("company_id", "id");
CREATE UNIQUE INDEX "candidate_tags_company_id_slug_key" ON "candidate_tags"("company_id", "slug");
CREATE INDEX "candidate_tags_company_id_status_idx" ON "candidate_tags"("company_id", "status");

CREATE UNIQUE INDEX "candidate_tag_assignments_company_id_id_key" ON "candidate_tag_assignments"("company_id", "id");
CREATE UNIQUE INDEX "candidate_tag_assignments_company_id_candidate_id_tag_id_key" ON "candidate_tag_assignments"("company_id", "candidate_id", "tag_id");
CREATE INDEX "candidate_tag_assignments_company_id_tag_id_idx" ON "candidate_tag_assignments"("company_id", "tag_id");

CREATE UNIQUE INDEX "candidate_notes_company_id_id_key" ON "candidate_notes"("company_id", "id");
CREATE INDEX "candidate_notes_company_id_candidate_id_status_idx" ON "candidate_notes"("company_id", "candidate_id", "status");
CREATE INDEX "candidate_notes_company_id_author_user_id_idx" ON "candidate_notes"("company_id", "author_user_id");

CREATE UNIQUE INDEX "candidate_merge_events_company_id_id_key" ON "candidate_merge_events"("company_id", "id");
CREATE INDEX "candidate_merge_events_company_id_source_candidate_id_idx" ON "candidate_merge_events"("company_id", "source_candidate_id");
CREATE INDEX "candidate_merge_events_company_id_target_candidate_id_idx" ON "candidate_merge_events"("company_id", "target_candidate_id");

ALTER TABLE "candidates" ADD CONSTRAINT "candidates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_company_id_merged_into_id_fkey" FOREIGN KEY ("company_id", "merged_into_id") REFERENCES "candidates"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "candidate_applications" ADD CONSTRAINT "candidate_applications_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "candidate_applications" ADD CONSTRAINT "candidate_applications_company_id_candidate_id_fkey" FOREIGN KEY ("company_id", "candidate_id") REFERENCES "candidates"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "candidate_applications" ADD CONSTRAINT "candidate_applications_company_id_job_id_fkey" FOREIGN KEY ("company_id", "job_id") REFERENCES "jobs"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "candidate_applications" ADD CONSTRAINT "candidate_applications_company_id_current_stage_id_fkey" FOREIGN KEY ("company_id", "current_stage_id") REFERENCES "pipeline_stages"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "candidate_documents" ADD CONSTRAINT "candidate_documents_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "candidate_documents" ADD CONSTRAINT "candidate_documents_company_id_candidate_id_fkey" FOREIGN KEY ("company_id", "candidate_id") REFERENCES "candidates"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "candidate_tags" ADD CONSTRAINT "candidate_tags_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "candidate_tag_assignments" ADD CONSTRAINT "candidate_tag_assignments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "candidate_tag_assignments" ADD CONSTRAINT "candidate_tag_assignments_company_id_candidate_id_fkey" FOREIGN KEY ("company_id", "candidate_id") REFERENCES "candidates"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "candidate_tag_assignments" ADD CONSTRAINT "candidate_tag_assignments_company_id_tag_id_fkey" FOREIGN KEY ("company_id", "tag_id") REFERENCES "candidate_tags"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "candidate_notes" ADD CONSTRAINT "candidate_notes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "candidate_notes" ADD CONSTRAINT "candidate_notes_company_id_candidate_id_fkey" FOREIGN KEY ("company_id", "candidate_id") REFERENCES "candidates"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "candidate_notes" ADD CONSTRAINT "candidate_notes_company_id_author_user_id_fkey" FOREIGN KEY ("company_id", "author_user_id") REFERENCES "users"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "candidate_merge_events" ADD CONSTRAINT "candidate_merge_events_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "candidate_merge_events" ADD CONSTRAINT "candidate_merge_events_company_id_source_candidate_id_fkey" FOREIGN KEY ("company_id", "source_candidate_id") REFERENCES "candidates"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "candidate_merge_events" ADD CONSTRAINT "candidate_merge_events_company_id_target_candidate_id_fkey" FOREIGN KEY ("company_id", "target_candidate_id") REFERENCES "candidates"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "candidate_merge_events" ADD CONSTRAINT "candidate_merge_events_company_id_merged_by_user_id_fkey" FOREIGN KEY ("company_id", "merged_by_user_id") REFERENCES "users"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "privacy_requests" ADD CONSTRAINT "privacy_requests_company_id_candidate_id_fkey" FOREIGN KEY ("company_id", "candidate_id") REFERENCES "candidates"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
