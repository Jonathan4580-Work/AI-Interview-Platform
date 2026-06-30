# Phase 11 Hardening Review

## Summary

Phase 11 hardened Aptly for a production pilot without adding Phase 12 integrations or Phase 13 deployment work. The review covered security, tenant isolation, audit integrity, data retention, privacy requests, backup/restore, observability, alerting, accessibility, performance boundaries, and synthetic smoke verification.

## Findings and Severity

| Severity | Area                 | Finding                                                                                                                                               |
| -------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1       | Rate limiting        | In-memory limiter lacked a hard bucket cap and allowed oversized key components.                                                                      |
| P1       | Browser/API security | API responses did not consistently inherit sensitive `no-store` headers.                                                                              |
| P1       | Audit privacy        | Audit redaction missed Phase 9/10 sensitive metadata keys.                                                                                            |
| P1       | Worker safety        | Worker draining did not wait for active jobs during graceful shutdown.                                                                                |
| P2       | Tenant isolation     | Tenant guardrails existed in services but there was no full-suite schema guardrail across current tenant-owned models.                                |
| P2       | Retention            | Retention policy did not cover all Phase 5-10 data classes.                                                                                           |
| P2       | Privacy requests     | Privacy request lifecycle lacked controlled status transitions.                                                                                       |
| P2       | Observability        | Metric definitions and alert thresholds were not documented with PII/cardinality guardrails.                                                          |
| P2       | Operations           | Backup/restore documentation was Phase 1-era and did not cover current media, transcript, export, workflow, privacy, and object-storage expectations. |

## Fixes Applied

- Bounded `MemoryRateLimiter` bucket growth and hashed oversized key components.
- Added API `no-store`, `pragma`, and `expires` headers through the shared handler.
- Expanded CSP and browser protection headers while preserving candidate camera/microphone flow.
- Expanded audit redaction for transcript text, prompts, evidence excerpts, provider payloads, email bodies, signed/export/media URLs, and raw responses.
- Added tenant-owned Prisma schema guardrail tests for users, org records, candidates, sessions, interviews, media, monitoring, transcripts, evaluations, reports, exports, email, support access, privacy, and workflows.
- Extended retention policy coverage and deletion eligibility helpers.
- Added privacy request lifecycle transitions.
- Added PostgreSQL backup, restore, and restore verification scripts plus updated runbook.
- Added low-cardinality metric catalog and alert runbook.
- Fixed worker graceful shutdown to drain active jobs before close.
- Added deterministic synthetic interview smoke test.
- Added accessibility audit report and performance/load-test report.
- Added incident response and deployment/rollback runbooks.

## Verification

- Build: passed.
- Lint: passed.
- Tests: passed.
- Format check: passed.
- `npm audit`: zero vulnerabilities.
- Docker config: passed.
- Focused checks: tenant isolation, audit redaction, retention/legal hold, privacy lifecycle, backup/restore scripts, observability alerts, queue draining, synthetic interview smoke, accessibility audit, and performance boundaries.

## Backup and Restore Drill

Executable local procedures were added:

- `scripts/backup-postgres.ps1`
- `scripts/restore-postgres.ps1`
- `scripts/verify-restore.ps1`

The repository validates script structure and restore verification commands. A full restore drill still requires a local or staging PostgreSQL restore target with `pg_dump` and `pg_restore` available.

## Accessibility Results

Automated accessibility-critical test coverage remains green. Manual browser and assistive technology checks still required:

- NVDA, JAWS, VoiceOver.
- Real camera/microphone denial recovery.
- Keyboard-only full interview.
- Reduced-motion media states.
- Final production tenant-brand contrast review.

## Performance Results

Phase 11 verifies service-level performance boundaries:

- Bounded rate-limit state.
- Deterministic search cursor pagination.
- Bounded report ranges and dimensions.
- Async aggregate report request path.
- Export formula-injection protection.
- Queue payload redaction and worker drain ordering.

Large-data query-plan validation remains a Phase 13 staging task.

## Remaining Accepted Risks

- In-memory rate limiting is not horizontally shared and must be replaced or backed by Redis/edge controls before scaled production.
- DeepSeek live API behavior requires staging validation with a real key.
- Object-storage restore and media latency testing require staging infrastructure.
- Full scheduled retention deletion workers remain future operational work.
- Manual accessibility testing remains required before production pilot.

## Phase 12 Prerequisites

- Review and approve this Phase 11 hardening report.
- Confirm staging environment availability for integration work.
- Keep SSO, SCIM, ATS, and external webhook work in Phase 12 only.
- Keep production deployment and infrastructure provisioning in Phase 13.

## Approval

Phase 11 is approved for Phase 12 from an implementation-readiness perspective, pending user review.
