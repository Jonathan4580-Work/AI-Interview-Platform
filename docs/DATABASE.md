# Database Design

## Overview

Aptly uses PostgreSQL with Prisma. The schema must be designed for enterprise multi-tenancy, auditability, and future service extraction.

Tenant-owned tables include `companyId`. Global platform tables do not.

## Core Conventions

- Primary keys use collision-resistant IDs such as CUID2 or UUID.
- All major tables include `createdAt` and `updatedAt`.
- Soft deletion is used for business records where audit history matters.
- Immutable audit records are never updated or deleted by application flows.
- Token secrets are stored only as hashes.
- Provider-specific payloads are stored separately from normalized domain fields.
- Tenant-scoped indexes should start with `companyId` where appropriate.
- PII email fields should store normalized values where uniqueness or search depends on them.
- JSON payloads must include a schema/version field when they represent versioned business data.
- Restricted data must not be stored in generic metadata JSON unless explicitly allowed by the data classification policy.
- Append-heavy tables must remain compatible with future time-based partitioning.

## Data Classification

Data classes:

- `public`: safe non-sensitive product metadata.
- `internal`: operational metadata and non-sensitive statuses.
- `confidential`: candidate profiles, invitations, HR notes, reports, team data.
- `restricted`: recordings, transcripts, identity verification data, AI provider payloads, secrets references, support access records.
- `regulated_sensitive`: identity documents, biometric-like signals, legal hold data, and jurisdiction-specific protected data.

Every table must have an assigned data class in implementation documentation. Restricted and regulated-sensitive data require explicit audit access, retention controls, and redaction from logs.

## Global Tables

### `platform_users`

Internal Aptly staff.

Fields:

- `id`
- `email`
- `name`
- `status`
- `createdAt`
- `updatedAt`

### `companies`

Tenant root.

Fields:

- `id`
- `name`
- `slug`
- `status`: active, suspended, trialing, archived
- `primaryDomain`
- `logoUrl`
- `createdAt`
- `updatedAt`
- `deletedAt`

### `platform_settings`

Global settings such as default SMTP profile reference and feature flags.

Fields:

- `id`
- `key`
- `valueJson`
- `createdAt`
- `updatedAt`

### `company_settings`

Tenant-level configuration.

Fields:

- `id`
- `companyId`
- `brandingJson`
- `retentionPolicyJson`
- `emailSettingsJson`
- `featureFlagsJson`
- `createdAt`
- `updatedAt`

Indexes:

- Unique `companyId`

### `subscriptions`

Billing-readiness metadata. This table should not assume Stripe, but it should be ready for Stripe or another provider later.

Fields:

- `id`
- `companyId`
- `status`: trialing, active, past_due, suspended, cancelled
- `planKey`
- `billingProvider`
- `billingCustomerRef`
- `billingSubscriptionRef`
- `currentPeriodStart`
- `currentPeriodEnd`
- `usageJson`
- `createdAt`
- `updatedAt`

Indexes:

- Unique `companyId`
- `status`

### `entitlements`

Plan and feature enforcement.

Fields:

- `id`
- `companyId`
- `planKey`
- `featureKey`
- `limitValue`
- `enabled`
- `overrideReason`
- `createdAt`
- `updatedAt`

Indexes:

- Unique `companyId, featureKey`

### `usage_counters`

Usage accounting for billing and operational limits.

Fields:

- `id`
- `companyId`
- `periodStart`
- `periodEnd`
- `metricKey`
- `count`
- `metadataJson`
- `createdAt`
- `updatedAt`

Indexes:

- Unique `companyId, periodStart, periodEnd, metricKey`

## Identity and Access Tables

### `users`

Company users.

Fields:

- `id`
- `companyId`
- `email`
- `name`
- `status`: invited, active, disabled
- `lastLoginAt`
- `createdAt`
- `updatedAt`
- `deletedAt`

Indexes:

- Unique `companyId, email`
- `companyId, status`

### `roles`

Company-level role definitions.

Fields:

- `id`
- `companyId`
- `name`
- `key`
- `description`
- `isSystem`
- `createdAt`
- `updatedAt`

