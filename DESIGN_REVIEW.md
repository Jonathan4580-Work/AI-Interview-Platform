# Design Review

## Review Position

This review intentionally challenges the current architecture as if Aptly must support thousands of companies, large HR teams, hundreds of thousands of candidates, and millions of interviews.

The documentation establishes a strong product direction and a reasonable modular monolith foundation. However, several areas are still too implicit for an enterprise SaaS platform: tenant isolation enforcement, compliance posture, operational resilience, data lifecycle, media scale, AI governance, reporting depth, and disaster recovery.

No implementation should begin until the high-priority items in this review are resolved in the design documents.

## Executive Summary

The current architecture is directionally correct but under-specified for enterprise scale. The largest risks are:

- Multi-tenancy relies too heavily on developer discipline.
- Sensitive candidate data handling lacks a formal classification and compliance model.
- Media, transcript, evaluation, and report storage will become major scale and privacy pressure points.
- Queue processing is defined, but job orchestration, idempotency keys, poison job handling, and replay behavior need more precision.
- Candidate flows omit several real-world failure and recovery paths.
- HR workflows lack collaboration, approvals, bulk actions, exports, and decision governance.
- Platform admin functionality is insufficient for enterprise support operations.
- AI integration lacks governance around prompt/version tracking, reproducibility, provider failure, and bias controls.
- Disaster recovery and observability are too high-level.

## Priority Rankings

### P0: Must Change Before Implementation

These are design gaps that can cause security, tenant isolation, compliance, or major architectural rework.

1. Tenant isolation enforcement is not strong enough.
2. Data classification and privacy model is missing.
3. Candidate magic-link and candidate session lifecycle is under-specified.
4. Media upload, storage, retention, and deletion architecture is incomplete.
5. AI evaluation governance is incomplete.
6. Audit log requirements are too shallow for enterprise support and compliance.
7. Disaster recovery targets and backup design are missing.
8. Queue idempotency and workflow orchestration rules are under-specified.

### P1: Should Change Before Major Feature Work

These are likely to create product or operational pain at scale.

1. HR review workflows are too basic.
2. Platform admin console lacks support tooling.
3. Reporting and analytics are underdeveloped.
4. Compliance roadmap is too late in the roadmap.
5. Accessibility requirements are not specific enough.
6. API versioning and pagination conventions need formalization.
7. Database schema needs partitioning and archival strategy.
8. Email deliverability and bounce handling need stronger design.

### P2: Can Be Refined During Implementation Planning

These are important but can be iterated once the P0/P1 decisions are made.

1. Brand and UI system need component-level examples later.
2. Billing can remain provider-neutral but needs entitlement enforcement rules.
3. Future ATS integration contracts can be delayed.
4. Advanced analytics can start as event collection before full dashboards.

## Architectural Weaknesses

### Weakness: Modular Monolith Boundaries Are Conceptual Only

The architecture says modules should have explicit interfaces, but it does not define enforcement rules.

Risk:

- Developers may directly import repositories or Prisma models across module boundaries.
- Future service extraction becomes expensive.
- Business logic may leak into route handlers or UI actions.

Recommendation:

- Define a module contract standard before coding.
- Each module should expose only application services, DTOs, domain events, and policy functions.
- Cross-module access should happen through service interfaces or internal events, not direct table access.
- Add an architecture rule: route handlers call application services only; application services coordinate domain services and repositories.

Updated decision:

- The modular monolith must be implemented as a strict internal package/module structure with dependency direction rules and lint enforcement.

### Weakness: No Explicit Workflow Orchestration Model

The interview lifecycle depends on many async steps: recording finalization, transcription, evaluation, report generation, notification. The docs list queues but not orchestration semantics.

Risk:

- Duplicate jobs create duplicate evaluations or notifications.
- Partial failures leave interviews stuck.
- Replaying failed jobs may corrupt state.

Recommendation:

- Add a Workflow Module or Processing Pipeline Module.
- Define workflow state per interview artifact.
- Use idempotency keys for every job.
- Persist job checkpoints.
- Define retryable vs terminal failures.
- Add manual reprocess controls for platform admins.

Updated decision:

- Interview completion should create a durable processing workflow record with ordered steps, not only enqueue independent jobs.

## Scalability Bottlenecks

### Bottleneck: PostgreSQL Tables Will Grow Quickly

Millions of interviews produce large volumes of:

- `interview_turns`
- `monitoring_events`
- `transcript_segments`
- `audit_events`
- `email_deliveries`
- `job_runs`

Risk:

- Slow tenant dashboards.
- Expensive audit searches.
- Bloated indexes.
- Painful migrations.

Recommendation:

- Define partitioning strategy before implementation.
- Candidate tables for partitioning: `audit_events`, `monitoring_events`, `transcript_segments`, `email_deliveries`, `job_runs`.
- Use time-based partitioning for append-heavy operational data.
- Add retention and archival strategy for event-heavy tables.
- Define query patterns and indexes around the top workflows.

Updated decision:

- Append-heavy event tables should be designed with partitioning compatibility from day one, even if physical partitioning is enabled later.

### Bottleneck: Recording and Transcript Review Could Overload App Server

The architecture correctly proposes signed URLs, but it does not specify streaming, range requests, CDN, or transcript pagination.

Risk:

- Video playback latency.
- High bandwidth through application server if implemented incorrectly.
- Slow transcript loading for long interviews.

Recommendation:

- Recordings must never stream through the Next.js server.
- Use object storage signed URLs with range request support.
- Consider CDN in front of object storage.
- Transcript APIs should support segment pagination and search.
- Large reports should be generated asynchronously.

### Bottleneck: BullMQ Worker Scaling Is Too Generic

All queues are listed, but worker concurrency and resource classes are not defined.

Risk:

- Email jobs compete with expensive media or AI jobs.
- Evaluation provider latency blocks reporting.
- Noisy tenants consume shared worker capacity.

Recommendation:

- Define queue classes: lightweight, provider-bound, CPU-bound, IO-bound.
- Add per-tenant rate limits for expensive queues.
- Add separate worker deployments for evaluation, transcription, media, and email.
- Define backpressure behavior when queues are delayed.

## Security Concerns

### Concern: Tenant Isolation Relies on Application Convention

The current design requires every query to include `companyId`, but there is no mandatory enforcement.

Risk:

- A single missing `companyId` leaks candidate data across companies.
- Platform admin paths may accidentally reuse tenant paths.

Recommendation:

- Add a required tenant-scoped repository base pattern.
- Add automated tests that assert cross-tenant access denial for every tenant-owned resource.
- Consider PostgreSQL row-level security earlier than currently planned.
- Add a `tenant_context` design for every request and job.
- Require all BullMQ jobs carrying tenant data to include `companyId` and actor/system context.

Updated decision:

- Tenant isolation testing is a Phase 1 exit criterion, not a later hardening task.

### Concern: Magic Link Lifecycle Is Under-Specified

The docs say tokens are hashed, expiring, and optionally single-use. That optionality is dangerous.

Risk:

- Link forwarding.
- Replay after completion.
- Session fixation.
- Candidate link leakage through referrers or logs.

Recommendation:

- Magic links should be single-use for session creation.
- Candidate sessions should be short-lived, rotating, and bound to invitation/session.
- Raw token must be exchanged once, then cleared from URL.
- Use `Referrer-Policy: no-referrer` or strict equivalent.
- Add rate limits by IP, token hash attempt, and invitation.
- Add device/browser fingerprint as a soft risk signal, not a blocker.
- Define recovery rules if candidate closes browser mid-interview.

Updated decision:

- Magic tokens are always single-use for creating candidate sessions. Resume uses a separate short-lived session continuation mechanism.

### Concern: Identity Verification Stores Sensitive Data Without Classification

The schema includes identity verification metadata but does not classify or protect it.

Risk:

- Accidental storage of identity documents in metadata JSON.
- Longer-than-needed retention of sensitive identity data.
- Compliance exposure.

Recommendation:

- Define data classes: public, internal, confidential, restricted, biometric/sensitive.
- Identity documents and face-derived data are restricted.
- Metadata JSON must explicitly prohibit raw document images, biometric templates, or sensitive provider payloads.
- Add separate retention policy for identity verification.
- Add audit events for identity verification access.

