# Architecture

## Summary

Aptly uses a modular monolith architecture built with Next.js, TypeScript, PostgreSQL, Prisma, Redis, BullMQ, Docker, Tailwind CSS, and shadcn/ui.

The system deploys as a small set of runtime processes:

- Web application and API server.
- Worker process for BullMQ jobs.
- PostgreSQL database.
- Redis for queues, rate limits, ephemeral locks, and short-lived session state.
- Object storage for recordings, identity captures, exports, and generated reports.

The codebase should be organized into modules with explicit public interfaces. Modules may share the same database and deployment unit initially, but each module owns its business logic and data access conventions. This supports later extraction into microservices.

## Architectural Goals

- Production-ready enterprise SaaS foundation.
- Strong tenant isolation.
- Enforceable privacy and compliance controls.
- Replaceable AI providers.
- Replaceable email provider and SMTP configuration.
- Replaceable media storage.
- Queue-backed background processing.
- Clear auditability.
- Durable workflow orchestration for long-running interview processing.
- Operational resilience, backup, restore, and disaster recovery readiness.
- Low operational complexity at launch.
- Future migration path to services without rewriting core domains.

## Runtime Topology

```text
Browser
  -> Next.js App Router
  -> API Route Handlers / Server Actions
  -> Domain Services
  -> Prisma
  -> PostgreSQL

Worker Process
  -> BullMQ
  -> Domain Job Handlers
  -> PostgreSQL / Redis / Object Storage / External Providers

Redis
  -> BullMQ queues
  -> rate limiting
  -> short-lived candidate session state
  -> distributed locks

Object Storage
  -> recordings
  -> generated reports
  -> optional identity verification assets
```

## Modular Monolith Boundaries

### Identity Module

Owns authenticated user identity for platform, company admin, and HR users.

Responsibilities:

- Login sessions.
- Password or SSO-ready identity records.
- User profile.
- Session invalidation.
- Authentication events.

### Tenant Module

Owns company records, tenant status, company settings, and tenant-level policies.

Responsibilities:

- Company lifecycle.
- Company branding.
- Retention policy.
- Tenant feature flags.
- Tenant-level SMTP configuration references.

### Billing Readiness Module

Owns subscription metadata needed for enterprise SaaS operations without coupling the product to a billing provider too early.

Responsibilities:

- Subscription status metadata.
- Plan and entitlement references.
- Usage counters for interviews, storage, and users.
- Billing-provider abstraction for future Stripe integration.
- Platform admin visibility into commercial status.

### Access Control Module

Owns roles, permissions, and policy checks.

Responsibilities:

- Global platform admin permissions.
- Company admin permissions.
- HR permissions.
- Candidate scoped access.
- Policy enforcement helpers.

### Support Access Module

Owns controlled platform access into tenant workspaces for support, compliance, and operations.

Responsibilities:

- Just-in-time support access requests.
- Reason codes and approval metadata.
- Time-limited support sessions.
- Platform role separation: support, compliance, operations, super admin.
- Company-visible support access audit history for enterprise tenants.
- Denial of broad tenant inspection without explicit support context.

### Invitation Module

Owns candidate invitations and magic link lifecycle.

Responsibilities:

- Invitation creation.
- Token generation and hashing.
- Expiration.
- Resend.
- Revocation.
- Magic link validation.
- Invitation audit events.

### Email Module

Owns email templates, SMTP configuration, queueing, delivery attempts, and delivery status.

Responsibilities:

- Invitation email.
- Reminder email.
- Expired invitation email.
- Results-ready email.
- SMTP configuration.
- Template rendering.
- BullMQ email jobs.
- Delivery logs.
- Bounce and complaint tracking.
- Sender domain verification.
- Tenant email rate limits.
- Platform controls to disable tenant SMTP when abused or misconfigured.

### Interview Module

Owns interview plans, sessions, questions, state transitions, and completion.

Responsibilities:

- Role-specific interview plan.
- Candidate session orchestration.
- Interview state machine.
- Question sequencing.
- Session recovery.
- Completion workflow.

### Workflow Orchestration Module

Owns durable processing workflows after interview completion.

Responsibilities:

- Processing workflow records for recording finalization, transcription, evaluation, report generation, and notifications.
- Ordered workflow steps with retryable, terminal, and blocked states.
- Idempotency keys for workflow jobs.
- Step checkpoints and resumability.
- Dead-letter and poison job handling.
- Manual reprocess controls for authorized platform admins.

