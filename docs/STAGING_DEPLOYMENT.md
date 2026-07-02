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
10. Deploy worker services with `Dockerfile.worker`, not the web `Dockerfile`.
11. Bootstrap the first staging administrators with `npm run bootstrap:staging` from an interactive shell inside the staging service.
12. Configure email sandbox.
13. Configure deterministic development or sandbox providers.
14. Run synthetic interview flow.
15. Run browser/device matrix.
16. Run restore validation against an isolated staging restore.

## Staging Environment Rules

- `APP_ENV=staging` is required and must not be omitted.
- `NODE_ENV=production` remains required for optimized Next.js runtime behavior.
- `APP_URL`, `CANDIDATE_APP_URL`, and `INTERNAL_APP_URL` must be HTTPS.
- Session, CSRF, token pepper, encryption, SMTP, object-storage, and backup references must use managed `secret://` identifiers.
- Railway private-network PostgreSQL and Redis URLs are allowed in staging.
- Final production still requires PostgreSQL TLS parameters and `rediss://`.

## Staging Administrator Bootstrap

Run `npm run bootstrap:staging` only in a staging environment with `APP_ENV=staging`. The script is idempotent: it upserts the first Platform Admin, upserts the staging company/workspace, creates the central `company_admin` role, grants all current RBAC permissions to that role, and upserts the first Company Admin assignment.

Required inputs:

- `BOOTSTRAP_PLATFORM_ADMIN_EMAIL`
- `BOOTSTRAP_PLATFORM_ADMIN_NAME`
- `BOOTSTRAP_COMPANY_NAME`
- `BOOTSTRAP_COMPANY_SLUG`
- `BOOTSTRAP_COMPANY_ADMIN_EMAIL`
- `BOOTSTRAP_COMPANY_ADMIN_NAME`

Password input:

- `BOOTSTRAP_PLATFORM_ADMIN_PASSWORD` is required.
- `BOOTSTRAP_COMPANY_ADMIN_PASSWORD` is required.
- Existing account passwords are never reset silently. If an account already has credentials, the script reuses them and leaves the password hash unchanged.

The script does not print passwords. Bootstrap credentials are marked email-verified because these are operator-provisioned staging accounts, not email-invited users.

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

## HR MVP Demo Setup

Use the existing web service command for the Next.js application:

```powershell
node .next/standalone/server.js
```

For the Railway web service, keep config-as-code pointed at the root web config file:

```powershell
/railway.json
```

Create a separate Railway worker service from the same repository for queued email and post-interview processing. The worker service must select the dedicated worker Dockerfile:

```powershell
Dockerfile.worker
```

Because Railway config-as-code overrides dashboard settings, configure the `aptly-worker` service to use its own config file:

1. Open the `aptly-worker` service in Railway.
2. Go to **Settings**.
3. Open **Config-as-code**.
4. Set **Config File Path** to the absolute repository path:

```powershell
/railway.worker.json
```

That file selects `Dockerfile.worker`, disables HTTP healthchecks for the background worker, and sets the worker start command:

```powershell
npm run worker:prod
```

If Railway uses the Dockerfile command, no custom start command is required because `Dockerfile.worker` already has `CMD ["npm", "run", "worker:prod"]`. If Railway overrides commands per service, set the worker start command to `npm run worker:prod`.

After `/railway.worker.json` is active, remove `RAILWAY_DOCKERFILE_PATH` from the `aptly-worker` service if it was added as a temporary workaround. The Dockerfile path is then controlled by `railway.worker.json`.

Set `STAGING_WORKER_SERVICE_ENABLED=true` only after that worker service is deployed and healthy. Do not claim the end-to-end interview flow works while the worker service is absent.

Create synthetic demo data with environment-provided passwords:

```powershell
$env:APP_ENV="staging"
$env:STAGING_DEMO_COMPANY_NAME="Aptly Synthetic Staging"
$env:STAGING_DEMO_COMPANY_SLUG="aptly-synthetic-staging"
$env:STAGING_DEMO_COMPANY_ADMIN_EMAIL="admin+staging@example.invalid"
$env:STAGING_DEMO_COMPANY_ADMIN_NAME="Synthetic Company Admin"
$env:STAGING_DEMO_COMPANY_ADMIN_PASSWORD="<secure password>"
$env:STAGING_DEMO_HR_EMAIL="hr+staging@example.invalid"
$env:STAGING_DEMO_HR_NAME="Synthetic HR User"
$env:STAGING_DEMO_HR_PASSWORD="<secure password>"
npm run staging:demo
```

The command prints the Company Workspace ID. Company Admin and HR users should choose **Company** on the login page and enter that Workspace ID.

Run the staging MVP smoke check after using the UI to send the invitation and complete the candidate flow:

```powershell
$env:APP_ENV="staging"
$env:STAGING_DEMO_COMPANY_SLUG="aptly-synthetic-staging"
npm run staging:mvp-smoke
```

The smoke command reports blocked checks instead of faking success when the worker, object storage, invitation, interview completion, transcript, evaluation, or report is missing.

## Object Storage For Candidate Recording

Candidate browser recording requires real S3-compatible staging storage. Configure:

- `OBJECT_STORAGE_PROVIDER`
- `OBJECT_STORAGE_ENDPOINT`
- `OBJECT_STORAGE_PUBLIC_ENDPOINT`
- `OBJECT_STORAGE_REGION`
- `OBJECT_STORAGE_BUCKET`
- `OBJECT_STORAGE_FORCE_PATH_STYLE`
- `OBJECT_STORAGE_ACCESS_KEY_ID`
- `OBJECT_STORAGE_SECRET_ACCESS_KEY`
- `OBJECT_STORAGE_SECRET_REF`
- `OBJECT_STORAGE_CORS_ALLOWED_ORIGINS`

Use private bucket access, short-lived signed URLs, multipart upload support, and CORS limited to the staging web origin. Without reachable object storage, recording upload, media verification, workflow processing, transcript, evaluation, and report creation remain blocked.

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
