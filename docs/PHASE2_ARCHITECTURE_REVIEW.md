# Phase 2 Architecture Review

## Review Scope

This review covers the repository after Phase 1 Foundation and Phase 2 Enterprise Control Plane. It evaluates architecture only. No Phase 3 product functionality was implemented.

Reviewed areas:

- Module boundaries and dependency direction.
- Tenant isolation and tenant-scoped persistence.
- RBAC consistency.
- Prisma schema quality, normalization, and indexing.
- Security and audit posture.
- Error handling and logging consistency.
- Docker and environment configuration.
- Test coverage and scalability risks.

## Summary Verdict

The repository is approved to proceed to Phase 3 after the architectural hardening changes listed below.

No blocking tenant isolation, security, or schema findings remain in the Phase 1 and Phase 2 foundation. The codebase is still intentionally small, but the current shape is suitable for building Phase 3 company and HR workspace functionality as long as the remaining recommendations are addressed before the relevant modules depend on them.

## Improvements Made

### RBAC Catalog Alignment

Finding:

- The Support Access Module had its own permission string namespace (`platform.support_access.*`) that was not represented in the central RBAC permission catalog.
- This created a future risk where Phase 3 route handlers or platform admin services could enforce different permission names than the access-control module recognizes.

Improvement:

- Added Phase 2 control-plane permissions to the central `permissionKeys` catalog:
  - `support_access:read`
  - `support_access:manage`
  - `legal_holds:read`
  - `legal_holds:manage`
  - `privacy_requests:read`
  - `privacy_requests:manage`
  - `exports:read`
  - `exports:manage`
  - `entitlements:read`
  - `entitlements:manage`
- Updated Support Access permission constants to satisfy the central `PermissionKey` type.
- Added a test proving Support Access permissions remain in the central catalog.

### Tenant-Qualified Unique Identities

Finding:

- Several Phase 2 tenant-owned tables had `companyId` and tenant-leading indexes, but lacked `@@unique([companyId, id])`.
- The Phase 1 `users` and `roles` tables already use tenant-qualified composite uniqueness to support tenant-safe joins. Phase 2 tables should follow the same pattern before later modules add cross-table references.

Improvement:

- Added `@@unique([companyId, id])` to tenant-owned Phase 2 tables:
  - `company_settings`
  - `subscriptions`
  - `entitlements`
  - `usage_counters`
  - `support_access_sessions`
  - `legal_holds`
  - `privacy_requests`
  - `export_requests`
- Added migration `20260630000000_phase_2_architecture_hardening`.
- Applied the migration successfully against the local test database.

## Findings

### Layering And Module Boundaries

Status: acceptable with recommendations.

- Direct Prisma usage is contained to Prisma store adapters and the readiness health route.
- Domain services depend on store interfaces rather than Prisma directly.
- Implemented modules expose public `index.ts` entrypoints.
- Tests currently import public module entrypoints for most domain usage.

Remaining risk:

- `src/modules/README.md` says internal implementation should live under `internal/`, but current modules use flat files such as `service.ts` and `prisma-*-store.ts`.
- This is not a functional defect yet, but Phase 3 will increase module surface area quickly.

Recommendation before or during early Phase 3:

- Either enforce the documented `internal/` folder convention or update the module README to match the chosen convention.
- Add an ESLint import-boundary rule before modules become larger.

### Circular Dependencies

Status: no circular dependency found in implemented code.

- The implemented services follow a mostly acyclic dependency graph:
  - Domain services depend on tenant, audit, identity, and shared types.
  - Prisma stores depend on infra/database.
  - Shared helpers do not depend on business modules except tenant typing where currently required.

Remaining risk:

- `shared/repositories` imports tenant assertions from the Tenant Module. This is practical now, but it means `shared` is not fully domain-agnostic.

Recommendation:

- Keep this dependency under review. If shared grows, consider moving tenant assertion primitives into `shared/tenant` or keeping tenant-scoped repository helpers explicitly under the Tenant Module.

### Tenant Isolation

Status: strong for Phase 1 and Phase 2.

- Tenant-owned tables include `companyId`.
- Tenant-leading indexes exist on operational query paths.
- Phase 1 user-role joins use tenant-qualified composite foreign keys.
- Phase 2 now has tenant-qualified unique identities to support future composite references.
- Company-visible support access history is tenant-scoped.
- Legal hold release uses tenant-scoped `updateMany` before re-reading the row.

Remaining risk:

- Some platform-owned operations, such as ending support access by session ID, are intentionally global. Later route handlers must enforce platform permissions and reason context before calling them.

Recommendation:

- For Phase 3 route handlers and services, require tests for cross-tenant denial on every tenant-owned resource introduced.

### Security And Audit

Status: adequate for current phase.

- Support access start/end events are audited at critical risk level.
- Audit records carry request, correlation, session, reason, before/after, and support access context.
- Audit redaction covers token, secret, secret reference, and signed URL style fields.
- Magic link and candidate session functionality has not been implemented yet, so no candidate-token surface exists.

Remaining risk:

- Audit immutability is application-level only. Database role restrictions and optional external immutable sinks are still future hardening work.
- Generic `Error` is still used in a few foundation helpers.

Recommendation:

- Before sensitive Phase 3 admin routes are exposed, introduce a small application error base type with safe public error codes.
- Before production, enforce audit update/delete restrictions with database privileges or an append-only pattern.

### RBAC Consistency

Status: improved and acceptable.

- Phase 2 control-plane permission keys now live in the central RBAC catalog.
- Support Access permission constants now satisfy the shared `PermissionKey` type.

Remaining risk:

- No platform role-to-permission mapping exists yet. This is acceptable because platform admin UI/API implementation is not part of Phase 2.

Recommendation:

- In Phase 3 or the first platform admin implementation phase, add explicit role templates for support, compliance, operations, and super admin.

### Prisma Schema Quality

Status: good for current scope.

- Tenant-owned models are consistently mapped to snake_case table names and columns.
- Composite tenant uniqueness now exists for Phase 2 tenant records.
- JSON fields are limited to configuration or versioned metadata in current implemented scope.
- FK `onDelete: Restrict` is used for tenant root records and sensitive control-plane records.

Remaining risk:

- `company_settings` groups unrelated JSON blobs. This is acceptable for configuration foundation, but individual settings may need normalization as real workflows appear.
- `privacy_requests.candidateId` is nullable and not yet a foreign key because the candidate model is Phase 3.

Recommendation:

- When candidates are implemented, add a tenant-qualified FK from `privacy_requests(companyId, candidateId)` to candidates if the final candidate schema supports it.
- Avoid expanding JSON blobs into core workflow state; normalize values that need reporting, filtering, or audit queries.

### Database Indexing

Status: adequate for Phase 2.

- Current indexes support tenant/status history queries, support access expiration, entitlement lookup, usage period lookup, and audit lookups.
- Added composite tenant unique indexes improve future schema safety.

Remaining risk:

- Append-heavy tables such as audit events are not physically partitioned yet.

Recommendation:

- Before high-volume candidate/interview ingestion, revisit time partition compatibility for audit events, monitoring events, transcript segments, email deliveries, job runs, and analytics events.

### Naming And Folder Organization

Status: mostly consistent.

- Module names match documentation.
- Database maps use snake_case.
- TypeScript domain values use lower-case string unions.
- Prisma enums use upper-case values.

Remaining risk:

- Permission naming now uses colon-separated product permissions. Keep all future permissions in that style.
- Flat module files are easy to navigate now, but may get noisy in Phase 3.

Recommendation:

- Introduce `domain/`, `application/`, and `persistence/` folders only when a module grows enough to need them. Do not prematurely split tiny modules.

### Logging And Observability

Status: acceptable baseline.

- Pino logging is configured centrally with redaction.
- Health and readiness endpoints exist.
- Request and correlation IDs are sanitized.

Remaining risk:

- Domain services do not yet emit structured operational logs. That is acceptable before real workflows exist.
- Queue/job observability is still skeletal because durable workflow execution is later.

Recommendation:

- When Phase 3 adds user-facing routes, log security-relevant denials and audit-write failures with request/correlation IDs.

### Error Handling

Status: acceptable with a known consistency gap.

- Phase 2 modules define domain-specific errors for support access, privacy requests, retention, legal holds, entitlements, and exports.
- Some Phase 1 helpers still throw generic `Error`.

Recommendation:

- Add a shared safe application error type before public APIs grow.
- Route handlers should map internal/domain errors to stable API error codes without leaking implementation details.

### Test Coverage

Status: good for current foundation.

- Tests cover tenant helpers, request context sanitization, audit redaction, RBAC checks, idempotency, health snapshots, support access, privacy requests, legal holds, retention, entitlements, and export request validation.

Remaining gaps:

- No integration tests currently seed Prisma data and verify tenant-qualified database constraints across Phase 2 tables.
- No automated architectural import-boundary check exists.

Recommendation:

- Add integration tests around real Prisma stores before Phase 3 route handlers depend on them.
- Add import-boundary lint rules before implementing larger modules.

### Docker And Environment Configuration

Status: acceptable for local foundation.

- Docker Compose provides web, worker, PostgreSQL, and Redis.
- PostgreSQL and Redis health checks exist.
- Environment validation is present through `src/config/env.ts`.

Remaining risk:

- The Docker image still defaults to development commands and is not a production deployment image.
- Secrets are represented by references, but no managed secret provider is integrated yet.

Recommendation:

- Before production hardening, split development and production Docker targets or commands.
- Keep `.env.example` free of real secrets and continue using secret references only.

### Scalability And Performance

Status: suitable for Phase 2.

- Current services do not perform high-volume reads or writes.
- Query patterns are tenant-scoped and index-supported.

Remaining risks:

- Audit, monitoring, transcript, email, job, and analytics tables will need partitioning or archival planning before volume-heavy phases.
- BullMQ worker topology is still a placeholder until workflow phases begin.

Recommendation:

- Do not add synchronous heavy reporting or search in Phase 3.
- Keep expensive export/report/search workflows asynchronous once implemented.

## Remaining Risks Before Phase 3

1. Import-boundary rules are documented but not enforced by tooling.
2. Platform role-to-permission mapping is not implemented yet.
3. Prisma store integration tests are still thin.
4. Audit immutability is not enforced at the database privilege level.
5. Error handling lacks a shared safe API error abstraction.
6. Docker remains development-oriented.

## Recommendations Before Phase 3

Phase 3 may begin with the current foundation, but the following should be done early in Phase 3:

1. Add import-boundary lint enforcement or a lightweight architecture test.
2. Add Prisma integration tests for company settings, support access, legal holds, privacy requests, exports, entitlements, and usage counters.
3. Define platform role templates for support, compliance, operations, and super admin.
4. Add a shared application error abstraction before public route handlers expand.
5. Keep all new tenant-owned tables aligned with the `companyId` plus tenant-qualified uniqueness pattern.
6. Avoid implementing dashboards or workflows that bypass the existing domain services and stores.

## Final Approval

After the RBAC catalog alignment and tenant-qualified schema hardening, the repository is approved for Phase 3 from an architecture perspective.