### Concern: SMTP Secrets Are Vague

The docs say secrets are stored externally or encrypted, but no decision is made.

Risk:

- Secrets end up in plaintext database columns.
- Tenant SMTP credentials leak.

Recommendation:

- Decide now: use managed secrets in production; local encrypted env for development.
- Store only secret references in PostgreSQL.
- Rotate SMTP credentials and audit updates.

## Database Issues

### Issue: JSON Fields Are Overused for Core Business Data

Several important fields are JSON:

- `rubricJson`
- `questionPlanJson`
- `resultsJson`
- `competencyScoresJson`
- `evidenceJson`
- `reportJson`
- `usageJson`

Risk:

- Hard to query and index.
- Hard to migrate.
- Hard to report across tenants.
- Hard to validate version compatibility.

Recommendation:

- Keep JSON for versioned snapshots, but normalize core queryable data.
- Add rubric/version tables.
- Add competency score rows.
- Add evidence citation rows.
- Add usage event or usage counter tables.
- Store schema version with every JSON payload.

### Issue: Candidate Uniqueness Is Ambiguous

The candidates table indexes `companyId, email` but does not specify uniqueness.

Risk:

- Duplicate candidate profiles.
- Confusing HR history.
- Incorrect invitation association.

Recommendation:

- Use unique `companyId, normalizedEmail` for active candidates unless a tenant explicitly permits duplicates.
- Store normalized email separately.
- Support merge workflows with audit events.

### Issue: Soft Deletes Need Access Rules

Soft deletion is mentioned but not operationalized.

Risk:

- Deleted data appears in reports.
- Deleted records remain accessible by direct ID.
- GDPR deletion conflicts with audit retention.

Recommendation:

- Define deletion semantics per entity.
- Add repository-level default filters.
- Define legal deletion vs UI archive.
- Define anonymization for candidate deletion where audit events must remain.

### Issue: Audit Events Need Integrity Protection

Audit events are immutable by convention only.

Risk:

- Tampering by privileged operators.
- Compliance weakness.

Recommendation:

- Add append-only audit table rules.
- Consider hash chaining or external log sink for high-sensitivity events.
- Restrict update/delete permissions at the database role level.
- Include request ID, correlation ID, session ID, actor IP, user agent, and support reason.

## Multi-Tenancy Risks

### Risk: Platform Admin Access Is Too Broad

Platform admin can inspect tenant data, but approval and scoping are vague.

Recommendation:

- Add just-in-time support access.
- Require reason codes.
- Add time-limited support sessions.
- Notify or expose support access logs to company admins for enterprise plans.
- Separate platform roles: support, compliance, operations, super admin.

### Risk: Shared Queues May Leak Tenant Metadata

BullMQ payloads include tenant context, but no payload minimization policy exists.

Recommendation:

- Queue payloads should contain IDs and context only, not transcript text, emails where avoidable, raw prompts, or sensitive blobs.
- Workers should rehydrate data through authorized system service contexts.
- Job logs must redact PII.

### Risk: Tenant-Specific SMTP and Branding Can Be Abused

Custom email settings can enable phishing or domain spoofing.

Recommendation:

- Verify sender domains.
- Require DKIM/SPF/DMARC guidance.
- Add platform-level controls to disable tenant SMTP.
- Rate-limit outbound tenant email.
- Add bounce and complaint tracking.

## Performance Concerns

### Concern: Review Pages May Become Heavy

An interview review page could load recording metadata, transcript, evaluation, report, notes, and monitoring events.

Recommendation:

- Load review pages progressively.
- Paginate transcript segments.
- Aggregate monitoring warnings server-side.
- Use separate endpoints for expensive artifacts.
- Cache safe derived summaries.

### Concern: Candidate Event Ingestion Could Be Noisy

Monitoring and readiness events can generate high write volume.

Recommendation:

- Batch monitoring events in the browser.
- Server should validate event count, size, and frequency.
- Add sampling or aggregation for low-value repeated signals.
- Store raw high-frequency telemetry only if necessary; otherwise store summarized warnings.

