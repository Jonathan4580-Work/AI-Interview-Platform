# Module Extraction Readiness

Phase 12 keeps Aptly as a modular monolith. The purpose of this document is to define extraction seams so modules can become services later without rewriting stable domain logic.

## Extraction Principles

- Extract only after operational pressure justifies the cost.
- Preserve tenant-scoped contracts and request/correlation context across boundaries.
- Move modules behind application service interfaces before moving storage or queues.
- Use the transactional outbox for cross-module events.
- Keep queue payloads ID-only and rehydrate data through authorized services.
- Do not expose Prisma models as external contracts.
- Keep secrets in managed secret references, never service payloads.

## First Extraction Candidates

### Email Delivery

Reason: Provider-bound, queue-backed, and naturally isolated from core recruiting workflows.

Required seams:

- Email template rendering interface.
- Delivery queue contract.
- Tenant SMTP metadata and secret-reference contract.
- Delivery status event contract.

Blocked by:

- Operational need for independent scaling.
- Dedicated provider observability and bounce handling maturity.

### Media Processing

Reason: Object storage, multipart upload, and verification workloads are IO-heavy and provider-specific.

Required seams:

- Media authorization API.
- Object metadata repository interface.
- Storage provider adapter contract.
- Retention and legal-hold event contracts.

Blocked by:

- Stable recording upload traffic profile.
- Formal media data-residency policy.

### Transcription and Evaluation

Reason: Provider-bound, latency-variable, and cost-sensitive.

Required seams:

- Transcript provider contract.
- Evaluation provider contract.
- AI governance artifact contracts.
- Redaction policy version contract.
- Workflow step contract.

Blocked by:

- Provider production credentials and cost controls.
- Replay and supersession operational runbooks.

### Reporting and Exports

Reason: Expensive asynchronous reporting and export generation can scale separately from transactional APIs.

Required seams:

- Report run command contract.
- Export artifact metadata contract.
- Signed download authorization contract.
- Query policy and tenant-scope contract.

Blocked by:

- Larger customer datasets and report latency pressure.
- Export storage retention policy validation.

### Integrations and Webhooks

Reason: External systems require provider throttling, retries, dead-letter handling, and independent deployment cadence.

Required seams:

- Outbox event contract.
- Webhook delivery contract.
- Integration connection and mapping contract.
- Sync workflow contract.
- Provider adapter contract.

Blocked by:

- First production ATS connector selection.
- Enterprise webhook usage volume.

## Boundary Guardrails

- New modules must export service interfaces, DTOs, and domain events through their `index.ts`.
- Modules must not import another module's repository implementation directly.
- Modules must not share unrestricted JSON payloads across boundaries.
- Cross-module operations must prefer service methods or event contracts.
- Append-heavy operational tables must keep tenant-leading indexes and partitioning-compatible timestamps.

## Phase 12 Status

Phase 12 adds event, webhook, SSO, SCIM, integration, worker scaling, and data-residency contracts while keeping deployment in the modular monolith. No microservice extraction, production infrastructure provisioning, or data migration is performed in this phase.
