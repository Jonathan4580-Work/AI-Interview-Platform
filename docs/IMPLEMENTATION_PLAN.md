# Implementation Plan

## Purpose

This is the master engineering plan for Aptly. It defines the required build order for a production-ready enterprise recruitment platform. Development must follow this order unless the architecture documents are explicitly updated and approved.

This plan intentionally prevents teams from building visible product features before the security, tenancy, workflow, privacy, observability, and recovery foundations exist.

## Implementation Status

The following approved implementation slices have been completed and verified:

- Phase 1: Foundation.
- Phase 2: Enterprise Control Plane.
- Phase 3: Company and HR Workspace domain foundation.
- Phase 4A: Application Layer and Authentication.
- Phase 4B: Design System and Application Shell.

Phase 4A and Phase 4B were approved sub-phases added before the original Phase 4 Email System. They do not change the remaining dependency order. The original Phase 4 Email System still follows Phase 3 and remains a prerequisite for Phase 5 Candidate Portal and Readiness.

## Build Rules

- Do not build candidate interview features before tenant isolation, audit, support access, data classification, and candidate session foundations exist.
- Do not build post-interview evaluation before workflow orchestration, media upload, transcript storage, and AI governance foundations exist.
- Do not build enterprise reporting before analytics events, search boundaries, exports, and permission controls exist.
- Do not add provider-specific AI logic directly to product workflows.
- Do not stream recordings through the application server.
- Do not store raw magic tokens, SMTP secrets, identity documents, transcripts, raw prompts, or signed media URLs in logs or queue payloads.
- Every phase must pass its exit criteria before the next phase begins.

## Module Dependency Map

### Foundation Dependencies

- Identity depends on Tenant and Audit foundations.
- Access Control depends on Identity and Tenant.
- Tenant-scoped repositories depend on Tenant Context.
- Audit depends on Request Context and Actor Context.
- Observability depends on Request Context and Worker Context.

### Enterprise Control Dependencies

- Support Access depends on Platform Identity, Tenant, Access Control, and Audit.
- Compliance and Privacy depends on Tenant, Audit, Candidate records, and Data Lifecycle.
- Data Lifecycle depends on Retention Policy, Legal Hold, Audit, and Object Storage metadata.
- Usage and Entitlements depends on Tenant and Billing-readiness records.

### Candidate Workflow Dependencies

- Invitations depend on Candidate, Job Role, Interview Plan, Email, Audit, and Candidate Session.
- Candidate Session depends on Invitation, Magic Token, Rate Limiting, and Audit.
- Readiness depends on Candidate Session, Consent, Identity Verification, and Audit.
- Interview Session depends on Candidate Session, Interview Plan Snapshot, Media, and Workflow.

### Processing Dependencies

- Workflow Orchestration depends on BullMQ, Redis, PostgreSQL, Audit, Idempotency, and Observability.
- Media depends on Object Storage, Signed URLs, Workflow, Audit, and Data Lifecycle.
- Transcription depends on Media, Workflow, Provider Abstraction, and Transcript storage.
- Evaluation depends on Transcript, AI Governance, Rubric Versioning, Workflow, and Audit.
- Reporting depends on Evaluation, Transcript, Monitoring Summary, Export, and Audit.

### Enterprise Scale Dependencies

- Search depends on normalized operational data and permission filters.
- Reporting and Analytics depend on analytics events and aggregate-safe data.
- Exports depend on Object Storage, Signed URLs, Audit, and Data Lifecycle.
- Integrations depend on stable domain events and API versioning.

## Complexity Scale

- Low: narrow scope, mostly isolated.
- Medium: multiple modules or moderate risk.
- High: security, tenancy, workflow, sensitive data, or major operational complexity.
- Very High: cross-cutting infrastructure, production launch, compliance, or long-running workflows.

## Phase 1: Foundation

### Objectives

Establish the application, data, tenancy, access, audit, observability, and recovery foundation without building candidate interview features.

### Files/Modules Affected

