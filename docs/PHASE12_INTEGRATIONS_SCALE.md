# Phase 12 Integrations and Scale

Phase 12 adds enterprise integration foundations and scale capabilities while keeping Aptly as a modular monolith. No production infrastructure was provisioned and no production deployment was performed.

## Scope Implemented

- Transactional outbox domain-event foundation.
- External webhook subscription, signing, SSRF validation, delivery retry, and dead-letter contracts.
- Google Workspace, Microsoft Entra ID, development OIDC, and future SAML SSO foundations.
- SCIM 2.0 provisioning foundation with hashed bearer-token behavior.
- Provider-neutral ATS integration architecture with deterministic development adapter.
- Integration mapping, conflict policy, cursor, checkpoint, and sync queue contracts.
- Worker scaling metadata for email, orchestration, media, transcription, evaluation, reporting, exports, retention, integrations, webhooks, and notifications.
- Data-region and object-storage configuration foundation.
- Module extraction readiness documentation.
- Internal Phase 12 management APIs and enterprise settings shell pages.

## Outbox Behavior

Outbox events are tenant-scoped and include event ID, event key, schema version, aggregate reference, occurrence timestamp, request/correlation context, processing status, attempt count, availability time, retry metadata, and retention date.

Event payloads are validated through explicit safety rules. Payloads must not contain secrets, raw tokens, transcripts, candidate notes, accommodation data, identity data, media URLs, prompts, evidence text, provider responses, unrestricted URLs, or signed URLs.

Delivery behavior is designed for idempotency, retry with backoff, dead-letter state, replay, and retention. Ordering-sensitive consumers should order within an aggregate using aggregate type, aggregate ID, and occurrence timestamp.

## Webhook Security

Webhook endpoints are validated before activation.

- HTTPS is required in production mode.
- Credentials in URLs are rejected.
- Private, loopback, link-local, metadata, and localhost targets are blocked.
- Event subscriptions are constrained to externally deliverable event keys.
- Payloads are allowlisted and schema-versioned.
- HMAC signing and timestamp replay protection are required.
- Signing secrets are represented by managed secret references and are never logged.
- Webhook retry and test-send actions require tenant permissions and audit coverage.

## SSO Foundation

SSO remains provider-neutral.

- Google Workspace and Microsoft Entra ID are modeled as OIDC adapters.
- A deterministic development adapter supports tests without real credentials.
- Future SAML support is represented as a replaceable adapter boundary.
- Redirect URI validation, state, nonce, and PKCE are required.
- Tenant discovery is based on verified domains.
- Login policy supports local allowed, optional SSO, and required SSO.
- Break-glass local Company Admin access remains available when required.
- Existing email/password authentication is not removed or weakened.

## SCIM Foundation

SCIM provisioning is tenant-scoped and does not allow Platform Admin provisioning.

- Bearer tokens are hashed or referenced through managed secrets.
- User and group foundations support provision, update, deactivate, reactivate, filtering, pagination, external IDs, and idempotency.
- Deprovisioning decisions require active-session revocation.
- Role mappings use the central RBAC model.

## ATS Integration Architecture

ATS providers are isolated behind adapter contracts.

- Development adapter is deterministic and does not require external credentials.
- Provider-specific fields stay in mapping/configuration tables, not core candidate, job, or application models.
- Supported mapping types are job, candidate, application, stage, and user.
- Conflict policies are Aptly wins, external wins, manual review, and field-specific rules.
- Integrations must not silently overwrite reviewed evaluations, interview plans, human decisions, or audit history.
- Sync jobs are checkpointed, idempotent, retryable, cancellable, and replayable through existing workflow/queue foundations.

## Worker Scaling and Fairness

Worker class policies define resource class, configurable concurrency, tenant fairness limit, provider-bound status, autoscaling signal, and deployment schema compatibility.

Queue payloads remain ID-only. Workers must rehydrate required data through authorized services and must not receive raw media, signed URLs, secrets, transcripts, prompts, provider responses, or restricted payloads.

Tenant fairness is exposed as deterministic throttling and ratio helpers. Provider-bound queues expose provider-throttle autoscaling signals.

## Data Residency

Data-residency settings support tenant primary region, storage region, provider policy, cross-region transfer controls, and migration-planning metadata.

Phase 12 does not move existing data and does not deploy multi-region infrastructure. Migration metadata explicitly records that automatic data movement is not allowed.

## Internal APIs and Pages

Internal APIs were added for:

- Webhook subscriptions and delivery retry/status foundations.
- SSO configuration and verified domain mapping foundations.
- SCIM configuration/status foundations.
- ATS integration connections, mappings, and sync job foundations.
- Data-residency setting and transfer validation foundations.

Enterprise settings pages were added for:

- Integrations overview.
- Webhook subscriptions.
- SSO configuration.
- SCIM configuration.
- ATS connections and mapping foundation.
- Integration sync status/history foundation.
- Data-region settings.

These pages are shell/configuration surfaces only. They do not add dashboards, candidate ranking, automated decisions, production deployment controls, SSO credential entry flows, SCIM production provisioning, or production ATS connectors.

## Manual Setup Still Required

- Real Google Workspace OIDC client ID and secret reference.
- Real Microsoft Entra ID OIDC client ID and secret reference.
- Production webhook signing secret storage.
- Production ATS provider credentials and provider-specific adapters.
- Production regional object-storage bucket provisioning.
- External observability dashboards and alert routing.
- Production deployment and infrastructure provisioning in Phase 13.

## Accepted Limitations

- Development SSO and ATS adapters are deterministic fixtures, not production integrations.
- Webhook delivery workers and integration workers have contracts and factories but require production worker deployment topology in Phase 13.
- Data-region policy is enforceable in code but no data migration is automated.
- SCIM foundations validate security and lifecycle rules, but no external identity provider is connected.
- No Phase 13 production release, infrastructure provisioning, or live enterprise connector credentials were added.