### Concern: Search Is Under-Specified

Enterprise HR teams need fast search across candidates, roles, interviews, and reports.

Recommendation:

- Define search requirements early.
- Start with PostgreSQL indexes and trigram search if acceptable.
- Plan for external search later if needed.
- Avoid searching large transcript bodies synchronously in normal relational queries.

## Missing Modules

The following modules should be added or explicitly expanded:

- Compliance and Privacy Module.
- Workflow Orchestration Module.
- Notification Module beyond email delivery.
- Export Module.
- Search Module.
- Usage and Entitlements Module.
- Support Access Module.
- Data Lifecycle Module.
- Integration Module for future ATS, SSO, SCIM, and webhooks.
- Feature Flag and Plan Enforcement Module.

## Missing Edge Cases

Candidate edge cases:

- Candidate opens link on mobile when desktop is required.
- Candidate denies camera or microphone permanently.
- Candidate switches browser after starting.
- Candidate loses internet mid-answer.
- Candidate refreshes during recording upload.
- Candidate starts after invitation expiration but had already opened a session.
- Candidate requests accommodation or cannot use camera.
- Candidate wants to withdraw.
- Candidate disputes identity verification.
- Candidate has multiple valid invitations from same company.
- Candidate forwards link to another person.
- Candidate completes interview but recording upload fails.

HR edge cases:

- HR sends invitation to wrong email.
- HR revokes invitation while candidate is in progress.
- HR changes interview plan after invitations are sent.
- HR needs to extend expiration.
- HR needs to reprocess failed evaluation.
- HR needs to compare candidates for a role.
- HR needs to export candidate records.
- HR user leaves company and owns active roles.

System edge cases:

- Transcription succeeds but evaluation fails.
- Evaluation succeeds with low confidence or malformed provider output.
- Report generation fails after notification was sent.
- Object storage upload completes but callback fails.
- Email sent but delivery status unknown.
- Worker deploy happens during active processing.
- Database migration runs while old workers are active.

## Missing Candidate Flows

The candidate portal needs additional flows:

- Link expired with request-new-link guidance.
- Link revoked.
- Interview already completed.
- Interview already in progress in another browser.
- Resume interrupted session.
- Permission denied with browser-specific instructions.
- Unsupported browser/device.
- Poor connection with continue/retry choice.
- Recording upload recovery.
- Candidate withdrawal.
- Candidate support/contact path.
- Accessibility or accommodation request path.
- Privacy notice and data retention explanation.
- Final confirmation with what happens next.

## Missing HR Workflows

HR product needs more than invitation and review:

- Bulk candidate import.
- Bulk invitation send.
- Invitation extension.
- Candidate merge.
- Candidate archive/delete request.
- Interview plan versioning and published snapshots.
- Review assignment.
- Collaborative notes.
- Decision history.
- Score override with reason.
- Evaluation re-run with reason.
- Candidate comparison by role.
- Export report.
- Share report internally with permission controls.
- Results-ready notification preferences.
- SLA views for pending reviews.

## Missing Admin Functionality

Platform admin needs:

- Tenant support access workflow.
- Tenant health overview.
- Queue replay and job cancellation.
- Failed job inspection with redaction.
- Email deliverability dashboard.
- Storage usage by tenant.
- AI provider usage and failure dashboard.
- Audit event export.
- Legal hold controls.
- Tenant data export controls.
- Tenant suspension impact preview.
- Feature flag management.
- Plan entitlement override.
- Operational incident banner or tenant notification.

Company admin needs:

- SSO configuration later, but design hooks now.
- Domain verification.
- Data retention settings per data class.
- User deprovisioning.
- Role permission audit.
- Support access visibility.
- API/webhook settings later.

## Missing Audit Capabilities

Audit coverage should include:

- Every recording access URL creation.
- Transcript access.
- Evaluation access.
- Report export.
- Score override.
- Recommendation change.
- Invitation resend, revoke, extend, and expiration.
- Candidate session creation and resume.
- Identity verification status change.
- Retention policy changes.
- SMTP changes and test sends.
- Role and permission changes.
- Platform support access start and end.
- AI evaluation provider, model, prompt version, and rubric version.