Interview completion must create a durable processing workflow record. It must not depend only on independent queue jobs.

### Readiness Module

Owns pre-interview checks.

Responsibilities:

- Browser compatibility.
- Webcam permission status.
- Microphone permission status.
- Network quality result.
- Consent capture.
- Identity verification record.
- Check result persistence.

### Monitoring Module

Owns browser monitoring warning events.

Responsibilities:

- Looking-away events.
- Multiple-face events.
- Camera blocked events.
- Leaving-frame events.
- Focus loss events.
- Warning aggregation.

Monitoring events are warnings only and must not directly determine rejection.

### Media Module

Owns recording metadata, upload lifecycle, storage abstraction, and signed access.

Responsibilities:

- Recording sessions.
- Upload completion.
- Storage keys.
- Signed URLs.
- Access audit.
- Retention deletion jobs.

### Transcription Module

Owns transcript generation and transcript segments.

Responsibilities:

- Transcription job queue.
- Transcript normalization.
- Segment timing.
- Speaker labels.
- Transcript correction metadata.

### Evaluation Module

Owns rubric-based evaluation and AI provider abstraction.

Responsibilities:

- Provider-agnostic evaluation interface.
- DeepSeek adapter later.
- Rubric scoring.
- Evidence citations.
- Evaluation versioning.
- Human override support.
- Confidence and uncertainty representation.
- Malformed provider response handling.

### AI Governance Module

Owns controls around AI-assisted evaluation.

Responsibilities:

- Prompt template versioning.
- Rubric versioning.
- Provider, model, and provider version tracking.
- PII redaction policy before provider calls where applicable.
- Provider timeout, retry, and fallback behavior.
- Provider cost and latency tracking.
- Bias and fairness review process.
- Human override and appeal/dispute support.
- Evidence citation requirements for material claims.
- AI decision-support disclaimers.

### Reporting Module

Owns HR-facing summaries and exportable reports.

Responsibilities:

- HR report generation.
- PDF or document export later.
- Report status.
- Report versioning.
- Aggregate role, pipeline, completion, review, deliverability, and compliance reporting.
- Analytics event capture from domain events.

### Search Module

Owns searchable indexes and query behavior for operational entities.

Responsibilities:

- Candidate, role, invitation, interview, and report search.
- PostgreSQL search indexes initially.
- Compatibility with future external search service.
- Avoiding synchronous full-text scans across large transcripts.

### Export Module

Owns controlled data exports.

Responsibilities:

- Candidate report exports.
- Role summary exports.
- Audit and compliance exports.
- Tenant data export requests.
- Export status tracking and signed download access.

### Audit Module

Owns immutable audit events.

Responsibilities:

- Sensitive access logs.
- Permission changes.
- Invitation lifecycle events.
- Candidate session events.
- Recording and transcript access.
- Admin actions.
- Support access start and end.
- Identity verification access and status changes.
- AI evaluation provider/model/prompt/rubric metadata.
- Score overrides and recommendation changes.
- Report exports.

Audit events must include request, correlation, session, actor, support access, reason, and before/after context where applicable. Application code must not update or delete audit events.

### Compliance and Privacy Module

Owns privacy, consent, data classification, and compliance workflows.

Responsibilities:

- Data classification policy.
- Consent records and privacy notices.
- Data processing agreement readiness.
- Subprocessor tracking.
- GDPR/UK GDPR and CCPA/CPRA request workflows.
- Legal hold.
- Right to access and deletion/anonymization.
- Accessibility compliance target tracking.
- Security incident response hooks.

### Data Lifecycle Module

Owns retention, archival, deletion, anonymization, and restore-aware lifecycle operations.

Responsibilities:

- Retention policies by data class.
- Recording, transcript, report, and identity data deletion.
- Candidate anonymization.
- Legal hold enforcement.
- Object storage lifecycle coordination.
- Retention job auditability.

### Usage and Entitlements Module

Owns plan limits and usage accounting.

Responsibilities:

- Interview, storage, user, and AI usage counters.
- Entitlement checks before expensive operations.
- Plan override controls.
- Billing-provider-neutral subscription metadata.

### Observability Module

Owns internal health, metrics, and operational dashboards.

Responsibilities:

- Queue metrics.
- Job failure summaries.
- API latency metrics.
- Error tracking integration points.
- Health checks.
- Distributed tracing across web and workers.
- Request IDs and correlation IDs.
- Queue age and dead-letter monitoring.
- Email, media upload, transcription, evaluation, and report latency metrics.
- AI provider error, latency, and cost metrics.
- Synthetic interview smoke tests.

## Data Isolation Strategy

Tenant isolation is enforced in three layers:

1. Application context: every authenticated company user request resolves a single `companyId`.
2. Service/repository layer: every tenant-scoped query must include `companyId`.
3. Database model: all tenant-owned records include `companyId`, with indexes and foreign keys.
4. Automated tests: every tenant-owned resource must have cross-tenant denial tests.
5. Job context: every tenant-scoped background job must carry `companyId`, actor/system context, request/correlation IDs, and minimal IDs only.

Platform admin access must use explicit global policies and audit events. It must not reuse normal tenant queries without an intentional platform context.

Database hardening:

- The schema must remain compatible with PostgreSQL row-level security.
- Row-level security should be evaluated before enterprise production launch, not treated as an indefinite future option.
- Database roles should restrict update/delete access to immutable audit tables.

## Candidate Access Model

Candidates are not users. They receive a magic link that creates a scoped candidate session for one invitation.

Magic link requirements:

- High-entropy token.
- Token hash stored, never raw token.
- Expiration timestamp.
- Always single-use for candidate session creation.
- Raw token exchanged once, then removed from the URL.
- Resume handled by a separate short-lived continuation session.
- Rate-limited validation.
- Referrer protection to prevent link leakage.
- Attempt throttling by IP, token hash attempt, and invitation.
- Audit events for opened, expired, failed, and completed.

Candidate sessions can access only:

- Their invitation metadata.
- Their readiness checks.
- Their interview session.
- Their upload endpoints.
- Their completion state.

## Interview State Machine

Primary states:

- `INVITED`
- `OPENED`
- `CONSENTED`
- `CHECKS_IN_PROGRESS`
- `CHECKS_FAILED`
- `READY`
- `IN_PROGRESS`
- `INTERRUPTED`
- `COMPLETED`
- `PROCESSING`
- `RESULTS_READY`
- `EXPIRED`
- `CANCELLED`
- `WITHDRAWN`
- `UPLOAD_RECOVERY`
- `PROCESSING_FAILED`

Invalid transitions must be rejected and audited.

## Queue Architecture

BullMQ queues:

- `email`
- `interview-maintenance`
- `media-finalization`
- `transcription`
- `evaluation`
- `reporting`
- `retention`
- `notifications`

Job requirements:

- Idempotent handlers.
- Retry policy with exponential backoff.
- Dead-letter handling.
- Structured job logs.
- Tenant context included in metadata.
- No secrets or raw candidate tokens in payloads.
- No transcript text, raw prompts, identity payloads, or signed media URLs in payloads.
- Job payloads contain IDs and minimal context only.
- Per-tenant rate limits for expensive queues.
- Separate worker deployments for email, media, transcription, evaluation, and reporting as load grows.
- Manual replay and cancellation controls for platform admins.

Workflow requirements:

- Interview processing must use durable workflow records.
- Each step must be idempotent and checkpointed.
- Workflow states must distinguish pending, running, retrying, blocked, failed, completed, and cancelled.
- Notifications must be sent only after required artifacts are ready.

## Email Architecture

Email uses SMTP through a provider abstraction.

Configuration levels:

1. Platform default SMTP.
2. Company-specific SMTP override.
3. Future provider-specific integrations.

All outbound email is queued. API requests should enqueue and return; workers perform delivery.

Templates:

- Stored as versioned templates.
- Rendered with a safe variable set.
- Previewable in company settings.
- Branded with company name where configured.

Deliverability requirements:

- Tenant sender domains must be verified before custom sender use.
- SMTP credentials must be stored in a managed secret store in production; the database stores only secret references.
- Bounce, complaint, and delivery status must be tracked.
- Tenant outbound email must be rate limited.
- Platform admins can disable tenant SMTP.

Operational deliverability, SPF/DKIM/DMARC, preview-mode, bounce, complaint, and secret-reference guidance is maintained in `docs/EMAIL_SYSTEM.md`.

## AI Architecture

AI is split into two conceptual areas:

- Realtime interview orchestration.
- Post-interview evaluation.

The realtime interviewer must remain provider independent. It should rely on an internal interview engine interface that can be backed by different providers or deterministic scripts.