- App shell.
- Environment configuration.
- Tenant Module.
- Identity Module.
- Access Control Module.
- Audit Module.
- Observability Module.
- Idempotency foundation.
- Prisma/PostgreSQL foundation.
- Redis/BullMQ foundation.
- Docker local environment.

### Prerequisites

- Approved documentation set.
- Local development environment.
- Database and Redis available locally.

### Build Order

1. Project scaffold and tooling.
2. Environment and secret reference conventions.
3. Database and Prisma setup.
4. Tenant model and tenant context.
5. Identity model for platform and company users.
6. Access control policies.
7. Tenant-scoped repository/service pattern.
8. Audit event writer.
9. Request IDs and correlation IDs.
10. Observability baseline.
11. Idempotency table and middleware pattern.
12. Backup and restore runbook draft.

### Acceptance Criteria

- Local app runs through Docker.
- Migrations apply cleanly.
- Authenticated company requests resolve exactly one tenant.
- Cross-tenant access tests exist and pass for foundation records.
- Audit events can be written with request and actor context.
- Logs include request IDs and redact sensitive values.
- Health checks exist for web, database, and Redis.
- No candidate interview functionality exists.

### Testing Checklist

- Unit tests for tenant context resolution.
- Unit tests for permission checks.
- Integration tests for tenant-scoped repositories.
- Cross-tenant denial tests.
- Audit write tests.
- Basic health check tests.
- Migration apply/rollback dry run in local environment.

### Potential Risks

- Tenant context leaks into route handlers without enforcement.
- Audit writer becomes optional instead of standard.
- Early shortcuts become permanent architecture.

### Rollback Considerations

- Database migrations must be reversible in development.
- No production data exists in this phase.
- Feature work should be blocked until foundation tests pass.

### Estimated Complexity

Very High.

## Phase 2: Enterprise Control Plane

### Objectives

Build support access, compliance, data lifecycle, privacy, entitlements, legal hold, exports, and stronger audit foundations before candidate data begins flowing.

### Files/Modules Affected

- Support Access Module.
- Compliance and Privacy Module.
- Data Lifecycle Module.
- Usage and Entitlements Module.
- Export Module foundation.
- Audit Module.
- Platform Admin.
- Company Settings.

### Prerequisites

- Phase 1 complete.
- Platform and company identity available.
- Tenant-scoped repositories enforced.

### Build Order

1. Expanded audit fields and immutable access pattern.
2. Support access sessions.
3. Platform support role separation.
4. Company-visible support access history.
5. Data classification constants and policy mapping.
6. Retention policy records.
7. Legal hold records.
8. Privacy request records.
9. Export request foundation.
10. Entitlement checks.
11. Feature flags and plan overrides.

### Acceptance Criteria

- Platform admins cannot inspect tenant data without explicit support context where required.
- Support access sessions require reason, expiration, and audit events.
- Company admins can view support access history.
- Legal hold can block deletion workflows.
- Privacy request records can be created and tracked.
- Entitlement checks can block restricted operations.

### Testing Checklist

- Support access permission tests.
- Support session expiration tests.
- Audit tests for support access start/end.
- Legal hold enforcement tests.
- Entitlement allow/deny tests.
- Privacy request creation tests.

### Potential Risks

- Support access becomes too permissive.
- Legal hold and retention rules conflict.
- Entitlements are bypassed by background jobs.

### Rollback Considerations

- Disable support access feature flag if policy bugs appear.
- Preserve audit events even if UI is rolled back.
- Legal hold records must not be deleted by rollback.

### Estimated Complexity

High.

## Phase 3: Company and HR Workspace

### Objectives

Enable company admins and HR users to configure workspaces, manage teams, create roles, version interview plans, manage candidates, and prepare invitations.

### Files/Modules Affected

- Company Workspace.
- Platform Admin company management.
- Team and Role UI.
- Job Role Module.
- Interview Plan Module.
- Candidate Module.
- Invitation Module foundation.
- Search foundation for operational records.

### Prerequisites

- Phase 2 complete.
- Access control and support access available.
- Audit and tenant enforcement active.

### Build Order