Default roles:

- Company Admin
- HR
- Read-only Reviewer

### `permissions`

Global permission catalog.

Fields:

- `id`
- `key`
- `description`

### `role_permissions`

Role-permission join table.

Fields:

- `roleId`
- `permissionId`

### `user_roles`

User-role join table.

Fields:

- `userId`
- `roleId`
- `companyId`

### `support_access_sessions`

Controlled platform admin access to tenant data.

Fields:

- `id`
- `companyId`
- `platformUserId`
- `status`: requested, active, expired, revoked, denied
- `reasonCode`
- `reasonText`
- `approvedByPlatformUserId`
- `startedAt`
- `expiresAt`
- `endedAt`
- `createdAt`
- `updatedAt`

Indexes:

- `companyId, status`
- `platformUserId, status`
- `expiresAt`

## Hiring Domain Tables

### `job_roles`

Hiring role or requisition.

Fields:

- `id`
- `companyId`
- `title`
- `department`
- `location`
- `status`: draft, active, paused, closed, archived
- `createdByUserId`
- `createdAt`
- `updatedAt`
- `deletedAt`

Indexes:

- `companyId, status`
- `companyId, title`

### `interview_plans`

Structured plan for a role.

Fields:

- `id`
- `companyId`
- `jobRoleId`
- `name`
- `description`
- `durationMinutes`
- `status`: draft, active, archived
- `rubricJson`
- `questionPlanJson`
- `createdAt`
- `updatedAt`

### `candidates`

Candidate profile scoped to a company. Candidates do not authenticate as users.

Fields:

- `id`
- `companyId`
- `email`
- `normalizedEmail`
- `name`
- `phone`
- `externalRef`
- `createdAt`
- `updatedAt`
- `deletedAt`

Indexes:

- Unique `companyId, normalizedEmail` for active candidates unless tenant duplicate-candidate mode is explicitly enabled
- `companyId, externalRef`

### `candidate_merge_events`

Audit-supporting record for candidate profile merges.

Fields:

- `id`
- `companyId`
- `sourceCandidateId`
- `targetCandidateId`
- `performedByUserId`
- `reason`
- `createdAt`

### `candidate_invitations`

Invitation and magic link lifecycle.

Fields:

- `id`
- `companyId`
- `candidateId`
- `jobRoleId`
- `interviewPlanId`
- `status`: pending, sent, opened, expired, revoked, completed
- `tokenHash`
- `expiresAt`
- `sentAt`
- `openedAt`
- `consumedAt`
- `revokedAt`
- `createdByUserId`
- `createdAt`
- `updatedAt`

Indexes:

- Unique `tokenHash`
- `companyId, status`
- `companyId, candidateId`
- `expiresAt`

### `candidate_sessions`

Scoped browser sessions created from magic links or resume flows.

Fields:

- `id`
- `companyId`
- `candidateId`
- `invitationId`
- `interviewSessionId`
- `sessionTokenHash`
- `resumeTokenHash`
- `status`: active, expired, revoked, completed
- `createdFromIp`
- `createdFromUserAgent`
- `lastSeenAt`
- `expiresAt`
- `createdAt`
- `updatedAt`

Indexes:

- Unique `sessionTokenHash`
- Unique `resumeTokenHash`
- `companyId, invitationId`
- `expiresAt`

## Interview Tables

### `interview_sessions`

Main interview instance.

Fields:

- `id`
- `companyId`
- `candidateId`
- `invitationId`
- `interviewPlanId`
- `status`
- `startedAt`
- `completedAt`
- `interruptedAt`
- `lastActivityAt`
- `durationSeconds`
- `currentQuestionSequence`
- `resumeAllowedUntil`
- `createdAt`
- `updatedAt`

Indexes:

- `companyId, status`
- `companyId, candidateId`
- Unique `invitationId`

### `processing_workflows`

Durable workflow created after interview completion.

Fields:

- `id`
- `companyId`
- `interviewSessionId`
- `status`: pending, running, blocked, failed, completed, cancelled
- `currentStepKey`
- `startedAt`
- `completedAt`
- `failedAt`
- `failureReason`
- `createdAt`
- `updatedAt`

