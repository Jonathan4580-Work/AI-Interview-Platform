# API and Webhook Versioning

Phase 12 formalizes versioning for internal APIs, external webhooks, and integration contracts. It does not break existing Phase 4-10 APIs.

## Internal API Versioning

- Internal APIs remain under `/api/internal/v1`.
- Backward-compatible additions may be added to response objects.
- Existing fields must not change meaning within the same version.
- Breaking changes require a new path version such as `/api/internal/v2`.
- Mutations must continue to enforce authentication, tenant context, permission checks, CSRF, validation, idempotency where relevant, rate limiting, audit, and safe projection.
- API responses must use the standard envelope with request and correlation metadata.

## External Webhook Versioning

- Every webhook event includes an event ID, event key, schema version, tenant/company ID, aggregate type, aggregate ID, and occurrence timestamp.
- Webhook payloads are allowlisted per event type.
- Internal domain-event payloads must never be forwarded directly.
- Webhook subscriptions declare the schema version they accept.
- Breaking webhook schema changes require a new schema version and a migration window.
- Webhook deliveries are signed with HMAC and include timestamp-based replay protection.
- Signing secrets are stored only as managed secret references or encrypted secret material outside PostgreSQL.

## Event Contract Policy

- Event keys use stable dotted names such as `interview.completed` and `report.ready`.
- Event payloads contain safe IDs and minimal metadata only.
- Event payloads must not contain secrets, tokens, transcripts, candidate notes, accommodation data, identity data, media URLs, prompts, evidence text, provider responses, or signed URLs.
- Schema versions are immutable once published.
- New optional fields may be added when consumers can ignore them safely.

## Integration API Policy

- Provider adapters translate external APIs into Aptly-owned DTOs.
- Provider-specific payloads stay behind adapter boundaries and are not stored in core domain tables.
- Sync cursors and checkpoints are versioned by provider adapter.
- Integration mappings are tenant-scoped and use separate mapping tables.
- Conflict policies must be explicit and must never overwrite reviewed evaluations, interview plans, human decisions, or audit history.

## Deprecation Policy

- Enterprise-facing API and webhook deprecations require documented notice and migration guidance.
- The minimum support window for externally consumed webhook schemas is 180 days unless a security issue requires faster action.
- Security removals may be immediate when required to prevent data exposure.

## Consumer Migration Guidance

- Consumers should key idempotency by event ID.
- Consumers should reject webhooks outside the timestamp replay window.
- Consumers should verify HMAC signatures before parsing payload details.
- Consumers should treat unknown optional fields as non-breaking additions.
- Consumers should not depend on delivery order across aggregates.