1. Company settings UI.
2. Team management.
3. Role and permission UI.
4. Job role management.
5. Interview plan versioning.
6. Candidate records.
7. Candidate merge/archive.
8. Invitation draft management without sending.
9. Review assignment foundation.
10. Domain verification UI foundation.

### Acceptance Criteria

- Company admins can manage workspace settings and team roles.
- HR can create job roles and versioned interview plans.
- Invitations reference immutable published plan snapshots.
- Candidate uniqueness and merge behavior are defined.
- Sensitive changes create audit events.

### Testing Checklist

- Permission matrix tests.
- Interview plan snapshot tests.
- Candidate uniqueness tests.
- Candidate merge audit tests.
- Tenant isolation tests for each workspace resource.
- UI smoke tests for core HR screens.

### Potential Risks

- Interview plan edits affect already-sent invitations.
- Candidate duplicates create confusing history.
- Role permissions become too coarse for enterprise teams.

### Rollback Considerations

- Preserve published interview plan snapshots.
- Do not delete candidate records in rollback.
- Disable bulk or merge actions by feature flag if needed.

### Estimated Complexity

High.

## Phase 4: Email System

Status: completed and verified after approved Phase 4A and Phase 4B sub-phases.

### Objectives

Build reliable, queued, professional email delivery with SMTP configuration, templates, sender verification, deliverability tracking, and tenant safety controls.

### Files/Modules Affected

- Email Module.
- BullMQ email queue.
- SMTP Profiles.
- Email Templates.
- Verified Domains.
- Email Deliveries.
- Company Email Settings UI.
- Platform Email Admin.

### Prerequisites

- Phase 3 complete.
- Managed secret reference pattern available.
- Invitation records exist.

### Build Order

1. SMTP profile metadata.
2. Secret reference integration.
3. Email template rendering.
4. Email queue.
5. Delivery logging.
6. Invitation email.
7. Reminder email.
8. Expired invitation email.
9. Sender domain verification.
10. Bounce and complaint tracking.
11. Tenant rate limits.
12. Platform disable controls.

### Acceptance Criteria

- Emails are always queued.
- Delivery attempts are logged.
- Tenant SMTP credentials are never stored directly in the database.
- Custom sender domains require verification.
- HR can see delivery status.
- Platform admins can disable tenant SMTP.

### Testing Checklist

- Template rendering tests.
- Queue idempotency tests.
- SMTP failure retry tests.
- Delivery status tests.
- Domain verification tests.
- Rate-limit tests.
- Redaction tests for email logs.

### Potential Risks

- Misconfigured SMTP harms deliverability.
- Resend creates duplicate active tokens.
- Email templates expose unsafe variables.

### Rollback Considerations

- Fall back to platform SMTP if tenant SMTP fails.
- Disable custom SMTP per tenant.
- Preserve delivery logs.

### Estimated Complexity

Medium-High.

## Phase 5: Candidate Portal and Readiness

### Objectives

Build secure candidate entry through single-use magic links, candidate sessions, consent, readiness checks, identity verification placeholder, accommodations, and withdrawal flows.

### Files/Modules Affected

- Candidate Portal.
- Candidate Session Module.
- Invitation Module.
- Readiness Module.
- Consent Records.
- Identity Verification.
- Accommodation/Support flow.
- Candidate audit events.

### Prerequisites

- Phase 4 complete.
- Invitation emails can be delivered.
- Candidate records and invitations exist.
- Support/privacy foundations exist.

### Build Order

1. Magic token generation and hashing.
2. Single-use token exchange.
3. Candidate session cookies/state.
4. Resume session mechanism.
5. Expired/revoked/completed/in-progress screens.
6. Consent capture.
7. Identity verification placeholder.
8. Camera permission check.
9. Microphone permission check.
10. Browser compatibility check.
11. Internet quality check.
12. Instructions screen.
13. Accommodation request.
14. Withdrawal flow.

### Acceptance Criteria