Indexes:

- Unique `interviewSessionId`
- `companyId, status`

### `processing_workflow_steps`

Ordered processing steps for media, transcription, evaluation, reporting, and notification.

Fields:

- `id`
- `companyId`
- `workflowId`
- `stepKey`
- `sequence`
- `status`: pending, running, retrying, blocked, failed, completed, skipped
- `idempotencyKey`
- `attempts`
- `lastError`
- `startedAt`
- `completedAt`
- `createdAt`
- `updatedAt`

Indexes:

- Unique `idempotencyKey`
- `companyId, workflowId, sequence`
- `companyId, status`

### `idempotency_keys`

Tracks safe replay for API mutations and workflow jobs.

Fields:

- `id`
- `companyId` nullable for platform/global actions
- `key`
- `scope`
- `requestHash`
- `responseHash`
- `status`: processing, completed, failed, expired
- `expiresAt`
- `createdAt`
- `updatedAt`

Indexes:

- Unique `scope, key`
- `expiresAt`

### `readiness_checks`

Pre-interview checks.

Fields:

- `id`
- `companyId`
- `interviewSessionId`
- `identityStatus`
- `cameraPermissionStatus`
- `microphonePermissionStatus`
- `browserCompatibilityStatus`
- `networkQualityStatus`
- `consentStatus`
- `resultsJson`
- `completedAt`
- `createdAt`
- `updatedAt`

### `consent_records`

Candidate consent and privacy acknowledgement history.

Fields:

- `id`
- `companyId`
- `candidateId`
- `interviewSessionId`
- `privacyNoticeVersion`
- `recordingConsent`
- `monitoringConsent`
- `identityVerificationConsent`
- `acceptedAt`
- `ipAddress`
- `userAgent`
- `createdAt`

Indexes:

- `companyId, candidateId`
- `companyId, interviewSessionId`

### `identity_verifications`

Candidate identity verification record. The platform may initially store only metadata and status while allowing the verification provider to be replaced later.

Fields:

- `id`
- `companyId`
- `candidateId`
- `interviewSessionId`
- `provider`
- `status`: pending, passed, failed, needs_review
- `verifiedName`
- `documentType`
- `providerReference`
- `metadataJson`
- `createdAt`
- `updatedAt`

Indexes:

- `companyId, candidateId`
- `companyId, interviewSessionId`

### `interview_turns`

Question and answer turns.

Fields:

- `id`
- `companyId`
- `interviewSessionId`
- `sequence`
- `speaker`: interviewer, candidate, system
- `content`
- `startedAt`
- `endedAt`
- `metadataJson`
- `createdAt`

Indexes:

- `companyId, interviewSessionId, sequence`

### `monitoring_events`

Browser warning events.

Fields:

- `id`
- `companyId`
- `interviewSessionId`
- `type`: looking_away, multiple_faces, camera_blocked, left_frame, focus_lost, network_degraded
- `occurredAt`
- `elapsedMs`
- `confidence`
- `metadataJson`
- `createdAt`

Indexes:

- `companyId, interviewSessionId, occurredAt`
- `companyId, type`

## Media and Transcript Tables

### `recordings`

Recording metadata.

Fields:

- `id`
- `companyId`
- `interviewSessionId`
- `storageKey`
- `storageBucket`
- `storageRegion`
- `mimeType`
- `sizeBytes`
- `durationSeconds`
- `uploadId`
- `checksum`
- `status`: uploading, uploaded, processing, ready, failed, deleted
- `retentionDeleteAt`
- `legalHoldId`
- `createdAt`
- `updatedAt`

### `transcripts`

Transcript aggregate.

Fields:

- `id`
- `companyId`
- `interviewSessionId`
- `status`: pending, processing, ready, failed
- `language`
- `provider`
- `providerVersion`
- `retentionDeleteAt`
- `legalHoldId`
- `createdAt`
- `updatedAt`

### `transcript_segments`

Timed transcript sections.

Fields:

- `id`
- `companyId`
- `transcriptId`
- `interviewSessionId`
- `sequence`
- `speaker`
- `startMs`
- `endMs`
- `text`
- `confidence`
- `createdAt`

