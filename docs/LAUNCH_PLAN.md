# Launch Plan

## Status

Prepared only. No staging or production launch occurred.

## Rollout Order

1. Internal staging.
2. Internal pilot.
3. Limited external pilot.
4. Controlled production rollout.
5. Wider release.

Do not proceed directly to public launch without live staging validation.

## Pre-Launch Checklist

- Repository checks pass.
- Container image built and scanned.
- Production environment validates.
- Managed secrets configured.
- Pre-deployment database backup completed.
- Migration job tested in staging.
- Worker queue drain tested.
- Email sandbox smoke passed.
- Object storage upload/download smoke passed.
- Alerts route to owners.
- Incident contacts confirmed.

## Provider Enablement Order

1. Object storage.
2. Email sandbox.
3. Webhook test endpoint.
4. Transcription/evaluation sandbox providers.
5. SSO test tenant.
6. SCIM test tenant.
7. ATS sandbox.
8. Production email and providers only after staging approval.

## Pilot Flow

- Create pilot tenant.
- Create HR/admin users.
- Configure verified domain and sender.
- Create job and published interview plan.
- Invite internal candidate.
- Complete candidate readiness and interview.
- Process transcript/evaluation/report using approved providers.
- Verify search, report, export, audit, and deletion controls.

## Monitoring Period

Internal pilot: monitor for at least one business day.

Limited external pilot: monitor first interview live and review first-day/first-week metrics.

Signals:

- 5xx rate.
- Candidate failures.
- Media upload failures.
- Queue backlog.
- Workflow failures.
- Email failures.
- AI/provider failures.
- Audit-write failures.
- Cross-tenant denial anomalies.

## Rollback Triggers

- Tenant isolation concern.
- Candidate interview completion failure spike.
- Media upload failure spike.
- Audit-write failure.
- Auth/session regression.
- Broken migration.
- Provider data-leakage concern.
- Unbounded queue growth.

## Communication Plan

- Internal incident channel.
- Customer pilot contact list.
- Candidate support message template.
- Status page update if external users are affected.
- Post-incident review for P0/P1.

## First-Day Review

- Review alerts and logs.
- Review failed jobs.
- Review email deliverability.
- Review candidate support requests.
- Review media upload success.
- Review evaluation/report generation.
- Confirm no unexpected provider costs.

## First-Week Review

- Review performance and query latency.
- Review accessibility feedback.
- Review privacy/support requests.
- Review backup status and restore drill schedule.
- Decide whether to expand pilot.
