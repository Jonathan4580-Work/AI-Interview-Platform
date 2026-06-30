# API Specification

## API Style

Aptly should use typed internal APIs built on Next.js route handlers and server-side service functions. Public browser APIs should be REST-like, validated, and versionable.

All APIs must:

- Validate input.
- Enforce authorization.
- Enforce tenant scope.
- Return consistent errors.
- Create audit events for sensitive actions.
- Avoid leaking tenant existence or candidate details.

## API Conventions

- External browser-facing APIs are versioned under `/api/v1` once implementation begins.
- Internal service functions may use typed DTOs, but route handlers must remain thin.
- Mutating requests should support an `Idempotency-Key` header where replay could create duplicate side effects.
- List endpoints should use cursor pagination for large datasets. Offset pagination is acceptable only for small admin lists.
- Responses include `requestId`; long-running workflows also include `correlationId`.
- Sensitive endpoints must create audit events.
- Queue-triggering APIs should return accepted workflow/job state rather than pretending work completed synchronously.

## Authentication Contexts

### Platform User Context

Used by Aptly internal admins.

Scope:

- Cross-tenant operational access.
- Requires platform permission checks.
- Requires audit reason for sensitive tenant inspection.

### Company User Context

Used by company admins and HR users.

Scope:

- Exactly one `companyId` per request.
- Permissions derived from assigned roles.

### Candidate Session Context

Used by candidates via magic links.

Scope:

- One invitation.
- One candidate.
- One interview session.
- No access to HR reports, scores, or internal notes.
- Raw magic tokens are exchanged once, then removed from browser-visible URLs.
- Resume uses a short-lived continuation session, not the original magic token.

## Error Shape

```json
{
  "error": {
    "code": "INVITATION_EXPIRED",
    "message": "This invitation has expired.",
    "requestId": "req_..."
  }
}
```

Errors should be professional and safe. Internal details go to logs, not responses.

## Platform Admin APIs

### List Companies

`GET /api/platform/companies`

Query:

- `status`
- `search`
- `page`
- `limit`

Returns company summaries and usage indicators.

### Get Company

`GET /api/platform/companies/:companyId`

Returns company profile, status, settings summary, and operational metadata.

### Update Company Status

`PATCH /api/platform/companies/:companyId/status`

Body:

```json
{
  "status": "suspended",
  "reason": "Billing issue"
}
```

Creates audit event.

### Platform Queue Health

`GET /api/platform/queues`

Returns queue depth, failed jobs, delayed jobs, and processing counts.

### Replay Failed Job

`POST /api/platform/queues/:queueName/jobs/:jobId/replay`

Requires platform operations permission and creates an audit event. Job inspection must redact sensitive payloads.

### Cancel Job

`POST /api/platform/queues/:queueName/jobs/:jobId/cancel`

Requires platform operations permission.

### Create Support Access Session

`POST /api/platform/companies/:companyId/support-access`

Body:

```json
{
  "reasonCode": "customer_support",
  "reasonText": "Investigating failed interview processing",
  "expiresAt": "2026-07-01T10:30:00.000Z"
}
```

Returns a time-limited support access session and creates high-risk audit events.

### List Tenant Health

`GET /api/platform/companies/:companyId/health`

Returns redacted operational health: queue failures, storage usage, email deliverability, AI provider failures, and recent incidents.

## Company Settings APIs

### Get Company Settings

`GET /api/company/settings`

Returns tenant profile, branding, retention, and email settings summary.

### Update Company Profile

`PATCH /api/company/settings/profile`

Body:

```json
{
  "name": "Acme Inc.",
  "primaryDomain": "acme.com"
}
```

### Update Retention Policy

`PATCH /api/company/settings/retention`

Body:

```json
{
  "recordingRetentionDays": 180,
  "transcriptRetentionDays": 365
}
```

Requires company admin permission.

### List Support Access Sessions

`GET /api/company/support-access`

Company admins can view platform support access history for their tenant.

### Create Legal Hold

`POST /api/company/legal-holds`

Creates a legal hold that blocks retention deletion for covered data.

### Create Privacy Request

`POST /api/company/privacy-requests`

Creates candidate access, export, deletion, anonymization, or correction workflow.

## User and Access APIs

### List Users

`GET /api/company/users`

