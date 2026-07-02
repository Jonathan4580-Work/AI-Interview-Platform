# Product Specification

## Product Name

**Aptly**

Aptly is a premium browser-based interview platform for companies that want consistent, structured, and reviewable candidate screening without turning the hiring experience into a chatbot.

## Positioning

Aptly is enterprise recruitment infrastructure for structured AI-assisted interviews. It helps hiring teams invite candidates, run secure browser interviews, review evidence, and compare candidates using consistent evaluation rubrics.

The AI should feel like infrastructure, not the product identity. Users should describe Aptly as polished hiring software, not "an AI app."

## Primary Users

### Global Platform Admin

Internal operator with cross-tenant access for support, compliance, abuse review, system configuration, and operational health.

Responsibilities:

- Manage companies and subscription state.
- Configure global platform settings.
- Review system health and queues.
- Investigate audit events.
- Support tenant administrators.
- Manage email delivery configuration defaults.

### Company Admin

Tenant owner or administrator responsible for company setup and access.

Responsibilities:

- Configure company profile and branding.
- Manage HR users.
- Configure roles and permissions.
- Configure email sender settings.
- Manage data retention policies.
- View company-level analytics.

### HR User

Recruiter, hiring manager, or talent team member who creates interview workflows and reviews candidate results.

Responsibilities:

- Create roles and interview plans.
- Invite candidates.
- Track invitation state.
- Review transcripts, recordings, evaluations, scores, and reports.
- Add notes and hiring recommendations.
- Resend or expire invitations.

### Candidate

External invitee who completes an interview without creating an account.

Responsibilities:

- Open secure invitation link.
- Verify identity.
- Complete device and browser checks.
- Consent to recording and monitoring.
- Complete the interview in browser.

## Core Product Areas

### Platform Admin Console

Global operational interface for Aptly staff.

Capabilities:

- Company directory.
- Company status controls: active, suspended, trialing, archived.
- System email settings.
- Queue visibility for email, transcription, evaluation, and report jobs.
- Audit log search.
- Usage metrics by tenant.
- Support impersonation request workflow. Direct impersonation should require explicit audit reason and be highly restricted.
- Just-in-time support access sessions with reason codes and time limits.
- Failed job replay, cancellation, and redacted inspection.
- Tenant storage, email deliverability, and AI provider health dashboards.
- Legal hold and tenant export controls.
- Feature flag and entitlement overrides.
- Tenant suspension impact preview.
- Operational incident notices.

### Company Workspace

Primary authenticated SaaS interface for company admins and HR users.

Capabilities:

- Dashboard with active roles, pending interviews, recent completions, and queue health relevant to the tenant.
- Role and interview plan management.
- Candidate invitation management.
- Interview review workspace.
- Team, permissions, and company settings.
- Email sender and template configuration.
- Data retention and compliance settings.
- Bulk candidate import and bulk invitation send.
- Candidate merge, archive, deletion/anonymization request, and export workflows.
- Review assignment, collaborative notes, decision history, and score override with reason.
- Evaluation re-run request with reason.
- Candidate comparison by role.
- Support access visibility.
- Domain verification and sender verification.

### Candidate Interview Portal

Unauthenticated secure browser flow accessed only through magic links.

Candidate stages:

1. Invitation landing screen.
2. Consent and privacy acknowledgement.
3. Identity verification.
4. Browser compatibility check.
5. Webcam permission check.
6. Microphone permission check.
7. Internet quality check.
8. Interview instructions.
9. Interview session.
10. Completion confirmation.

Candidates do not see internal scores, AI evaluation, proctoring warnings, or HR notes.

Required candidate exception flows:

- Expired link with request-new-link guidance.
- Revoked link.
- Already completed interview.
- Interview already open in another browser.
- Interrupted session resume.
- Unsupported browser or device.
- Permission denied with browser-specific instructions.
- Poor connection retry or continue decision.
- Recording upload recovery.
- Candidate withdrawal.
- Candidate support/contact path.
- Accommodation request path.
- Privacy notice and retention explanation.

## Interview Lifecycle

### Invitation Created

An HR user creates an invitation for a candidate and role.

System behavior:

- Generate secure magic token.
- Store only a hash of the token.
- Assign expiration.
- Queue invitation email.
- Create audit event.