- Candidates never create accounts.
- Magic links are single-use for session creation.
- Raw tokens are cleared from browser-visible URLs.
- Resume uses short-lived continuation sessions.
- Readiness results persist.
- Candidate support, withdrawal, and accommodation paths exist.
- Candidate flow meets WCAG 2.2 AA checks.

### Testing Checklist

- Token hashing and consumption tests.
- Replay prevention tests.
- Expired/revoked link tests.
- Resume session tests.
- Permission-denied UI tests.
- Accessibility tests.
- Rate-limit tests.
- Candidate audit event tests.

### Potential Risks

- Link replay or forwarding.
- Candidate lockout after recoverable browser failure.
- Accessibility gaps block real candidates.

### Rollback Considerations

- Disable candidate portal entry while preserving invitations.
- Reissue invitation tokens if token logic changes before production.
- Keep candidate support path available.

### Estimated Complexity

Very High.

## Phase 6: Workflow and Media Foundation

### Objectives

Build durable workflow orchestration and reliable media upload before interviews depend on recording and post-processing.

### Files/Modules Affected

- Workflow Orchestration Module.
- Media Module.
- Recording metadata.
- Object storage integration.
- BullMQ workers.
- Platform queue admin.
- Observability.

### Prerequisites

- Phase 5 complete.
- Candidate sessions available.
- Object storage selected.
- BullMQ foundation active.

### Build Order

1. Processing workflow records.
2. Workflow step records.
3. Idempotent job helpers.
4. Queue worker structure by resource class.
5. Dead-letter and poison job handling.
6. Manual replay and cancellation.
7. Recording metadata.
8. Signed upload URLs.
9. Multipart/resumable upload.
10. Upload completion verification.
11. Signed playback URLs.
12. Upload recovery.
13. Media retention hooks.

### Acceptance Criteria

- Workflow steps can retry safely.
- Failed steps are inspectable with redacted data.
- Platform admins can replay authorized failed steps.
- Media uploads do not pass through the app server.
- Playback uses short-lived signed URLs.
- Interrupted upload recovery works where supported.

### Testing Checklist

- Workflow state transition tests.
- Idempotency tests.
- Queue retry tests.
- Dead-letter tests.
- Signed URL permission tests.
- Upload completion tests.
- Upload recovery tests.
- Media access audit tests.

### Potential Risks

- Duplicate workflow jobs create duplicate artifacts.
- Large media upload failures frustrate candidates.
- Signed URLs leak through logs.

### Rollback Considerations

- Stop workers before rolling back incompatible workflow code.
- Keep existing uploaded objects immutable.
- Preserve workflow records for manual repair.

### Estimated Complexity

Very High.

## Phase 7: Browser Interview Session

### Objectives

Run structured browser interviews with state recovery, recording capture, question sequencing, and durable completion.

### Files/Modules Affected

- Interview Module.
- Candidate Interview UI.
- Interview Turns.
- Recording capture.
- Media Module.
- Workflow Orchestration.
- Audit Module.

### Prerequisites

- Phase 6 complete.
- Interview plans are versioned.
- Candidate readiness is complete.

### Build Order

1. Interview state machine.
2. Start interview transition.
3. Question sequencing.
4. Candidate answer capture.
5. Browser recording capture.
6. Heartbeat and last-activity tracking.
7. Refresh and short interruption resume.
8. Complete interview transition.
9. Workflow creation on completion.
10. HR session metadata view.

### Acceptance Criteria

- Candidate can complete a structured browser interview.
- State transitions reject invalid actions.
- Refresh or short network interruption can recover.
- Completion creates a processing workflow.
- Recording metadata is visible to authorized HR users.

### Testing Checklist

- State machine tests.
- Start/complete transition tests.
- Invalid transition tests.
- Resume tests.
- Recording capture browser tests.
- Tenant isolation tests.
- Audit event tests.

### Potential Risks

- Browser API differences affect recording reliability.
- Candidate state becomes inconsistent during interruptions.
- Interview plan changes leak into active sessions.

### Rollback Considerations

- Pause new interview starts.
- Allow in-progress sessions to complete if compatible.
- Preserve existing session and recording metadata.

