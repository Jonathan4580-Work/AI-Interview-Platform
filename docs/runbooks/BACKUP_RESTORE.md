# Backup and Restore Runbook

## Scope

This Phase 1 runbook defines the initial backup and restore posture for Aptly infrastructure. It covers PostgreSQL, Redis queue/session infrastructure, and object storage policy expectations. It does not cover candidate media, transcripts, exports, or legal hold workflows because those belong to later phases.

## Recovery Objectives

- PostgreSQL production RPO: 15 minutes.
- Core application RTO: 4 hours.
- Restore verification cadence before enterprise launch: at least daily in an isolated or staging-like environment.

## Data Classes in Phase 1

Phase 1 stores only foundation data:

- Companies.
- Platform users.
- Company users.
- Roles and permissions.
- Audit events.
- Idempotency keys.

Candidate, interview, recording, transcript, evaluation, export, legal hold, support access, and privacy request data are intentionally out of scope for Phase 1 implementation.

## PostgreSQL Backup Requirements

Production PostgreSQL must support:

- Automated base backups.
- Point-in-time recovery.
- Backup encryption at rest.
- Backup access restricted to production operators.
- Restore testing into an isolated environment.

Required backup metadata:

- Backup start time.
- Backup end time.
- WAL retention window.
- Environment.
- Database version.
- Restore test status.

## Restore Procedure

1. Identify target restore timestamp.
2. Confirm incident scope and expected data loss against the RPO.
3. Provision an isolated restore database.
4. Restore the latest base backup before the target timestamp.
5. Replay WAL to the target timestamp.
6. Run migration status checks.
7. Run application build and Prisma validation against restored configuration.
8. Run tenant isolation and audit write test suites.
9. Promote restored database only after operational approval.
10. Record restore result and timing.

## Redis Recovery Policy

Redis is recoverable infrastructure for queues, rate limits, locks, and short-lived state.

Phase 1 Redis expectations:

- Local Docker Redis uses append-only persistence for development.
- Production Redis persistence and failover must be selected before production deployment.
- BullMQ recovery behavior must be tested before candidate interview processing is implemented.

Redis data must not be the only durable record of business state. Durable workflow and audit state must live in PostgreSQL in later phases.

## Object Storage Policy

Object storage is not used by Phase 1 implementation. Before media, reports, or exports are implemented, production object storage must support:

- Versioning.
- Lifecycle policies.
- Server-side encryption.
- Signed URL access.
- Restore-aware deletion policy.

## Restore Verification Checklist

- PostgreSQL restore completes within target RTO.
- Prisma schema validation succeeds.
- Application health endpoint returns `ok`.
- Readiness endpoint returns `ok` when pointed at restored dependencies.
- Tenant-scoped access tests pass.
- Audit writer tests pass.
- No credentials or secrets are restored into logs or test artifacts.

## Rollback Guidance

For Phase 1:

- Prefer forward fixes for schema issues after production launch.
- Before production launch, failed migrations may be reset only in disposable development databases.
- Never delete audit events as part of rollback.
- Preserve migration files once committed.

## Open Items Before Production

- Choose managed PostgreSQL provider and PITR configuration.
- Define production backup retention period.
- Define production Redis persistence and failover mode.
- Define object storage backup and versioning settings.
- Automate restore verification.
- Add incident communication procedure.