Indexes:

- `companyId, interviewSessionId, sequence`

## Evaluation and Report Tables

### `evaluations`

Normalized evaluation result.

Fields:

- `id`
- `companyId`
- `interviewSessionId`
- `status`: pending, processing, ready, failed, superseded
- `provider`
- `providerVersion`
- `model`
- `promptVersion`
- `rubricVersion`
- `overallScore`
- `confidence`
- `summary`
- `strengthsJson`
- `risksJson`
- `competencyScoresJson`
- `evidenceJson`
- `createdAt`
- `updatedAt`

### `evaluation_competency_scores`

Normalized competency scores for querying and reporting.

Fields:

- `id`
- `companyId`
- `evaluationId`
- `interviewSessionId`
- `competencyKey`
- `label`
- `score`
- `maxScore`
- `confidence`
- `rationale`
- `createdAt`

Indexes:

- `companyId, interviewSessionId`
- `companyId, competencyKey`

### `evaluation_evidence_citations`

Evidence references tied to transcript segments.

Fields:

- `id`
- `companyId`
- `evaluationId`
- `interviewSessionId`
- `transcriptSegmentId`
- `competencyKey`
- `claim`
- `startMs`
- `endMs`
- `createdAt`

Indexes:

- `companyId, evaluationId`
- `companyId, transcriptSegmentId`

### `evaluation_provider_payloads`

Provider-specific request and response references.

Fields:

- `id`
- `companyId`
- `evaluationId`
- `provider`
- `requestHash`
- `responseJson`
- `metadataJson`
- `createdAt`

### `hr_reports`

Reviewer-facing report.

Fields:

- `id`
- `companyId`
- `interviewSessionId`
- `evaluationId`
- `status`: pending, ready, failed
- `reportJson`
- `summary`
- `createdAt`
- `updatedAt`

### `review_notes`

Human notes and decisions.

Fields:

- `id`
- `companyId`
- `interviewSessionId`
- `authorUserId`
- `note`
- `recommendation`: advance, hold, reject, undecided
- `createdAt`
- `updatedAt`
- `deletedAt`

### `decision_history`

Human-owned hiring recommendation history.

Fields:

- `id`
- `companyId`
- `interviewSessionId`
- `actorUserId`
- `fromRecommendation`
- `toRecommendation`
- `reason`
- `createdAt`

Indexes:

- `companyId, interviewSessionId, createdAt`

### `score_overrides`

Human score overrides with required reason.

Fields:

- `id`
- `companyId`
- `interviewSessionId`
- `evaluationId`
- `actorUserId`
- `previousScore`
- `newScore`
- `reason`
- `createdAt`

Indexes:

- `companyId, interviewSessionId`

## Email Tables

### `smtp_profiles`

SMTP configuration metadata. Secrets are stored externally or encrypted.

Fields:

- `id`
- `companyId` nullable for platform default
- `name`
- `host`
- `port`
- `secure`
- `fromName`
- `fromEmail`
- `replyToEmail`
- `secretRef`
- `domainVerificationStatus`
- `status`
- `createdAt`
- `updatedAt`

### `email_templates`

Versioned templates.

Fields:

- `id`
- `companyId` nullable for platform default
- `key`
- `name`
- `subject`
- `htmlBody`
- `textBody`
- `version`
- `status`
- `createdAt`
- `updatedAt`

### `email_deliveries`

Delivery lifecycle records. Full rendered bodies are not stored in this table.

Fields:

- `id`
- `companyId`
- `templateKey`
- `recipientEmail`
- `subject`
- `status`: pending, queued, sending, sent, delivered, deferred, bounced, complained, failed, cancelled
- `providerMessageId`
- `errorMessage`
- `queuedAt`
- `sentAt`
- `createdAt`
- `updatedAt`

### `email_delivery_attempts`

Provider attempt history.

Fields:

- `id`
- `companyId`
- `deliveryId`
- `attemptNumber`
- `status`
- `provider`
- `providerMessageId`
- `errorCode`
- `errorMessage`
- `startedAt`
- `completedAt`