### Candidate Opens Link

System validates:

- Token hash exists.
- Invitation is active.
- Token has not expired.
- Token is not consumed.
- Tenant and invitation status are valid.

If valid, candidate receives a scoped candidate session. If invalid or expired, the candidate sees a professional expired-link screen with contact instructions.

Magic links are single-use for candidate session creation. If a candidate needs to resume, the system uses a separate short-lived continuation session rather than the original raw token.

### Pre-Interview Checks

Required checks:

- Identity verification.
- Webcam permission.
- Microphone permission.
- Browser compatibility.
- Internet quality.
- Recording consent.
- Interview instructions.

Failed checks should explain the issue clearly and allow retry where possible.

Readiness checks must support accommodation paths. A candidate who cannot complete a webcam-based identity or monitoring step should receive clear guidance and a non-punitive support path.

### Interview Session

The AI interviewer conducts a structured, professional conversation. The interview engine should support:

- Role-specific question plans.
- Follow-up questions.
- Timeboxing.
- Candidate answer capture.
- Real-time transcript generation when available.
- Session state recovery for short network interruptions.

The experience should feel like a guided professional interview, not a chat application.

The session must handle refreshes, short network interruptions, browser restarts, and recording upload recovery without losing completed answers when technically possible.

### Monitoring Signals

The browser should log warning events:

- Looking away.
- Multiple faces detected.
- Camera blocked.
- Candidate leaving frame.
- Tab or window focus loss.
- Significant network degradation.

These events are contextual signals only. They must never automatically reject a candidate.

### Completion

After completion:

- Mark interview as completed.
- Finalize recording.
- Queue transcription if not already complete.
- Queue evaluation.
- Queue HR report generation.
- Notify relevant HR users when results are ready.

## Generated Artifacts

Each completed interview should produce:

- Transcript.
- Recording.
- Structured evaluation.
- Candidate score.
- HR report.
- Monitoring warning summary.
- Audit trail.

## Evaluation Model

Evaluations are rubric-based and provider agnostic.

Evaluation output:

- Overall score.
- Competency scores.
- Strengths.
- Risks.
- Evidence citations linked to transcript sections.
- Monitoring context.
- Recommended next-step category.
- Confidence and uncertainty indicators.
- Provider, model, prompt, and rubric version metadata.

OpenAI is Aptly's production AI evaluation provider. The evaluation module must expose a provider interface and store normalized evaluation results independent of provider payloads. Local and automated tests use the deterministic provider.

AI evaluation is decision support only. HR users may override scores or recommendations with a reason, and the system must preserve decision history.

## Enterprise Workflows

### HR Collaboration

Large HR teams require:

- Review assignment.
- Collaborative notes.
- Decision history.
- Score override with reason.
- Candidate comparison by role.
- Bulk import and invitation.
- Invitation extension.
- Evaluation reprocessing.
- Report export and internal sharing with permission controls.

### Compliance and Privacy

Aptly must support:

- Consent records.
- Data classification.
- Retention by data class.
- Legal hold.
- Candidate access, deletion, anonymization, and export requests.
- Company audit exports.
- Support access transparency.
- AI decision-support disclaimers.
- WCAG 2.2 AA accessibility target.

### Aggregate Reporting

Company reporting must include:

- Invitation conversion rates.
- Completion rates.
- Readiness drop-off.
- Time to process results.
- Time to HR review.
- Evaluation distributions by role.
- Monitoring warning frequency.
- Email deliverability.
- Reviewer workload.
- Compliance access reports.

## Non-Goals

- No candidate accounts.
- No automatic candidate rejection based on AI or monitoring alone.
- No AI-themed product identity.
- No production coding before documentation approval.
- No microservices in the first implementation unless a specific operational need appears.

## Enterprise Requirements

- Strong tenant isolation.
- Role-based access control.
- Complete audit logging for sensitive actions.
- Configurable retention policies.
- Professional email templates.
- Queue-backed background processing.
- Operational monitoring.
- Export-ready data structures.
- Future support for SSO, SCIM, ATS integrations, and SOC 2 readiness.
- Disaster recovery targets and restore testing.
- Data classification and legal hold.
- Support access governance.
- AI governance and evidence-based evaluation.
