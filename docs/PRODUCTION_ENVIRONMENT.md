# Production Environment

## Status

Implemented: production environment schema, `.env.production.example`, validation script, and secret inventory.

Not configured: real production values, managed secrets, provider credentials, and infrastructure endpoints.

## Validation

Validate a candidate production environment file:

```powershell
npm.cmd run validate:production-env -- .env.production
```

The script forces `NODE_ENV=production` and fails closed when security-critical values are missing or insecure.

## Build-Time vs Runtime Variables

Runtime-only:

- Database URLs.
- Redis URL.
- SMTP/provider configuration.
- Object-storage credentials and secret references.
- Session, CSRF, token pepper, and encryption secret references.
- DeepSeek/provider secrets.
- SSO, SCIM, ATS, webhook secret references.
- Worker concurrency.
- Observability endpoints.

Build-time:

- `NEXT_TELEMETRY_DISABLED=1`.
- Release metadata may be injected at image build or runtime.

No production secret should be used at build time.

## Server-Only Variables

All variables in `.env.production.example` are server-only unless a future variable is explicitly prefixed with `NEXT_PUBLIC_`. No production secrets may use a public prefix.

## Required Production Variables

- `APP_URL`, `CANDIDATE_APP_URL`, `INTERNAL_APP_URL`: HTTPS only.
- `DATABASE_URL`: managed PostgreSQL with `sslmode=require` or stronger.
- `REDIS_URL`: `rediss://` only.
- `SESSION_SECRET_REF`, `CSRF_SECRET_REF`, `TOKEN_PEPPER_SECRET_REF`, `ENCRYPTION_KEY_SECRET_REF`: managed secret references.
- `SMTP_SECRET_REF`, `OBJECT_STORAGE_SECRET_REF`, `BACKUP_STORAGE_SECRET_REF`: managed secret references.
- `OBJECT_STORAGE_CORS_ALLOWED_ORIGINS`: workspace and candidate origins only.
- `DATA_REGION_DEFAULT`: one of `US`, `EU`, `APAC`.

## Optional Provider Variables

Keep optional providers disabled until configured:

- `EVALUATION_PROVIDER=development` until DeepSeek is approved.
- `TRANSCRIPTION_PROVIDER=development` until a production STT provider is selected.
- `WEBHOOK_SIGNING_SECRET_REF` only when real outbound webhooks are enabled.
- `SSO_GOOGLE_CLIENT_SECRET_REF` and `SSO_MICROSOFT_CLIENT_SECRET_REF` only after provider setup.
- `SCIM_TOKEN_SECRET_REF` only after SCIM tenant setup.
- `ATS_SECRET_REF` only after selected ATS connector approval.

## Secret Inventory

| Secret                              | Storage                                   | Rotation guidance                                                    |
| ----------------------------------- | ----------------------------------------- | -------------------------------------------------------------------- |
| Session signing/encryption material | Managed secret store                      | Rotate with overlapping session window where supported               |
| CSRF secret material                | Managed secret store                      | Rotate during maintenance; validate forms after rotation             |
| Token pepper                        | Managed secret store                      | Rotate only with token invalidation plan                             |
| Application encryption key          | Managed KMS/secret store                  | Rotate through key-version support before deleting old key           |
| SMTP credentials                    | Managed secret store                      | Rotate after provider key creation and delivery smoke test           |
| Object-storage access keys          | Managed secret store or workload identity | Prefer workload identity; rotate key with upload/download smoke test |
| DeepSeek key                        | Managed secret store                      | Rotate with provider health and schema validation                    |
| Webhook signing secrets             | Managed secret store                      | Support per-subscription rotation window                             |
| SCIM bearer token material          | Hash or managed secret reference          | Rotate per tenant; revoke old token after propagation                |
| SSO OAuth client secrets            | Managed secret store                      | Rotate in IdP first, then Aptly                                      |
| ATS credentials                     | Managed secret store                      | Rotate per provider connection                                       |
| Backup storage credentials          | Managed secret store                      | Rotate after backup and restore validation                           |

## Fail-Closed Rules

Production validation fails when:

- App URLs are not HTTPS.
- PostgreSQL does not enforce TLS.
- Redis does not use `rediss://`.
- Required secret references are absent or do not use `secret://`.
- Production SMTP is enabled without host, port, from address, and reply-to address.
- DeepSeek is selected without API key or managed secret reference.