### `email_events`

Normalized provider events for delivered, deferred, bounced, complained, and failed outcomes.

### `verified_sender_domains`

Company sender domain verification.

Fields:

- `id`
- `companyId`
- `domain`
- `status`: pending, verified, failed, revoked
- `verificationTokenHash`
- `verifiedAt`
- `createdAt`
- `updatedAt`

Indexes:

- Unique `companyId, domain`

## Audit and Operations Tables

### `audit_events`

Immutable audit trail.

Fields:

- `id`
- `companyId` nullable for global events
- `actorType`: platform_user, user, candidate_session, system
- `actorId`
- `requestId`
- `correlationId`
- `sessionId`
- `supportAccessSessionId`
- `action`
- `resourceType`
- `resourceId`
- `reason`
- `riskLevel`
- `beforeJson`
- `afterJson`
- `ipAddress`
- `userAgent`
- `metadataJson`
- `createdAt`

Indexes:

- `companyId, createdAt`
- `actorType, actorId`
- `resourceType, resourceId`
- `requestId`
- `correlationId`

Audit table requirements:

- Application code must not update or delete rows.
- Database permissions should prevent normal application roles from mutating historical rows.
- High-sensitivity audit events should be compatible with hash chaining or external immutable log sinks.

### `job_runs`

Optional persistent job execution log.

Fields:

- `id`
- `companyId`
- `queueName`
- `jobName`
- `bullJobId`
- `status`
- `attempts`
- `errorMessage`
- `startedAt`
- `completedAt`
- `createdAt`

### `export_requests`

Controlled export workflow.

Fields:

- `id`
- `companyId`
- `requestedByUserId`
- `type`: candidate_report, role_summary, audit_export, tenant_export, compliance_export
- `status`: pending, processing, ready, failed, expired
- `resourceType`
- `resourceId`
- `storageKey`
- `expiresAt`
- `createdAt`
- `updatedAt`

Indexes:

- `companyId, status`
- `companyId, requestedByUserId`

### `legal_holds`

Prevents deletion of covered data.

Fields:

- `id`
- `companyId`
- `name`
- `description`
- `status`: active, released
- `createdByUserId`
- `releasedByUserId`
- `createdAt`
- `releasedAt`

Indexes:

- `companyId, status`

### `privacy_requests`

Data subject access, deletion, anonymization, and export requests.

Fields:

- `id`
- `companyId`
- `candidateId`
- `type`: access, deletion, anonymization, export, correction
- `status`: received, verifying, processing, completed, denied
- `requesterEmail`
- `reason`
- `completedAt`
- `createdAt`
- `updatedAt`

Indexes:

- `companyId, candidateId`
- `companyId, status`

### `analytics_events`

Low-detail product analytics and reporting event stream. Must avoid raw restricted content.

Fields:

- `id`
- `companyId`
- `eventKey`
- `subjectType`
- `subjectId`
- `occurredAt`
- `propertiesJson`
- `createdAt`

Indexes:

- `companyId, eventKey, occurredAt`
- `companyId, subjectType, subjectId`

## Retention Strategy

Retention should be configurable per company within platform limits.

Data classes:

- Candidate profile.
- Invitation.
- Recording.
- Transcript.
- Evaluation.
- HR report.
- Audit logs.
- Identity verification.
- Consent records.
- Support access records.

Recordings should have explicit `retentionDeleteAt`. Deletion jobs must remove object storage files and mark metadata as deleted.

Legal hold overrides retention deletion. Candidate deletion may require anonymization instead of physical deletion where audit, legal, or compliance records must remain.

## Partitioning and Archival Strategy

Append-heavy tables must be designed to support future partitioning:

- `audit_events`
- `monitoring_events`
- `transcript_segments`
- `email_deliveries`
- `job_runs`
- `analytics_events`

Initial implementation may use normal tables, but primary indexes and query patterns must be compatible with time-based partitioning.

## Migration Strategy

- Use Prisma migrations.
- Review every production migration.
- Avoid destructive changes without backfills.
- Add columns nullable first, backfill, then enforce constraints.
- Keep enum changes backward compatible with deployed workers.
