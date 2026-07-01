# Provider Setup

## Status

No live provider credentials are configured. No production provider connection was attempted.

## General Rules

- Keep optional providers disabled until credentials exist.
- Store credentials in managed secrets only.
- Use secret references in Aptly configuration.
- Run provider connection tests in staging before production.
- Record timeout, retry, quota, regional policy, and rollback behavior.
- Disable provider integrations before rolling back provider-bound workers.

## DeepSeek

Required before production use:

- Approved API key in managed secret store.
- `EVALUATION_PROVIDER=deepseek`.
- `DEEPSEEK_SECRET_REF` or runtime `DEEPSEEK_API_KEY` from secret manager.
- Timeout and retry validation.
- Malformed output validation.
- Usage/cost metadata review.
- Schema validation smoke test.

Rules:

- Development provider remains available outside production.
- DeepSeek output never exposes chain-of-thought.
- AI output never changes candidate/application status automatically.

## Transcription Provider

Current status: development provider only.

Before production:

- Select provider.
- Add provider adapter and secret reference.
- Validate media access without proxying through the app server.
- Verify language metadata, timestamps, confidence, timeout, retry, and failure normalization.

## Google Workspace OIDC

Requires:

- Verified tenant domain.
- OAuth client ID.
- OAuth client secret reference.
- Redirect URI: `https://app.example.com/api/internal/v1/sso/callback/google` or selected production callback.
- State, nonce, and PKCE validation.
- Account-linking tests.
- Break-glass local admin validation.

## Microsoft Entra ID OIDC

Requires:

- Verified tenant domain.
- Entra tenant metadata.
- OAuth client ID.
- OAuth client secret reference.
- Redirect URI.
- State, nonce, and PKCE validation.
- Group/role mapping review.
- Conditional-access behavior review.

## SCIM

Requires:

- Per-tenant SCIM configuration.
- Hashed bearer token or managed secret reference.
- Role mapping approval.
- Deprovisioning session-revocation test.
- Platform Admin prevention test.
- Idempotent create/update/deactivate/reactivate test.

## ATS Providers

Initial production connector must be explicitly selected. Supported architecture covers Greenhouse, Lever, Workday, Ashby, SmartRecruiters, and other adapters.

Before enabling:

- Provider credentials in managed secret store.
- External account reference.
- Mapping configuration.
- Conflict policy.
- Sync cursor/checkpoint test.
- Duplicate candidate/application prevention test.
- Rate-limit and quota test.
- Rollback/disconnect procedure.

Provider-specific fields must stay in integration mapping/config tables, not core candidate/job/application records.

## External Webhooks

Before enabling real delivery:

- Per-subscription signing secret reference.
- Endpoint HTTPS validation.
- DNS resolution and private-address validation immediately before connection.
- Redirect validation.
- Replay protection.
- Delivery idempotency.
- Retry/dead-letter inspection.
- Secret rotation procedure.

## Object Storage

Requires:

- Private bucket.
- Server-side encryption.
- Versioning where appropriate.
- Lifecycle policy.
- Multipart upload support.
- CORS limited to production app/candidate origins.
- No public bucket access.

## Email Provider

Requires:

- Verified sender domain.
- SPF, DKIM, DMARC.
- Bounce/complaint handling.
- Email sandbox smoke before live send.
- Provider rate limits.
- Production/non-production separation.
