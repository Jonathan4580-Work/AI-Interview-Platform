# Staging Deployment

## Status

Prepared: staging architecture, configuration requirements, smoke-test checklist.

Not deployed: no staging infrastructure or credentials are available in this workspace.

## Required Staging Resources

- Separate PostgreSQL database.
- Separate Redis instance.
- Separate private object-storage bucket.
- Separate email sandbox or capture provider.
- Separate domains.
- Separate managed secrets.
- Development or sandbox AI providers.
- Safe webhook endpoint.
- Synthetic fixtures only.

No real candidate data may be copied into staging.

## Staging Deployment Steps

1. Provision managed PostgreSQL, Redis, object storage, and secret store.
2. Configure staging domains and TLS.
3. Create `.env.staging` from `.env.production.example` with staging values.
4. Set `NODE_ENV=production` for the optimized Next.js runtime and `APP_ENV=staging` for staging-specific infrastructure validation.
5. On Railway, `DATABASE_URL=${{Postgres.DATABASE_URL}}` and `REDIS_URL=${{Redis.REDIS_URL}}` may use Railway private-network URLs. Staging validation permits these private-network `postgresql://` and `redis://` URLs while still requiring HTTPS public app URLs and managed `secret://` references.
6. Validate with `npm.cmd run validate:production-env -- .env.staging`.
7. Build and publish image.
8. Run migrations through the migrator target.
9. Deploy web service.
10. Deploy worker services.
11. Configure email sandbox.
12. Configure deterministic development or sandbox providers.
13. Run synthetic interview flow.
14. Run browser/device matrix.
15. Run restore validation against an isolated staging restore.

## Staging Environment Rules

- `APP_ENV=staging` is required and must not be omitted.
- `NODE_ENV=production` remains required for optimized Next.js runtime behavior.
- `APP_URL`, `CANDIDATE_APP_URL`, and `INTERNAL_APP_URL` must be HTTPS.
- Session, CSRF, token pepper, encryption, SMTP, object-storage, and backup references must use managed `secret://` identifiers.
- Railway private-network PostgreSQL and Redis URLs are allowed in staging.
- Final production still requires PostgreSQL TLS parameters and `rediss://`.

## Staging Smoke Test

Status in this repository: automated synthetic flow tests exist as repository tests. A real staging smoke test is pending infrastructure.

Smoke path:

- Tenant/company setup fixture.
- HR/user fixture.
- Job and published interview plan.
- Candidate and invitation.
- Magic-link exchange.
- Consent/readiness.
- Identity still metadata.
- Interview start.
- Structured answer flow using test media fixtures.
- Completion.
- Workflow processing through deterministic providers.
- Results-ready report.
- Search/report visibility.

## Staging Exit Criteria

- All repository checks pass.
- Environment validation passes.
- Migrations apply once and schema verifies.
- Web and worker health checks pass.
- Synthetic interview smoke passes end-to-end.
- Email sandbox receives expected messages only.
- Object upload/download smoke passes.
- Queue backlog clears.
- Alerts can be triggered in test mode.
- No production secrets or production data are present.

## Current Status

Staging deployment is pending. It requires infrastructure access, DNS/TLS configuration, secret-store access, and sandbox provider credentials.