### Invite User

`POST /api/company/users/invitations`

Body:

```json
{
  "email": "recruiter@example.com",
  "name": "Recruiter Name",
  "roleIds": ["role_..."]
}
```

### Update User Roles

`PUT /api/company/users/:userId/roles`

Body:

```json
{
  "roleIds": ["role_admin", "role_hr"]
}
```

### Deprovision User

`POST /api/company/users/:userId/deprovision`

Transfers or preserves ownership of active roles, notes, and assignments according to company policy.

## Job Role and Interview Plan APIs

### List Job Roles

`GET /api/job-roles`

### Create Job Role

`POST /api/job-roles`

Body:

```json
{
  "title": "Senior Backend Engineer",
  "department": "Engineering",
  "location": "Remote"
}
```

### Create Interview Plan

`POST /api/job-roles/:jobRoleId/interview-plans`

Body:

```json
{
  "name": "Backend Engineering Screen",
  "durationMinutes": 35,
  "questionPlan": {},
  "rubric": {}
}
```

Interview plans must be versioned. Invitations use the published snapshot active at the time they are sent.

## Candidate Invitation APIs

### List Invitations

`GET /api/invitations`

Query:

- `status`
- `jobRoleId`
- `search`
- `page`
- `limit`

### Create Invitation

`POST /api/invitations`

Body:

```json
{
  "candidate": {
    "name": "Jane Candidate",
    "email": "jane@example.com"
  },
  "jobRoleId": "job_...",
  "interviewPlanId": "plan_...",
  "expiresAt": "2026-07-07T00:00:00.000Z"
}
```

Behavior:

- Creates or reuses candidate profile within company.
- Creates invitation.
- Queues invitation email.
- Audits creation.

### Resend Invitation

`POST /api/invitations/:invitationId/resend`

Behavior:

- Generates new token hash if existing token is expired or configured for rotation.
- Queues email.
- Audits resend.

### Extend Invitation

`POST /api/invitations/:invitationId/extend`

Body:

```json
{
  "expiresAt": "2026-07-14T00:00:00.000Z",
  "reason": "Candidate requested more time"
}
```

### Revoke Invitation

`POST /api/invitations/:invitationId/revoke`

Body:

```json
{
  "reason": "Candidate withdrew"
}
```

### Send Reminder

`POST /api/invitations/:invitationId/reminder`

Queues reminder email.

### Bulk Create Invitations

`POST /api/invitations/bulk`

Creates many invitations through a workflow. Returns workflow status.

## Candidate Portal APIs

These APIs use candidate session context.

### Validate Magic Link

`POST /api/candidate/session`

Body:

```json
{
  "token": "raw_magic_token_from_url"
}
```

Behavior:

- Hashes token.
- Validates invitation.
- Creates scoped candidate session.
- Returns safe invitation context.
- Consumes the magic token for session creation.
- Clears raw-token usage from subsequent URLs.

### Get Candidate Session

`GET /api/candidate/session`

Returns candidate-safe session state.

### Resume Candidate Session

`POST /api/candidate/session/resume`

Body:

```json
{
  "resumeToken": "short_lived_resume_token"
}
```

Returns safe session state if resume is allowed.

### Submit Consent

`POST /api/candidate/consent`

Body:

```json
{
  "recordingConsent": true,
  "privacyAcknowledged": true
}
```

### Submit Readiness Check

`POST /api/candidate/readiness`

Body:

```json
{
  "cameraPermissionStatus": "passed",
  "microphonePermissionStatus": "passed",
  "browserCompatibilityStatus": "passed",
  "networkQualityStatus": "passed",
  "identityStatus": "passed",
  "results": {}
}
```

### Submit Identity Verification

`POST /api/candidate/identity-verification`

Body:

```json
{
  "provider": "internal",
  "status": "passed",
  "verifiedName": "Jane Candidate",
  "metadata": {}
}
```

The first implementation may use an internal metadata-only verification flow. A dedicated identity provider can be added later behind the same contract.

### Request Accommodation

`POST /api/candidate/accommodation-request`

Body:

```json
{
  "reason": "I cannot complete the camera requirement",
  "contactEmail": "jane@example.com"
}
```

Creates a candidate support event and notifies HR.

### Withdraw Interview

