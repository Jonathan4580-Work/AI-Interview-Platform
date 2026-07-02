# Production Deployment

## Status

Implemented: web Dockerfile, dedicated worker Dockerfile, migrator target, production compose template, healthcheck scripts, CI foundation, environment validation.

Not performed: image registry publication, staging deployment, production deployment, live migration, DNS/TLS validation, or provider connection.

## Deployment Units

- Web image target: `runner`.
- Migration image target: `migrator`.
- Web command: `node .next/standalone/server.js`.
- Worker Dockerfile: `Dockerfile.worker`.
- Worker command: `npm run worker:prod`.

Build locally:

```powershell
docker build --target runner -t aptly:<commit> .
docker build --target migrator -t aptly-migrator:<commit> .
docker build -f Dockerfile.worker -t aptly-worker:<commit> .
```

Validate production compose template:

```powershell
$env:APTLY_IMAGE = "aptly:<commit>"
docker compose -f docker-compose.production.example.yml config --quiet
```

## Deployment Sequence

1. Confirm go/no-go checklist.
2. Build and scan image.
3. Publish image to approved registry.
4. Create pre-deployment PostgreSQL backup.
5. Run migration job once using the migrator target.
6. Verify migration state.
7. Deploy web service.
8. Deploy workers one class at a time.
9. Run health and readiness checks.
10. Run synthetic smoke flow.
11. Enable provider integrations only after service health is stable.

## Database Migration Procedure

Initial and incremental production migrations:

```powershell
npm.cmd run migrate:deploy
```

Production rules:

- Run migrations from exactly one job.
- Use a migration database role separate from runtime where practical.
- Take a backup before migration.
- Prefer additive migrations.
- Do not drop columns or enum values while old workers may still reference them.
- Failed irreversible migrations require forward-fix approval, not blind rollback.

## Worker Rollout

Worker classes:

- Email.
- Orchestration.
- Media.
- Transcription.
- Evaluation.
- Reporting.
- Exports.
- Retention.
- Integrations.
- Webhooks.

Rollout rules:

- Drain old workers before incompatible changes.
- Keep queue payloads ID-only.
- Deploy provider-bound workers with conservative concurrency.
- Monitor queue depth, oldest job age, retries, and dead letters.
- Pause provider integrations before rolling back provider-bound workers.

## Health Checks

- `/health`: basic process health.
- `/ready`: dependency readiness.
- Web container healthcheck: `scripts/healthcheck.mjs`.
- Worker container healthcheck: `scripts/worker-healthcheck.mjs`, which verifies Redis readiness without opening an HTTP port.
- Database connectivity.
- Redis connectivity.
- Queue backlog.
- Audit write smoke.
- Candidate portal smoke.
- Workflow processing smoke with deterministic providers outside production.

## Rollback

Rollback is image/config focused. Database rollback is not assumed safe after production migrations.

Rollback triggers:

- Elevated 5xx rate.
- Failed auth/session flows.
- Candidate interview start/completion failures.
- Media upload failure spike.
- Queue backlog growth.
- Audit-write failure.
- Cross-tenant or secret-handling concern.

Rollback steps:

1. Disable risky feature flags and provider integrations.
2. Drain workers.
3. Roll back web image or forward-fix configuration.
4. Keep migration state intact unless a database recovery plan is approved.
5. Verify health, audit, tenant isolation, and synthetic smoke.