### Estimated Complexity

Very High.

## Phase 8: Monitoring Warnings

### Objectives

Add browser-based monitoring warning signals without creating automatic rejection behavior.

### Files/Modules Affected

- Monitoring Module.
- Candidate Interview UI.
- Monitoring Events API.
- Review UI warning timeline.
- Analytics events.

### Prerequisites

- Phase 7 complete.
- Candidate interview session exists.
- Event ingestion limits exist.

### Build Order

1. Monitoring event schema.
2. Browser event batching.
3. Server validation for event count, size, and frequency.
4. Looking-away warnings.
5. Multiple-face warnings.
6. Camera-blocked warnings.
7. Leaving-frame warnings.
8. Focus-loss warnings.
9. Network-degraded warnings.
10. Aggregation and summary.
11. HR warning timeline.

### Acceptance Criteria

- Monitoring signals are warnings only.
- No automatic rejection logic exists.
- Events are rate-limited and summarized.
- HR UI frames warnings as contextual evidence.
- Candidate copy remains non-alarming.

### Testing Checklist

- Event validation tests.
- Rate-limit tests.
- Batching tests.
- Warning summary tests.
- UI copy review.
- Accessibility tests for warning timeline.

### Potential Risks

- HR users treat warnings as verdicts.
- Event volume creates write pressure.
- Browser detection creates false positives.

### Rollback Considerations

- Disable individual monitoring event types by feature flag.
- Keep interview completion independent from monitoring.
- Preserve stored warnings for audit context.

### Estimated Complexity

High.

## Phase 9: Transcript, Evaluation, AI Governance, and Reports

### Objectives

Generate transcript, evaluation, score, HR report, evidence citations, confidence indicators, and human decision controls through governed provider-agnostic workflows.

### Files/Modules Affected

- Transcription Module.
- Evaluation Module.
- AI Governance Module.
- Reporting Module.
- Workflow Orchestration.
- Transcript UI.
- Review UI.
- Decision History.
- Score Overrides.

### Prerequisites

- Phase 8 complete.
- Workflow orchestration active.
- Media and interview sessions complete reliably.
- Rubric versions exist.

### Build Order

1. Transcript aggregate and segment storage.
2. Transcription workflow step.
3. Transcript review UI.
4. AI governance records.
5. Prompt and rubric versioning.
6. Evaluation provider interface.
7. Provider timeout and malformed response handling.
8. Redaction policy.
9. Normalized evaluation storage.
10. Competency scores.
11. Evidence citations.
12. HR report generation.
13. Confidence and uncertainty UI.
14. Score override.
15. Decision history.
16. Results-ready notification.

### Acceptance Criteria

- Completed interviews generate transcript, evaluation, score, and HR report.
- Every evaluation records provider, model, prompt, rubric, evidence, and confidence metadata.
- Provider-specific data is isolated from normalized results.
- HR can override scores with a reason.
- HR decisions remain human-owned.
- Failed evaluation can be reprocessed safely.

### Testing Checklist

- Transcript segment tests.
- Provider adapter contract tests.
- Malformed provider response tests.
- Redaction tests.
- Evidence citation tests.
- Evaluation normalization tests.
- Score override audit tests.
- Workflow reprocess tests.

### Potential Risks

- AI output appears too authoritative.
- Provider failure blocks reporting.
- Prompt/rubric changes make evaluations non-reproducible.
- Transcript errors degrade evaluation quality.

### Rollback Considerations

- Disable provider adapter by feature flag.
- Preserve transcripts if evaluation rolls back.
- Supersede evaluations only after replacement succeeds.

### Estimated Complexity

Very High.

## Phase 10: Enterprise Reporting and Search

### Objectives

Provide search, aggregate reporting, exports, and role-level comparison for large HR teams.

### Files/Modules Affected

- Search Module.
- Reporting Module.
- Export Module.
- Analytics Events.
- Company Reports UI.
- Platform Reports UI.

### Prerequisites

- Phase 9 complete.
- Analytics event capture active.
- Export request foundation exists.

