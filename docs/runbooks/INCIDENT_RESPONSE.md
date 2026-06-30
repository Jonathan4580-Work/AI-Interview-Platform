# Incident Response Runbook

## Scope

This runbook covers Aptly production-pilot incident handling for:

- Security incidents.
- Tenant data exposure suspicion.
- Authentication outage.
- Database outage.
- Redis or queue outage.
- Object-storage outage.
- Email outage.
- AI-provider outage.
- Recording upload outage.
- Backup or restore failure.
- Production rollback.

## Severity

- P0: confirmed tenant data exposure, credential compromise, audit-write outage during risky mutations, or platform-wide data loss risk.
- P1: major authentication, database, queue, media, email, or workflow outage affecting candidate interviews or HR access.
- P2: degraded provider, isolated tenant impact, delayed reports, or elevated retry/dead-letter growth.

## Response Process

1. Detect and declare severity.
2. Preserve request logs, audit logs, workflow state, and relevant provider status pages.
3. Contain the blast radius.
4. Assign an incident commander and owner for communications.
5. Investigate using request ID, correlation ID, tenant ID, workflow ID, and safe resource IDs.
6. Recover through forward fix, rollback, provider failover, or restore.
7. Verify tenant isolation, audit writes, and affected workflows before closing.
8. Complete post-incident review with timeline, customer impact, root cause, and follow-ups.

## Containment Playbooks

### Security or Tenant Exposure Suspicion

- Freeze risky data mutation and export paths if exposure is credible.
- Preserve audit records and support-access sessions.
- Review cross-tenant denial anomalies and recent code deploys.
- Rotate affected secrets if credential exposure is possible.
- Do not delete evidence during containment.

### Authentication Outage

- Check auth error rate, session validation, refresh flow, and password reset endpoints.
- Confirm cookies, CSRF, and security headers were not regressed by a deploy.
- Roll back or forward-fix according to deployment runbook.

### Database Outage

- Confirm database health and connection exhaustion.
- Stop non-critical workers if they amplify load.
- Use backup/restore runbook for recovery or PITR.
- Validate Prisma schema and tenant isolation after restore.

### Redis or Queue Outage

- Pause workers if Redis is unstable.
- Do not treat Redis as authoritative business state.
- Rehydrate workflow processing from PostgreSQL after recovery.
- Inspect dead-letter jobs before replay.

### Object Storage or Recording Upload Outage

- Do not mark interviews complete if required media is unverified.
- Keep candidates in upload recovery where applicable.
- Regenerate signed URLs after storage recovery.
- Never persist signed URLs in incident notes.

### Email Outage

- Disable tenant SMTP profile only when needed.
- Preserve email delivery status and attempts.
- Retry only authorized failed deliveries.

### AI Provider Outage

- Do not change candidate/application status.
- Keep evaluation workflows failed or retry-scheduled according to provider error classification.
- DeepSeek remains optional in non-production and development provider fixtures must not be used for production decisions.

### Backup or Restore Failure

- Treat failed backup or failed restore verification as production-pilot blocking.
- Identify last known-good backup and object-storage version coverage.
- Document achieved RPO/RTO and limitations.

## Communication

- Communicate facts, affected scope, mitigation, expected next update, and customer action required.
- Do not speculate about candidate misconduct, AI conclusions, or tenant exposure until confirmed.
- Preserve audit history and legal hold requirements.

## Post-Incident Review

Every P0/P1 requires:

- Timeline.
- Root cause.
- Detection gap.
- Customer impact.
- Data exposure analysis.
- Corrective actions.
- Owner and due date.
- Audit preservation confirmation.