The evaluation module should define:

- `EvaluationProvider`
- `EvaluationRequest`
- `EvaluationResult`
- Provider metadata
- Normalized rubric scores
- Prompt template version
- Rubric version
- Model/provider version
- Redaction policy metadata
- Confidence and uncertainty fields
- Evidence citation mapping

DeepSeek integration is planned for evaluation only and should be added as an adapter, not embedded directly in business logic.

AI output is decision support only. HR-facing UI must preserve human ownership of recommendations, score overrides, and final decisions.

## Media and Recording Architecture

Browser recording should use standard web APIs where possible. Large media files must be uploaded directly to object storage using signed upload URLs or multipart upload.

The database stores metadata only:

- Storage key.
- Duration.
- Size.
- MIME type.
- Processing status.
- Retention deadline.

Access to recordings must use short-lived signed URLs and create audit events.

Media scale requirements:

- Recordings must never stream through the Next.js application server.
- Object storage must support range requests for playback.
- A CDN should be supported for production playback.
- Multipart upload and upload recovery are required for large or interrupted recordings.
- Object storage lifecycle rules must align with company retention and legal hold.

## Browser Monitoring Architecture

Monitoring runs in the browser and submits structured warning events.

The system stores:

- Event type.
- Timestamp.
- Confidence where applicable.
- Session elapsed time.
- Optional short metadata.

The server aggregates warnings for reviewer context. No warning should automatically fail an interview.

Monitoring ingestion requirements:

- Browser monitoring events should be batched.
- Server must validate event size, count, and frequency.
- Repeated low-value events should be summarized.
- Raw telemetry should be minimized.

## Security Architecture

Minimum controls:

- Secure HTTP-only cookies for authenticated users.
- CSRF protection for browser mutations.
- Rate limiting for auth, magic link validation, and candidate event ingestion.
- Strict authorization checks.
- Input validation on every public API.
- Signed media URLs.
- Secret management through environment variables or managed secrets.
- Audit logging for sensitive actions.
- Data retention jobs.
- Data classification and retention by data class.
- Managed secret storage in production.
- Idempotency keys for mutations and workflow jobs.
- Referrer protection for candidate links.
- PII redaction in logs and provider calls where applicable.
- Least-privilege database and infrastructure roles.

Data classes:

- Public: marketing-safe metadata.
- Internal: operational settings and non-sensitive status.
- Confidential: company users, candidates, invitations, notes, reports.
- Restricted: recordings, transcripts, identity verification data, AI provider payloads, secrets, support access records.
- Regulated/sensitive: identity documents, biometric-like signals, legal hold data, and jurisdiction-specific protected data.

## Deployment Architecture

Docker images:

- `web`
- `worker`

Required infrastructure:

- PostgreSQL.
- Redis.
- Object storage.
- CDN for production media playback.
- SMTP server or transactional email provider exposing SMTP.
- Managed secret store.
- Metrics, logs, traces, and error tracking.
- Reverse proxy or hosting platform supporting Next.js.

Environments:

- Local.
- Staging.
- Production.

Promotion rules:

- Database migrations reviewed before production.
- Staging smoke tests required.
- Queue workers deployed with compatible schema version.
- Old workers drained before incompatible job schema changes.
- Zero-downtime migration pattern required for production.
- Rollback plan required for each release.

Disaster recovery targets:

- Initial PostgreSQL RPO: 15 minutes.
- Initial core application RTO: 4 hours.
- Point-in-time recovery required for production PostgreSQL.
- Object storage versioning required for recordings and generated reports.
- Redis must be treated as recoverable queue/session infrastructure, with BullMQ recovery behavior documented.
- Restore verification must run on a regular cadence before enterprise launch.

Observability requirements:

- Every request should have a request ID.
- Cross-process workflows should have a correlation ID.
- Web and worker logs must be structured and redact sensitive data.
- Alerts must cover queue age, failed jobs, upload failures, provider failures, audit write failures, database health, Redis health, and object storage errors.

## Future Microservice Extraction

Likely extraction candidates:

- Email service.
- Media processing service.
- Transcription service.
- Evaluation service.
- Reporting service.

The modular monolith should prepare for extraction by:

- Keeping module service interfaces explicit.
- Avoiding cross-module direct database access where possible.
- Publishing internal domain events.
- Keeping queue payloads versioned.
- Storing provider-specific data separately from normalized business records.