`POST /api/candidate/withdraw`

Body:

```json
{
  "reason": "Candidate withdrew"
}
```

### Start Interview

`POST /api/candidate/interview/start`

Creates or transitions interview session to `IN_PROGRESS`.

### Submit Interview Turn

`POST /api/candidate/interview/turns`

Body:

```json
{
  "sequence": 4,
  "speaker": "candidate",
  "content": "Answer text or transcript segment",
  "startedAt": "2026-07-01T10:05:00.000Z",
  "endedAt": "2026-07-01T10:06:12.000Z",
  "metadata": {}
}
```

### Submit Monitoring Event

`POST /api/candidate/interview/monitoring-events`

Body:

```json
{
  "type": "looking_away",
  "occurredAt": "2026-07-01T10:08:00.000Z",
  "elapsedMs": 320000,
  "confidence": 0.74,
  "metadata": {}
}
```

Rate-limited and batched where possible.

### Complete Interview

`POST /api/candidate/interview/complete`

Behavior:

- Finalizes session.
- Creates durable processing workflow.
- Consumes invitation token if configured.

### Get Processing Workflow

`GET /api/interviews/:interviewSessionId/processing-workflow`

Returns workflow status to authorized HR users.

## Media APIs

### Create Recording Upload

`POST /api/candidate/media/recordings`

Returns signed upload instructions.

### Complete Recording Upload

`POST /api/candidate/media/recordings/:recordingId/complete`

Body:

```json
{
  "sizeBytes": 12000000,
  "durationSeconds": 2100,
  "mimeType": "video/webm"
}
```

### Recover Recording Upload

`POST /api/candidate/media/recordings/:recordingId/recover`

Returns resumable upload instructions when an upload is interrupted.

### Get Recording Access URL

`POST /api/interviews/:interviewSessionId/recording/access`

Authenticated HR/company user only. Returns short-lived signed URL and creates audit event.

## Review APIs

### List Interviews

`GET /api/interviews`

Query:

- `status`
- `jobRoleId`
- `candidateId`
- `page`
- `limit`

### Get Interview Detail

`GET /api/interviews/:interviewSessionId`

Returns:

- Candidate summary.
- Invitation summary.
- Readiness results.
- Recording metadata.
- Transcript status.
- Evaluation status.
- HR report status.
- Monitoring summary.

### Get Transcript

`GET /api/interviews/:interviewSessionId/transcript`

Audited.

### Get Evaluation

`GET /api/interviews/:interviewSessionId/evaluation`

Audited.

### Get HR Report

`GET /api/interviews/:interviewSessionId/hr-report`

Audited.

### Reprocess Evaluation

`POST /api/interviews/:interviewSessionId/evaluation/reprocess`

Body:

```json
{
  "reason": "Provider response failed validation"
}
```

Creates a new processing workflow step and supersedes old evaluation only after the new one succeeds.

### Override Score

`POST /api/interviews/:interviewSessionId/score-override`

Body:

```json
{
  "newScore": 82,
  "reason": "Human reviewer adjusted based on additional context"
}
```

Creates audit event and decision history.

### Add Review Note

`POST /api/interviews/:interviewSessionId/notes`

Body:

```json
{
  "note": "Strong system design examples.",
  "recommendation": "advance"
}
```

### Assign Reviewer

`POST /api/interviews/:interviewSessionId/reviewer`

### Export Interview Report

`POST /api/interviews/:interviewSessionId/export`

Creates an export request and returns export status.

## Email APIs

Phase 4 internal email APIs are versioned under `/api/internal/v1/email`.

Implemented endpoints:

- `GET /api/internal/v1/email/settings`
- `PATCH /api/internal/v1/email/settings`
- `GET /api/internal/v1/email/smtp-profiles`
- `POST /api/internal/v1/email/smtp-profiles`
- `GET /api/internal/v1/email/smtp-profiles/:smtpProfileId`
- `PATCH /api/internal/v1/email/smtp-profiles/:smtpProfileId`
- `POST /api/internal/v1/email/smtp-profiles/:smtpProfileId/test`
- `GET /api/internal/v1/email/sender-domains`
- `POST /api/internal/v1/email/sender-domains`
- `GET /api/internal/v1/email/sender-domains/:domainId`
- `PATCH /api/internal/v1/email/sender-domains/:domainId`
- `GET /api/internal/v1/email/templates`
- `POST /api/internal/v1/email/templates`
- `GET /api/internal/v1/email/templates/:templateId`
- `PATCH /api/internal/v1/email/templates/:templateId`
- `GET /api/internal/v1/email/deliveries`
- `POST /api/internal/v1/email/deliveries`
- `GET /api/internal/v1/email/deliveries/:deliveryId`
- `POST /api/internal/v1/email/deliveries/:deliveryId/cancel`
- `POST /api/internal/v1/email/deliveries/:deliveryId/retry`

