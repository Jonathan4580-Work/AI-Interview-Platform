# Security Review Summary

## Scope

Phase 11 reviewed security controls across authentication, candidate sessions, CSRF, rate limiting, RBAC, tenant isolation, support access, media/export URL handling, AI provider privacy, search/reporting, queue payloads, logging, audit, and data lifecycle foundations.

## Findings and Fixes

| Severity | Finding                                                                                                                                                | Fix                                                                                                                                |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| P1       | In-memory rate limiter had no bucket ceiling and could grow under attacker-controlled keys.                                                            | Added bucket capacity and oversized key hashing.                                                                                   |
| P1       | API handler did not consistently apply `no-store` cache headers to all API responses.                                                                  | Added shared sensitive no-store headers in the API wrapper.                                                                        |
| P1       | Audit redaction did not cover Phase 9/10 sensitive names such as transcript text, evidence excerpts, provider payloads, export URLs, and email bodies. | Expanded normalized audit key redaction and tests.                                                                                 |
| P1       | Worker shutdown paused without waiting for active jobs, increasing deployment corruption risk.                                                         | Updated graceful shutdown to wait for active jobs before close.                                                                    |
| P2       | Retention policy surface did not cover all current data classes.                                                                                       | Added policy fields and deletion eligibility helpers for candidate sessions, consent, monitoring, email, analytics, and workflows. |
| P2       | Privacy requests supported creation only.                                                                                                              | Added controlled status transition service and Prisma store update.                                                                |
| P2       | Metrics had no explicit low-cardinality or PII guardrails.                                                                                             | Added metric catalog and tag validation.                                                                                           |

## Controls Verified

- Candidate tokens remain hash-only and timing-safe.
- Candidate sessions are separate from company-user authentication.
- Candidate and internal mutations enforce CSRF through existing shared helpers.
- Search excludes candidate notes, transcript bodies, accommodation data, identity data, prompt/rubric content, and media content.
- Monitoring warnings remain separate from scoring and hiring decisions.
- Evaluation output cannot mutate candidate or application status.
- CSV exports protect against spreadsheet formula injection.
- Signed URLs are generated transiently and are not persisted.

## Remaining Accepted Risks

- In-memory rate limiting must move to Redis or edge infrastructure before horizontally scaled production.
- DeepSeek live integration still requires provider-specific staging validation with a real key.
- Full browser/media load testing requires Phase 13 staging infrastructure.
- Query plan verification against production-sized data remains a Phase 13 readiness task.
- Screen-reader and real-device accessibility checks remain manual before production pilot.

## Production-Pilot Readiness

No known P0/P1 security findings remain after Phase 11 hardening. Phase 12 may begin after review approval.
