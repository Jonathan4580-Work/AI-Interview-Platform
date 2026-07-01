# Deployment and Rollback Runbook

## Scope

Phase 11 prepares deployment safety rules only. It does not perform production deployment or provision production infrastructure.

## Release Preconditions

- `npm run build`
- `npm run lint`
- `npm run test`
- `npm run format:check`
- `npm audit`
- `docker compose config --quiet`
- Prisma migration review for backward compatibility.
- Feature flag defaults reviewed.
- Worker compatibility reviewed.
- Synthetic interview smoke test passes.

## Zero-Downtime Migration Rules

- Prefer additive migrations.
- Add nullable columns before writing to them.
- Backfill separately from request/worker paths.
- Deploy readers that tolerate old and new shapes before making fields required.
- Do not drop columns or enum values until all deployed code no longer uses them.
- Irreversible migrations require explicit approval and forward-fix plan.

## Worker Deployment Safety

- Deploy workers that tolerate old and new workflow payload schemas.
- Queue payloads must contain IDs and safe metadata only.
- Drain workers before shutdown so active jobs finish when practical.
- Dead-letter jobs must be inspected with redacted payloads before replay.
- New processors must be idempotent before enabling.

## Rollback Process

1. Confirm rollback trigger and affected release.
2. Freeze risky exports, reprocessing, and destructive lifecycle jobs if data integrity is uncertain.
3. Drain web and worker traffic according to environment capability.
4. Roll back application image or forward-fix configuration.
5. Do not roll back irreversible migrations without explicit database recovery plan.
6. Run health checks and synthetic smoke checks.
7. Verify audit writes and tenant isolation.
8. Record rollback timeline and follow-up actions.

## Release Health Checks

- `/health`
- `/ready`
- Database connectivity.
- Redis connectivity.
- Queue depth and oldest job age.
- Audit write path.
- Candidate token exchange smoke.
- Workflow processing smoke with development providers in non-production.

## Phase 13 Launch Rollback Controls

Kill switches or disable actions required before external pilot:

- Candidate interviews: disable new interview starts while allowing compatible in-progress sessions to finish.
- Browser monitoring: set platform or tenant monitoring disable flag.
- AI evaluation: disable provider-bound evaluation workers or switch provider only outside production.
- Email delivery: switch tenant/platform email to disabled or preview where safe.
- Webhooks: disable subscriptions and pause webhook workers.
- ATS sync: disable integration connections and pause integration workers.
- SCIM: disable SCIM configuration and revoke tokens.
- SSO requirement: revert tenant login policy to local allowed while preserving break-glass admin.
- Exports: pause export workers and signed download issuance if leakage is suspected.
- Background workers: drain and stop affected worker classes.

Rollback verification:

- Web health passes.
- Worker queue depth stabilizes.
- Audit writes succeed.
- Tenant isolation smoke passes.
- Candidate communication is sent if interviews were interrupted.
- Provider integrations remain disabled until root cause review is complete.

## Preview and Staging Data Policy

- No production candidate recordings or transcripts in preview environments.
- Use deterministic fixtures or anonymized staging data.
- Managed secrets must be environment-scoped.
- Signed media/export URLs must not be copied into tickets or logs.

## Scheduled Job Ownership

- Only one scheduler owner per environment.
- Retention, exports, workflow replay, and notification workers must be idempotent.
- Disable scheduled destructive jobs during restore drills and incident containment.
