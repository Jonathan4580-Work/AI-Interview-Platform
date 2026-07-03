-- Phase 3 organization foundation: departments, teams, team memberships, and locations.

CREATE TYPE "department_status" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "team_status" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "team_member_role" AS ENUM ('LEAD', 'MEMBER');
CREATE TYPE "location_status" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "location_mode" AS ENUM ('ONSITE', 'HYBRID', 'REMOTE');

CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "status" "department_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "department_id" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "status" "team_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "team_members" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "team_member_role" NOT NULL DEFAULT 'MEMBER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "mode" "location_mode" NOT NULL,
    "status" "location_status" NOT NULL DEFAULT 'ACTIVE',
    "address_json" JSONB,
    "time_zone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "departments_company_id_id_key" ON "departments"("company_id", "id");
CREATE UNIQUE INDEX "departments_company_id_slug_key" ON "departments"("company_id", "slug");
CREATE INDEX "departments_company_id_status_idx" ON "departments"("company_id", "status");

CREATE UNIQUE INDEX "teams_company_id_id_key" ON "teams"("company_id", "id");
CREATE UNIQUE INDEX "teams_company_id_slug_key" ON "teams"("company_id", "slug");
CREATE INDEX "teams_company_id_department_id_idx" ON "teams"("company_id", "department_id");
CREATE INDEX "teams_company_id_status_idx" ON "teams"("company_id", "status");

CREATE UNIQUE INDEX "team_members_company_id_id_key" ON "team_members"("company_id", "id");
CREATE UNIQUE INDEX "team_members_company_id_team_id_user_id_key" ON "team_members"("company_id", "team_id", "user_id");
CREATE INDEX "team_members_company_id_user_id_idx" ON "team_members"("company_id", "user_id");

CREATE UNIQUE INDEX "locations_company_id_id_key" ON "locations"("company_id", "id");
CREATE UNIQUE INDEX "locations_company_id_slug_key" ON "locations"("company_id", "slug");
CREATE INDEX "locations_company_id_status_idx" ON "locations"("company_id", "status");
CREATE INDEX "locations_company_id_mode_idx" ON "locations"("company_id", "mode");

ALTER TABLE "departments" ADD CONSTRAINT "departments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "teams" ADD CONSTRAINT "teams_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "teams" ADD CONSTRAINT "teams_company_id_department_id_fkey" FOREIGN KEY ("company_id", "department_id") REFERENCES "departments"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_company_id_team_id_fkey" FOREIGN KEY ("company_id", "team_id") REFERENCES "teams"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_company_id_user_id_fkey" FOREIGN KEY ("company_id", "user_id") REFERENCES "users"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "locations" ADD CONSTRAINT "locations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