### Build Order

1. Workspace search.
2. Candidate search.
3. Role and interview search.
4. Report search.
5. Analytics event capture review.
6. Role pipeline reports.
7. Invitation conversion reports.
8. Completion and readiness reports.
9. Processing latency reports.
10. Email deliverability reports.
11. Reviewer workload reports.
12. Compliance access reports.
13. Candidate comparison.
14. Export workflows.

### Acceptance Criteria

- HR can quickly find candidates, roles, interviews, and reports.
- Large reports are asynchronous.
- Exports are signed, expiring, and audited.
- Analytics events avoid raw restricted content.
- Compliance reports include support access and sensitive artifact access.

### Testing Checklist

- Permission-filtered search tests.
- Report query performance tests.
- Export audit tests.
- Signed export URL tests.
- Analytics redaction tests.
- Large report workflow tests.

### Potential Risks

- Reporting queries overload operational tables.
- Search exposes restricted transcript content.
- Exports leak sensitive data.

### Rollback Considerations

- Disable expensive reports by feature flag.
- Expire generated exports.
- Keep analytics capture independent from report UI.

### Estimated Complexity

High.

## Phase 11: Enterprise Hardening

### Objectives

Harden security, reliability, accessibility, retention, observability, deployment, and incident operations before production launch.

### Files/Modules Affected

- Security controls.
- Observability Module.
- Audit Module.
- Data Lifecycle Module.
- Deployment configuration.
- Documentation and runbooks.
- Test infrastructure.

### Prerequisites

- Phase 10 complete.
- All major product workflows implemented.

### Build Order

1. Security review.
2. Rate-limit review.
3. Security headers.
4. Advanced audit search.
5. Retention jobs.
6. Legal hold enforcement verification.
7. Privacy request workflow verification.
8. Backup and restore implementation.
9. Restore verification.
10. Observability dashboards.
11. Alerting.
12. Synthetic interview smoke test.
13. Accessibility audit.
14. Incident response runbook.
15. Deployment and rollback runbooks.

### Acceptance Criteria

- No known P0/P1 security findings remain.
- Retention jobs are tested.
- Restore process is tested.
- Alerts fire for critical failure modes.
- Accessibility issues are fixed or explicitly risk accepted.
- Incident and rollback runbooks are usable.

### Testing Checklist

- Security regression tests.
- Cross-tenant full-suite tests.
- Retention and legal hold tests.
- Backup restore drill.
- Synthetic interview test.
- Load tests for critical APIs.
- Accessibility audit.
- Queue failure drill.

### Potential Risks

- Late hardening reveals schema or architecture flaws.
- Restore process works in theory but not under time pressure.
- Accessibility remediation affects UI timing.

### Rollback Considerations

- Harden behind configuration where possible.
- Preserve data lifecycle logs.
- Roll back UI changes separately from schema changes where possible.

### Estimated Complexity

Very High.

## Phase 12: Integrations and Scale

### Objectives

Add enterprise integrations and scale options after core domain boundaries are stable.

### Files/Modules Affected

- Integration Module.
- Webhook infrastructure.
- SSO.
- SCIM.
- ATS connectors.
- Event outbox.
- Worker scaling.
- Storage region configuration.

### Prerequisites

- Phase 11 complete.
- Stable domain events.
- API versioning conventions active.

### Build Order

1. Event outbox.
2. External webhook subscriptions.
3. SSO foundations.
4. SCIM foundations.
5. ATS connector abstraction.
6. First ATS integration.
7. Advanced worker scaling.
8. Multi-region storage strategy.
9. Optional module extraction planning.

### Acceptance Criteria

- Integrations use stable domain events.
- Integration failures do not break core interview workflows.
- SSO and SCIM are audited.
- Scaling work does not require domain rewrites.

### Testing Checklist

- Webhook retry tests.
- Event outbox tests.
- SSO auth tests.
- SCIM provisioning tests.
- ATS sync tests.
- Worker scale tests.

### Potential Risks

- ATS-specific assumptions pollute core models.
- Webhook retries create duplicate side effects.
- SSO misconfiguration locks out tenants.

