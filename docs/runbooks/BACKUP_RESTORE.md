# Backup and Restore Runbook

## Scope

This Phase 11 runbook covers operational recovery for Aptly data stores used through Phase 10:

- PostgreSQL system of record.
- S3-compatible object storage for media and exports.
- Redis/BullMQ ephemeral queue infrastructure.
- Environment configuration and managed secret references.

Redis queue state, signed URLs, candidate sessions, and rate-limit buckets are recoverable operational state, not the durable business record. PostgreSQL and object storage are the recovery anchors.

## Recovery Objectives

- PostgreSQL RPO: 15 minutes through managed PITR/WAL archiving.
- Production pilot RTO: 4 hours for core application restoration.
- Restore drill cadence before production pilot: weekly, then at least monthly after launch.

## PostgreSQL Backup Procedure

Use managed base backups and WAL archiving in production. For local or isolated drills, run:

```powershell
$env:DATABASE_URL = "<source database url>"
.\scripts\backup-postgres.ps1 -OutputPath ".\tmp\aptly-backup.dump"
```

The script runs `pg_dump --format=custom --no-owner --no-acl` and writes a restorable dump without embedding credentials in the artifact.

## PostgreSQL Restore Procedure

Always restore into an isolated database first.

```powershell
$env:RESTORE_DATABASE_URL = "<isolated restore database url>"
.\scripts\restore-postgres.ps1 -BackupPath ".\tmp\aptly-backup.dump" -Clean
$env:DATABASE_URL = $env:RESTORE_DATABASE_URL
.\scripts\verify-restore.ps1
```

Verification runs Prisma validation plus tenant-isolation and audit-redaction tests. A production restore must also run smoke tests, health checks, and operator review before traffic is shifted.

## Object Storage Recovery

Production object storage must enable:

- Bucket versioning.
- Server-side encryption.
- Restricted operator access.
- Lifecycle rules aligned to retention classes.
- Legal-hold-aware deletion blocking.

Recover objects before running workflows that require media, reports, or exports. Signed upload/download URLs are never persisted and must be regenerated after restore.

## Redis and BullMQ Recovery

Redis is not authoritative for durable workflow state.

- Restore or recreate Redis according to provider failover procedures.
- Drain old workers before connecting restored workers.
- Requeue eligible workflow steps from PostgreSQL workflow state.
- Treat jobs without matching PostgreSQL workflow/step records as orphaned and discard them.

## Secret and Configuration Recovery

- Restore environment configuration from the approved secret manager, not from database backups.
- SMTP passwords, provider API keys, and object-storage credentials must remain managed secrets.
- PostgreSQL stores secret references only.

## Restore Sequencing

1. Open incident and freeze destructive operations when data integrity is uncertain.
2. Restore PostgreSQL to the chosen timestamp or dump into an isolated environment.
3. Restore object storage versions needed for the same timestamp.
4. Restore configuration and managed secret references.
5. Start Redis/BullMQ in clean or restored mode.
6. Run `.\scripts\verify-restore.ps1`.
7. Run synthetic interview smoke tests.
8. Validate tenant isolation, audit writes, media access, exports, and results retrieval.
9. Obtain operational approval before promotion.
10. Record RPO/RTO achieved and any data loss.

## Tenant-Level Restore Limitations

Aptly does not support self-service tenant-level point-in-time restore in Phase 11. Tenant-level recovery requires a controlled isolated restore, export of approved records, legal/privacy review, and a forward migration or repair plan.

## Local Drill Result

Phase 11 added executable backup, restore, and verification scripts. The local environment can validate command structure and verification checks. A full data restore drill requires `pg_dump`, `pg_restore`, and an isolated PostgreSQL target with compatible extensions and credentials.

## Phase 13 Production Validation

Status: procedure prepared; managed-infrastructure drill not performed.

Production launch requires:

1. Managed PostgreSQL PITR enabled.
2. Backup storage configured with restricted access.
3. Object-storage versioning and lifecycle policies enabled.
4. Isolated restore environment available.
5. Restore drill from latest backup or PITR timestamp.
6. Schema verification.
7. Critical row-count verification.
8. Tenant-scoped record verification.
9. Application readiness against restored data.
10. Synthetic interview smoke against restored environment where safe.

Do not claim the 15-minute RPO or 4-hour RTO is proven until a timed managed-infrastructure drill records actual backup age, restore duration, verification duration, and any manual recovery steps.

Production restore evidence to capture:

- Backup timestamp.
- Restore start/end.
- Schema verification result.
- Tenant isolation test result.
- Object-storage recovery notes.
- Redis/queue recreation steps.
- RPO achieved.
- RTO achieved.
- Operator approval.

## Rollback Guidance

- Prefer forward fixes after production launch.
- Do not delete audit events during rollback.
- Do not reuse signed URLs after restore.
- Irreversible migrations require a forward-fix plan and explicit release approval.