All mutating email APIs require CSRF protection, tenant scope, RBAC permissions, validation, and audit events. SMTP credentials are never accepted as raw database fields; APIs accept only managed `secretRef` values.

Provider webhook ingestion and deliverability aggregate reporting remain future endpoints.

## Webhooks and Events

Internal domain events should be defined even before external webhooks exist.

Important events:

- `invitation.created`
- `invitation.sent`
- `invitation.opened`
- `interview.started`
- `interview.completed`
- `recording.ready`
- `transcript.ready`
- `evaluation.ready`
- `report.ready`
- `email.failed`
- `support_access.started`
- `support_access.ended`
- `privacy_request.created`
- `export.ready`
- `workflow.failed`
- `evaluation.reprocessed`
- `score.overridden`

Future external webhooks can expose a safe subset.

## Phase 12 Internal Integration APIs

Phase 12 enterprise integration and scale management foundations are versioned under `/api/internal/v1`. These endpoints do not provision production infrastructure and do not enable Phase 13 deployment.

All endpoints require authenticated company context, tenant isolation, RBAC, rate limiting, validation, safe projection, and CSRF for mutations.

| Endpoint                                    | Methods       | Permission                                           | Purpose                                                                    |
| ------------------------------------------- | ------------- | ---------------------------------------------------- | -------------------------------------------------------------------------- |
| `/api/internal/v1/webhooks/subscriptions`   | `GET`, `POST` | `webhooks:read`, `webhooks:manage`                   | Inspect supported webhook events and validate subscription configuration.  |
| `/api/internal/v1/webhooks/deliveries`      | `GET`, `POST` | `webhooks:read`, `webhooks:manage`                   | Inspect webhook delivery contract and request authorized retry validation. |
| `/api/internal/v1/sso/configuration`        | `GET`, `POST` | `sso:read`, `sso:manage`                             | Inspect SSO provider support and validate OIDC configuration protections.  |
| `/api/internal/v1/sso/domains`              | `GET`, `POST` | `sso:read`, `sso:manage`                             | Inspect and validate verified-domain mapping foundations.                  |
| `/api/internal/v1/scim/configuration`       | `GET`, `POST` | `scim:read`, `scim:manage`                           | Inspect SCIM support and validate token/pagination foundations.            |
| `/api/internal/v1/integrations/connections` | `GET`, `POST` | `integrations:read`, `integrations:manage`           | Inspect ATS provider support and validate connection configuration.        |
| `/api/internal/v1/integrations/mappings`    | `GET`, `POST` | `integrations:read`, `integrations:manage`           | Inspect and validate integration mapping and conflict-policy rules.        |
| `/api/internal/v1/integrations/sync-jobs`   | `GET`, `POST` | `integration_syncs:read`, `integration_syncs:manage` | Inspect and validate integration sync workflow contracts.                  |
| `/api/internal/v1/data-residency/settings`  | `GET`, `POST` | `data_residency:read`, `data_residency:manage`       | Inspect region configuration and validate cross-region transfer policy.    |

Projection rules:

- Webhook payloads are event allowlists, never raw domain-event payloads.
- Secret references are redacted in responses.
- Raw SCIM bearer tokens are never returned by validation endpoints.
- Provider credentials are never exposed to browsers.
- Signed URLs, transcripts, media contents, prompts, evidence text, candidate notes, accommodation data, and identity data remain excluded from these APIs.
- Integration sync payloads contain IDs and safe metadata only.

## Search APIs

### Search Workspace

`GET /api/search?q=...`

Searches candidates, roles, invitations, interviews, and reports within the current company. Transcript body search should be explicit and separately authorized.