Audit event fields should add:

- `requestId`
- `correlationId`
- `sessionId`
- `supportAccessId`
- `reason`
- `beforeJson`
- `afterJson`
- `riskLevel`

## Missing Reporting

Current reporting is candidate-level. Enterprise HR needs aggregate reporting:

- Role pipeline overview.
- Invitation conversion rates.
- Completion rates.
- Drop-off by readiness step.
- Average processing time.
- Evaluation distribution by role.
- Monitoring warning frequency.
- Reviewer workload.
- Time-to-review.
- Email delivery success.
- Exportable candidate report.
- Exportable role summary.
- Compliance access report.

Recommendation:

- Add Reporting and Analytics data model beyond `hr_reports`.
- Capture domain events for analytics from the beginning.
- Keep analytics separate from operational tables where possible.

## Missing AI Integration Points

The provider-agnostic direction is right, but too abstract.

Missing decisions:

- Prompt template versioning.
- Rubric versioning.
- Evaluation reproducibility.
- Provider timeout and fallback behavior.
- Provider cost tracking.
- PII redaction policy before sending to provider.
- Data processing agreement requirements for providers.
- Bias and fairness review process.
- Human override model.
- Confidence and uncertainty representation.
- Malformed response handling.
- Evaluation appeal or dispute workflow.

Recommendation:

- Add an AI Governance Module.
- Store model/provider/prompt/rubric versions for every evaluation.
- Store normalized result separately from provider payload.
- Define whether transcripts are redacted before evaluation.
- Require evidence citations for every material claim.
- Never expose "AI verdict" language.

## Missing Compliance Considerations

The current docs mention SOC 2 readiness but do not define controls.

Required compliance design areas:

- GDPR/UK GDPR readiness.
- CCPA/CPRA readiness.
- Data processing agreements.
- Subprocessor list.
- Data residency strategy.
- Right to access.
- Right to deletion/anonymization.
- Legal hold.
- Consent records.
- Retention by data class.
- Encryption in transit and at rest.
- Secret rotation.
- Least privilege operations.
- Security incident response.
- Vulnerability management.
- Accessibility compliance target.
- AI decision support disclaimers.

Recommendation:

- Add a Compliance and Privacy section to the architecture before implementation.
- Define data classes and retention defaults now.

## Missing Accessibility Requirements

The UI docs include general accessibility requirements but not enough for a candidate interview platform.

Missing requirements:

- WCAG 2.2 AA target.
- Captions or transcript alternatives for instructions.
- Keyboard-only candidate flow.
- Screen reader labels for readiness checks.
- Clear non-color status indicators.
- Reduced motion support.
- Error recovery instructions.
- Accommodation request path.
- Support for candidates who cannot complete webcam-based identity checks.
- Time limit warning and extension policy.

Recommendation:

- Treat candidate accessibility as a core product requirement, not a UI polish task.

## Missing Deployment Considerations

Deployment is currently too simple for enterprise production.

Missing:

- Region strategy.
- CDN strategy.
- Object storage bucket isolation and lifecycle policies.
- Database connection pooling.
- Zero-downtime migration strategy.
- Worker deployment compatibility.
- Environment variable and secret management.
- Preview/staging data policy.
- Release rollback plan.
- Background job draining during deploy.
- Scheduled jobs and cron ownership.

Recommendation:

- Add a deployment runbook before implementation.
- Define production topology with web, worker classes, database, Redis, object storage, CDN, monitoring, and secrets manager.

## Missing Monitoring and Observability

Current observability is listed but not designed.

Required telemetry:

- Request metrics by route, tenant, and status class.
- Queue depth and job age.
- Worker success/failure rate.
- Email delivery rate.
- Recording upload failure rate.
- Candidate readiness failure rate.
- Interview completion rate.
- AI provider latency, error rate, and cost.
- Transcription/evaluation/report processing latency.
- Database slow queries.
- Redis health.
- Object storage errors.
- Audit log write failures.

Required operational tools:

- Structured logs with request IDs.
- Distributed tracing across web and workers.
- Alert thresholds.
- On-call dashboards.
- Synthetic candidate interview smoke test.
- Dead-letter queue review.

