-- Add tenant-qualified unique identities for Phase 2 tenant-owned tables.
-- These indexes support safer future composite foreign keys and tenant-scoped selectors.

CREATE UNIQUE INDEX "company_settings_company_id_id_key" ON "company_settings"("company_id", "id");

CREATE UNIQUE INDEX "subscriptions_company_id_id_key" ON "subscriptions"("company_id", "id");

CREATE UNIQUE INDEX "entitlements_company_id_id_key" ON "entitlements"("company_id", "id");

CREATE UNIQUE INDEX "usage_counters_company_id_id_key" ON "usage_counters"("company_id", "id");

CREATE UNIQUE INDEX "support_access_sessions_company_id_id_key" ON "support_access_sessions"("company_id", "id");

CREATE UNIQUE INDEX "legal_holds_company_id_id_key" ON "legal_holds"("company_id", "id");

CREATE UNIQUE INDEX "privacy_requests_company_id_id_key" ON "privacy_requests"("company_id", "id");

CREATE UNIQUE INDEX "export_requests_company_id_id_key" ON "export_requests"("company_id", "id");