### Rollback Considerations

- Disable integrations per tenant.
- Preserve local auth break-glass access for company admins.
- Keep integration records separate from core records.

### Estimated Complexity

High.

## Phase 13: Production Deployment

### Objectives

Launch a production-ready deployment with monitored infrastructure, backup/restore, DR targets, release controls, and operational readiness.

### Files/Modules Affected

- Infrastructure configuration.
- Deployment pipelines.
- Production secrets.
- Monitoring dashboards.
- Alerting.
- Runbooks.
- Release management.

### Prerequisites

- Phase 11 complete for core launch.
- Phase 12 complete only if integrations are part of launch scope.
- Production infrastructure approved.

### Build Order

1. Production infrastructure provisioning.
2. Managed PostgreSQL with PITR.
3. Production Redis.
4. Object storage with versioning and lifecycle policies.
5. CDN for media.
6. Managed secret store.
7. Web deployment.
8. Worker deployments by queue class.
9. Monitoring dashboards.
10. Alert rules.
11. Synthetic interview smoke tests.
12. Backup restore verification.
13. Release rollback drill.
14. Production readiness review.

### Acceptance Criteria

- RPO and RTO targets are accepted.
- Backup restore has been verified.
- Production smoke tests pass.
- Alerting is active.
- Rollback process has been rehearsed.
- No P0 security, tenancy, privacy, or DR findings remain.

### Testing Checklist

- Production smoke test.
- Synthetic candidate interview.
- Worker processing test.
- Email deliverability test.
- Recording upload/playback test.
- Restore drill.
- Alert drill.
- Rollback drill.

### Potential Risks

- Infrastructure differs from staging.
- Worker deploys process incompatible jobs.
- DNS, email, or CDN configuration blocks launch.
- Restore takes longer than target.

### Rollback Considerations

- Maintain previous production image.
- Drain workers before incompatible deploys.
- Use feature flags to disable risky flows.
- Preserve database migrations with forward-fix strategy for production.

### Estimated Complexity

Very High.

## Milestone Roadmap

### Milestone 1: Architecture Complete

Includes Phase 0.

Outcome:

- Documentation approved.
- P0/P1 design review recommendations incorporated.
- Implementation order accepted.

### Milestone 2: Secure Foundation

Includes Phase 1.

Outcome:

- App, tenancy, identity, access, audit, observability, and DR planning foundations exist.

### Milestone 3: Enterprise Controls

Includes Phase 2.

Outcome:

- Support access, compliance, privacy, data lifecycle, entitlements, legal holds, and export foundations exist.

### Milestone 4: HR Operating System

Includes Phase 3 and Phase 4.

Outcome:

- Companies can manage teams, roles, plans, candidates, invitations, and professional queued email.

### Milestone 5: Candidate Entry

Includes Phase 5.

Outcome:

- Candidates can securely enter through single-use magic links and complete readiness checks without accounts.

### Milestone 6: Interview Execution

Includes Phase 6, Phase 7, and Phase 8.

Outcome:

- Browser interviews, recording, recovery, durable processing workflows, and warning-only monitoring work reliably.

### Milestone 7: Review Intelligence

Includes Phase 9.

Outcome:

- Transcripts, evaluations, evidence, reports, scores, human overrides, and decision history are available.

### Milestone 8: Enterprise Visibility

Includes Phase 10.

Outcome:

- Search, aggregate reporting, candidate comparison, and audited exports support large HR teams.

### Milestone 9: Production Readiness

Includes Phase 11.

Outcome:

- Security, observability, retention, DR, accessibility, and runbooks are production-ready.

### Milestone 10: Enterprise Expansion

Includes Phase 12.

Outcome:

- SSO, SCIM, ATS, webhooks, and scale investments can be added without rewriting core workflows.

### Milestone 11: Production Launch

Includes Phase 13.

Outcome:

- Aptly is deployed with monitored production infrastructure, tested restore, release rollback, synthetic smoke tests, and no unresolved P0 risks.