Recommendation:

- Add observability acceptance criteria to Phase 1 and every major processing phase.

## Missing Disaster Recovery Planning

DR is not currently designed.

Required decisions:

- Recovery Time Objective.
- Recovery Point Objective.
- PostgreSQL backup frequency.
- Point-in-time recovery.
- Redis persistence expectations.
- BullMQ job recovery behavior.
- Object storage versioning.
- Cross-region backup strategy.
- Backup restore testing cadence.
- Tenant-level restore policy.
- Incident communication plan.

Recommended initial targets:

- RPO: 15 minutes for PostgreSQL production data.
- RTO: 4 hours for core application recovery.
- Object storage versioning enabled for recordings and reports.
- Daily restore verification in staging or isolated environment.

Updated decision:

- DR design must be documented before production implementation begins, and backup/restore must be tested before any enterprise customer launch.

## Recommended Architecture Changes Before Coding

1. Add a Compliance and Privacy Module.
2. Add a Workflow Orchestration Module for interview post-processing.
3. Add a Support Access Module for platform admin access control.
4. Add a Data Lifecycle Module for retention, deletion, anonymization, legal hold, and export.
5. Promote tenant isolation tests and repository enforcement to Phase 1.
6. Make candidate magic links always single-use for session creation.
7. Define candidate session resume semantics.
8. Define data classification and retention by data class.
9. Define media storage lifecycle, CDN/range request support, and upload recovery.
10. Define audit event integrity protections and expanded audit fields.
11. Define AI governance: prompt versioning, rubric versioning, provider metadata, redaction, evidence requirements.
12. Define queue workflow idempotency, replay, poison job, and dead-letter operations.
13. Define database partitioning compatibility for append-heavy tables.
14. Define enterprise reporting and analytics event capture.
15. Define DR targets, backup strategy, and restore testing.

## Documents That Should Be Updated Before Implementation

### `docs/ARCHITECTURE.md`

Add:

- Compliance and Privacy Module.
- Workflow Orchestration Module.
- Support Access Module.
- Data Lifecycle Module.
- Search Module.
- Usage and Entitlements Module.
- Stronger tenant isolation enforcement.
- Queue orchestration design.
- DR and observability architecture.

### `docs/DATABASE.md`

Add or revise:

- Data classification fields or policy mapping.
- Legal hold tables.
- Export request tables.
- Support access session tables.
- Workflow processing tables.
- Evaluation evidence and competency normalized tables.
- Audit event expanded fields.
- Candidate session table.
- Idempotency key table.
- Partitioning strategy.

### `docs/API_SPEC.md`

Add:

- API versioning conventions.
- Idempotency headers for mutations.
- Cursor pagination standard.
- Candidate resume APIs.
- Candidate withdrawal/support APIs.
- Admin queue replay APIs.
- Export APIs.
- Support access APIs.
- Evaluation reprocess APIs.

### `docs/PRODUCT_SPEC.md`

Add:

- Candidate recovery flows.
- HR collaboration workflows.
- Enterprise compliance expectations.
- Human override and decision governance.
- Support access transparency.

### `docs/ROADMAP.md`

Change:

- Move tenant isolation testing, observability foundation, DR planning, data classification, and compliance basics into Phase 1.
- Move email deliverability and support operations earlier.
- Add workflow orchestration before full interview processing.

### `docs/UI_GUIDELINES.md`

Add:

- WCAG 2.2 AA target.
- Candidate accommodation flow guidance.
- Review UI guidance for uncertainty, evidence, and human override.
- Warning language examples for monitoring events.

## Final Design Verdict

The current design is a strong first architecture draft, but it is not yet ready for implementation as an enterprise platform. The biggest issue is not the technology stack; the stack is appropriate. The issue is that several enterprise guarantees are stated as intentions rather than enforceable architecture.

Before coding begins, Aptly should redesign the foundation around enforceable tenant isolation, formal data governance, durable workflow orchestration, auditable support access, explicit disaster recovery, and AI evaluation governance. Those decisions will make the modular monolith much safer to build and much easier to scale later.
