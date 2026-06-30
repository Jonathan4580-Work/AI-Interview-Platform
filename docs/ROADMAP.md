# Roadmap

## Roadmap Principles

Aptly is not an MVP experiment. The roadmap sequences work so enterprise controls exist before sensitive candidate workflows depend on them.

Each phase must preserve:

- Enforceable tenant isolation.
- Auditability and support access governance.
- Replaceable module boundaries.
- Candidate privacy and accessibility.
- Human-owned hiring decisions.
- Durable workflow processing.
- Observability and disaster recovery readiness.
- Premium enterprise UI quality.

No feature phase may begin if its prerequisite security, tenancy, workflow, or compliance foundation is missing.

## Phase 0: Architecture Approval

Status: complete.

Deliverables:

- Product specification.
- Architecture design.
- Database design.
- API specification.
- UI guidelines.
- Brand guide.
- Design review.
- Roadmap.
- Implementation plan.
- Implementation rules.

Exit criteria:

- Documentation reviewed.
- P0 and P1 design review recommendations incorporated.
- Major domain assumptions approved.
- Initial implementation scope selected.

## Phase 1: Foundation

Status: complete.

Goal:

Create the production foundation without completing the interview product.

Deliverables:

- Next.js TypeScript project setup.
- Tailwind and shadcn/ui setup.
- Prisma and PostgreSQL setup.
- Redis and BullMQ setup.
- Docker local development.
- Module folder structure.
- Environment configuration.
- Health checks.
- Structured logging, request IDs, and correlation IDs.
- Baseline metrics and error tracking.
- Base app shell.
- Authentication foundation for company users and platform users.
- Tenant context resolution.
- Tenant-scoped repository and service enforcement.
- Cross-tenant denial test harness.
- Role and permission foundation.
- Audit logging foundation.
- Data classification policy.
- Managed secret reference pattern.
- Idempotency key foundation.
- Disaster recovery design with RPO/RTO targets.
- Backup and restore runbook draft.

Exit criteria:

- Local app runs through Docker.
- Database migrations apply cleanly.
- Tenant-scoped service pattern exists.
- Cross-tenant access tests exist and pass for foundation resources.
- Basic authenticated workspace shell exists.
- Observability baseline is active.
- DR and backup design is documented.
- No candidate interview flow exists yet.

## Phase 2: Enterprise Control Plane

Status: complete.

Goal:

Build enterprise controls before sensitive candidate workflows exist.

Deliverables:

- Compliance and Privacy Module foundation.
- Data Lifecycle Module foundation.
- Support Access Module.
- Usage and Entitlements Module.
- Feature flag management.
- Legal hold records.
- Privacy request records.
- Export request foundation.
- Expanded audit fields.
- Company support access visibility.
- Platform support access approval, reason, and expiration.

Exit criteria:

- Platform support access is time-limited, reasoned, and audited.
- Company admins can view support access history.
- Retention, legal hold, and privacy request models exist.
- Entitlement checks can block restricted operations.
- Audit events are protected from normal application mutation.

## Phase 3: Company and HR Workspace

Status: complete.

Goal:

Enable company setup and HR operational workflows.

Deliverables:

- Platform admin company management.
- Company settings.
- Team management.
- Role and permission management.
- Job role management.
- Versioned interview plan management.
- Candidate records.
- Candidate merge and archive flows.
- Invitation management UI without full candidate interview completion.
- Bulk candidate import design.
- Review assignment foundation.
- Domain verification UI foundation.

Exit criteria:

- Company admins can configure workspace.
- HR can create roles, versioned plans, candidates, and invitations.
- Invitations use published interview plan snapshots.
- Audit events are recorded for sensitive actions.

## Phase 4: Email System

Status: complete.

Completed approved sub-phases before this original Phase 4:

- Phase 4A: Application Layer and Authentication.
- Phase 4B: Design System and Application Shell.

These completed sub-phases do not change the dependency order below. Phase 4 Email System remains the prerequisite for Phase 5 Candidate Portal and Readiness.

Goal:

Build reliable professional email delivery.

Deliverables:

- SMTP profile configuration.
- Platform default SMTP.
- Company SMTP override.
- Managed secret references for SMTP credentials.
- Email template system.
- Invitation email.
- Reminder email.
- Expired invitation email.
- Resend invitation flow.
- BullMQ email queue.
- Delivery logs and retry handling.
- Sender domain verification.
- Bounce and complaint handling.
- Tenant outbound rate limits.
- Platform disable controls for tenant SMTP.

Exit criteria:

- All invitation-related emails are queued.
- Delivery status is visible to HR.
- Failed delivery is actionable.
- Custom sender domains require verification.
- SMTP credentials are represented by managed secret references.

## Phase 5: Candidate Portal and Readiness

Goal:

Build secure candidate entry and pre-interview checks.

Deliverables:

- Magic link validation.
- Single-use magic token exchange.
- Candidate scoped session.
- Candidate resume session.
- Expired, revoked, already-completed, and already-in-progress screens.
- Consent capture.
- Identity verification placeholder architecture.
- Webcam permission check.
- Microphone permission check.
- Browser compatibility check.
- Internet quality check.
- Interview instructions.
- Accommodation request flow.
- Candidate withdrawal flow.

Exit criteria:

- Candidate can enter without account.
- Invalid links are handled safely.
- Raw magic links are consumed once.
- Resume uses short-lived continuation sessions.
- Readiness checks persist.
- Candidate experience is polished on mobile and desktop.
- Candidate flow satisfies WCAG 2.2 AA acceptance checks.

## Phase 6: Workflow and Media Foundation

Goal:

Build durable workflow processing and reliable media upload before full interview completion depends on it.

Deliverables:

- Workflow Orchestration Module.
- Processing workflow tables.
- Workflow step checkpointing.
- Idempotent job handlers.
- Dead-letter and poison job policy.
- Manual replay and cancellation controls.
- Recording upload lifecycle.
- Multipart or resumable upload.
- Signed upload and playback URLs.
- CDN and range-request production design.
- Upload recovery flow.

Exit criteria:

- Workflow steps are replay-safe.
- Failed workflow steps can be inspected and reprocessed by authorized platform admins.
- Recordings never stream through the app server.
- Interrupted uploads can recover where technically possible.

## Phase 7: Browser Interview Session

Goal:

Run structured browser interviews.

Deliverables:

- Interview session state machine.
- Interview question sequencing.
- Browser recording capture.
- Session interruption handling.
- Resume after refresh or short network interruption.
- Interview completion.
- Recording metadata and signed access.

Exit criteria:

- Candidate can complete a browser interview.
- HR can see completed session metadata and recording.
- State transitions are reliable and auditable.
- Interview completion creates a durable processing workflow.

## Phase 8: Monitoring Warnings

Goal:

Add browser-based monitoring as contextual reviewer signals.

Deliverables:

- Looking-away event logging.
- Multiple-face event logging.
- Camera blocked event logging.
- Leaving-frame event logging.
- Focus-loss event logging.
- Network degradation event logging.
- Batched event ingestion.
- Event size, count, and frequency validation.
- Warning summarization.
- Warning timeline in review UI.
- Clear warning-only copy.

Exit criteria:

- Monitoring events are stored and reviewable.
- No automatic rejection logic exists.
- HR UI frames warnings as context.
- Monitoring events are rate-limited and summarized where needed.

## Phase 9: Transcript, Evaluation, AI Governance, and Reports

Goal:

Generate review artifacts after interview completion.

Deliverables:

- Transcription queue.
- Transcript storage and review UI.
- Evaluation provider interface.
- AI Governance Module.
- Prompt and rubric versioning.
- Provider, model, and provider-version metadata.
- Provider timeout and malformed-response handling.
- PII redaction policy.
- Rubric-based evaluation.
- Candidate score.
- HR report generation.
- Evidence citations.
- Confidence and uncertainty indicators.
- Score override and decision history.
- Results-ready notification.

DeepSeek:

- Integrate only as an evaluation provider adapter when approved.
- Keep normalized evaluation schema provider independent.

Exit criteria:

- Completed interviews generate transcript, evaluation, score, and HR report.
- HR can review evidence and add human notes.
- Provider-specific data does not leak into core domain logic.
- Every evaluation records provider, model, prompt, rubric, evidence, and confidence metadata.
- HR decision ownership is preserved.

## Phase 10: Enterprise Reporting and Search

Goal:

Give large HR teams operational visibility and fast access to records.

Deliverables:

- Search Module.
- Export Module.
- Aggregate reporting.
- Role pipeline summaries.
- Invitation conversion and completion reports.
- Readiness drop-off reports.
- Processing latency reports.
- Email deliverability reports.
- Reviewer workload reports.
- Compliance access reports.
- Candidate comparison by role.

Exit criteria:

- HR can find candidates, roles, interviews, and reports quickly.
- Large reports are generated asynchronously.
- Analytics events avoid raw restricted content.
- Compliance exports are audited.

## Phase 11: Enterprise Hardening

Goal:

Prepare for real company adoption.

Deliverables:

- Advanced audit search.
- Retention policy jobs.
- Export controls.
- Rate limiting coverage.
- Error tracking integration.
- Metrics dashboards.
- Security review.
- Backup and restore runbook.
- Restore verification.
- Staging and production deployment runbooks.
- Data processing agreement support materials.
- Incident response runbook.
- Accessibility audit.
- Security headers and rate-limit review.
- Data retention job verification.

Exit criteria:

- Platform is operationally supportable.
- Sensitive data access is auditable.
- Retention jobs are tested.
- Restore process is tested.
- WCAG 2.2 AA issues are triaged or fixed.

## Phase 12: Integrations and Scale

Goal:

Add enterprise expansion capabilities.

Potential deliverables:

- ATS integrations.
- SSO.
- SCIM.
- External webhooks.
- Custom report exports.
- Advanced analytics.
- Multi-region storage strategy.
- Dedicated evaluation worker scaling.
- Optional extraction of email, media, transcription, or evaluation modules.

Exit criteria:

- Integrations follow existing module boundaries.
- Scaling work does not require major domain rewrites.

## Phase 13: Production Deployment

Goal:

Launch a production-ready enterprise deployment.

Deliverables:

- Production infrastructure.
- Managed PostgreSQL with point-in-time recovery.
- Redis production configuration.
- Object storage with versioning and lifecycle policies.
- CDN for media.
- Managed secret store.
- Web and worker deployments.
- Separate worker classes for expensive queues as needed.
- Monitoring dashboards and alerts.
- Synthetic interview smoke tests.
- Rollback plan.
- On-call runbook.

Exit criteria:

- RPO and RTO targets are accepted.
- Backup restore has been verified.
- Production smoke tests pass.
- Alerting is active.
- No P0 security or tenancy findings remain.

## Long-Term Technical Investments

- PostgreSQL row-level security adoption if enterprise risk assessment requires it.
- Event outbox pattern if external webhooks or service extraction grow.
- Provider routing for AI evaluation.
- Advanced media processing pipeline.
- Policy-based data retention by region.
- Enterprise compliance package.

## Risks to Manage

- Tenant isolation bugs.
- Candidate privacy and consent gaps.
- AI evaluation overreach.
- Recording upload reliability.
- Email deliverability.
- Browser compatibility differences.
- Queue retries causing duplicate side effects.
- Monitoring warnings being misinterpreted as verdicts.
- Support access misuse.
- Disaster recovery process drift.

## Definition of Production Ready

Aptly is production ready when:

- Tenant isolation is enforced and tested.
- Candidate magic links are secure, expiring, and single-use for session creation.
- Email delivery is reliable and observable.
- Interviews can recover from common browser interruptions.
- Recordings and transcripts are access controlled.
- Evaluations cite evidence.
- HR decisions remain human-owned.
- Audit logs cover sensitive actions.
- Support access is controlled and visible.
- AI evaluation governance is implemented.
- Data classification, legal hold, export, deletion, and retention flows are implemented.
- Deployment, backup, restore, and incident workflows are documented and tested.
- Observability and disaster recovery have been tested.
