# Observability and Alerts Runbook

## Metric Principles

- Metrics must use low-cardinality labels only.
- Candidate names, emails, transcript text, prompts, evidence, signed URLs, provider payloads, and media identifiers must never appear in metric labels.
- Logs may include request ID, correlation ID, tenant ID, workflow ID, step ID, queue name, and safe resource IDs only.

## Critical Alerts

| Alert                        | Signal                                      | Initial threshold                              | First response                                                                   |
| ---------------------------- | ------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------- |
| Authentication failure spike | `web.request.errors_total{route="auth"}`    | 5x baseline for 10 minutes                     | Check brute-force indicators, rate limits, and auth provider health.             |
| Candidate token abuse        | candidate token exchange failures           | 20 failures per IP or invitation in 10 minutes | Confirm rate limiting and block abusive source if needed.                        |
| Cross-tenant denial anomaly  | forbidden tenant access attempts            | Any sustained increase above baseline          | Preserve audit logs and start tenant exposure investigation.                     |
| Database unavailable         | `database.health`                           | degraded for 2 minutes                         | Fail over or restore according to backup runbook.                                |
| Redis unavailable            | `redis.health`                              | degraded for 2 minutes                         | Pause workers and verify queue recovery path.                                    |
| Queue backlog                | `queue.depth` and `queue.oldest_job_age_ms` | oldest job over 15 minutes                     | Scale workers or inspect dead-letter causes.                                     |
| Dead-letter growth           | workflow dead-letter count                  | more than 5 new jobs in 15 minutes             | Inspect redacted payload summary and classify failures.                          |
| Email failure spike          | `email.delivery_failures_total`             | 10% failure rate for 15 minutes                | Check SMTP profile, sender domain, and provider status.                          |
| Recording upload failures    | `media.upload_failures_total`               | 5% failure rate for 15 minutes                 | Check object storage health and signed URL generation.                           |
| Workflow processing failures | `worker.failures_total`                     | 5 failed steps in 10 minutes                   | Stop unsafe replay; inspect workflow state.                                      |
| AI provider failure spike    | `ai.provider_failures_total`                | 20% failure rate for 15 minutes                | Switch to development/provider fallback only outside production.                 |
| Audit-write failure          | `audit.write_failures_total`                | any production failure                         | Treat as critical; preserve request logs and stop risky mutations if persistent. |
| Backup failure               | backup job status                           | any failed scheduled backup                    | Start backup incident and validate last good backup age.                         |
| Restore verification failure | restore verification status                 | any failed drill                               | Block production pilot readiness until resolved.                                 |
| Object-storage errors        | object storage latency/errors               | 5% error rate for 10 minutes                   | Check provider health and pause media-dependent workflows.                       |
| Elevated 5xx rate            | `web.request.errors_total`                  | 2% 5xx over 10 minutes                         | Roll back or forward-fix according to deployment runbook.                        |

## Dashboard Panels

- Web latency and error rate by route family.
- Database health and slow query count.
- Redis health.
- Queue depth and oldest job age by queue.
- Worker retries, failures, and dead letters.
- Email delivery status.
- Candidate portal errors and token exchange failures.
- Interview starts, completions, interruptions, and upload recovery.
- Media upload authorization and completion failures.
- Monitoring ingestion failures.
- Transcription, evaluation, and report processing latency.
- Search/report/export latency and failures.
- Retention/deletion failures.
- Audit-write failures.
- Support-access activity.

## Local Validation

Phase 11 tests validate that required metric names exist, metric labels avoid PII, and alert documentation covers every critical failure mode. External alert-manager wiring is a Phase 13 deployment task.

## Phase 13 Production Activation Status

The alert catalog is ready to configure in a production observability platform, but no live alert routing was activated during Phase 13 because infrastructure access was not available.

Before an external pilot:

- Configure alert destinations and on-call ownership.
- Validate one synthetic alert per severity level.
- Confirm every production alert links to a runbook.
- Confirm metric labels remain bounded and PII-safe.
- Confirm transcript text, prompt text, evidence excerpts, media URLs, email bodies, provider payloads, and candidate notes are excluded from telemetry.
- Record the observability workspace, dashboard URLs, and alert routing owner in the deployment checklist.
