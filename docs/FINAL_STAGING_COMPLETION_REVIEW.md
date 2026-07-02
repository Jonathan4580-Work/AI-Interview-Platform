# Final Staging Completion Review

## Scope

This review covers the Railway staging product surface for the HR-to-candidate-to-results workflow. It does not certify live external providers. The only externally allowed pending credentials are production SMTP or transactional-email credentials and a production OpenAI API key.

## Evidence Available In Repository

- Web and worker service config are split: `/railway.json` for web and `/railway.worker.json` for the worker.
- Worker image uses `Dockerfile.worker` and starts `npm run worker:prod` without an HTTP healthcheck.
- HR operational routes exist for dashboard, jobs, candidates, interviews, reports, search, exports, and company settings.
- Candidate portal routes exist for invitation entry, consent, identity, readiness, interview, support, withdrawal, and completion states.
- Deterministic development transcription and evaluation providers are configured by default.
- Object-storage smoke tooling exists through `npm run staging:object-storage-smoke`.
- Staging demo setup exists through `npm run staging:demo`.
- Staging MVP smoke status check exists through `npm run staging:mvp-smoke`.

## Product Inventory

| Area                       | Classification                                                                      | Evidence / Remaining Verification                                                                                                                       |
| -------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication             | fully working and staging-verified                                                  | Company Admin login was reported working in Railway staging.                                                                                            |
| Dashboard                  | implemented; requires Railway smoke verification                                    | Uses real database counts only.                                                                                                                         |
| Jobs                       | implemented; requires Railway smoke verification                                    | Create, edit, activate, close, and view applications.                                                                                                   |
| Interview plans            | implemented; requires Railway smoke verification                                    | Job creation creates a published 3-5 question plan.                                                                                                     |
| Candidates                 | implemented; requires Railway smoke verification                                    | Create, edit, search, view applications/invitations/interviews.                                                                                         |
| Applications               | implemented; requires Railway smoke verification                                    | Candidate-to-job application creation and stage updates.                                                                                                |
| Invitations                | implemented; requires Railway smoke verification                                    | Secure token activation and preview/smtp email queueing exist.                                                                                          |
| Candidate portal           | implemented; requires browser/Railway verification                                  | Public candidate routes and session exchange exist.                                                                                                     |
| Consent                    | implemented; requires browser/Railway verification                                  | Versioned consent routes and UI exist.                                                                                                                  |
| Identity verification      | implemented; requires browser/Railway verification                                  | Self-attestation and snapshot metadata foundation exist.                                                                                                |
| Readiness                  | implemented; requires browser/Railway verification                                  | Camera, microphone, browser, and network readiness UI exists.                                                                                           |
| Browser interview          | implemented; requires browser/Railway verification                                  | Candidate interview room and recording flow exist.                                                                                                      |
| Recording uploads          | blocked until object-storage smoke passes in Railway                                | Requires real S3-compatible storage and CORS for candidate origin.                                                                                      |
| Monitoring notices         | implemented; requires browser/Railway verification                                  | Neutral monitoring notices/events are separate from scoring.                                                                                            |
| Worker processing          | implemented; requires Railway worker log/smoke verification                         | Worker starts email and orchestration; media finalization, transcription, evaluation, reporting, and notifications run as workflow steps.               |
| Transcription              | implemented; requires completed interview smoke                                     | Development provider is deterministic and does not need external credentials.                                                                           |
| Evaluation                 | implemented; requires completed interview smoke                                     | Deterministic provider is available for local/test runs; OpenAI is the production evaluation provider.                                                  |
| Reports                    | implemented; requires completed interview smoke                                     | HR report generation exists and keeps AI decision support separate.                                                                                     |
| Search                     | implemented; requires Railway smoke verification                                    | Tenant-scoped search page/API exist.                                                                                                                    |
| Exports                    | implemented; requires Railway smoke verification                                    | Export page/API and signed download foundations exist.                                                                                                  |
| Company settings           | implemented; requires Railway smoke verification                                    | Company setting page exists; enterprise settings hidden from normal HR navigation.                                                                      |
| User identity/account menu | implemented; staging-verified earlier                                               | Uses authenticated session identity, company, and role.                                                                                                 |
| Email preview              | implemented at delivery/provider level; UI preview link remains a verification risk | Preview mode queues/sends through preview provider. The raw candidate link is only in the rendered email body and is not persisted in delivery records. |
| Object storage             | blocked until `npm run staging:object-storage-smoke` passes in Railway              | Tooling added; provider credentials/CORS must be set in Railway.                                                                                        |
| PostgreSQL                 | fully working and staging-verified                                                  | Railway PostgreSQL and migrations were reported working.                                                                                                |
| Redis                      | fully working and staging-verified                                                  | Railway Redis and worker service were reported active.                                                                                                  |
| Audit logging              | implemented; requires workflow smoke verification                                   | Sensitive audit redaction exists; HR actions emit audit events.                                                                                         |
| Retention/privacy          | implemented; requires operational verification                                      | Retention/legal-hold foundations exist; no real candidate data should be used in staging.                                                               |
| Error/loading/empty states | implemented; requires manual UI audit                                               | HR pages include empty states; browser/zoom testing still required.                                                                                     |

## Railway Configuration Audit

| Service | Expected Config                                                                                                                                                                                                        | Status                                                                                                |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Web     | Config path `/railway.json`; Dockerfile `Dockerfile`; command `node .next/standalone/server.js`; healthcheck `/health`; public HTTPS domain; `APP_ENV=staging`; `NODE_ENV=production`; `HOSTNAME=0.0.0.0`; `PORT=8080` | Repository config implemented; Railway variable/domain values must be verified in Railway.            |
| Worker  | Config path `/railway.worker.json`; Dockerfile `Dockerfile.worker`; command `npm run worker:prod`; no HTTP healthcheck; no public domain; no Prisma pre-deploy migration                                               | Repository config implemented; Railway service must point Config File Path to `/railway.worker.json`. |

Both services must reference the same Railway PostgreSQL and Redis services.

## Required Staging Smoke Commands

Run inside Railway after configuring the staging worker and object storage:

```powershell
npm run staging:demo
npm run staging:object-storage-smoke
npm run staging:mvp-smoke
```

Do not mark staging complete until all three pass with synthetic data.

## Security And Privacy Confirmation

- No real candidate data should be used in staging.
- Passwords are environment-provided and are not printed by staging demo scripts.
- Candidate invitation raw tokens are not stored in PostgreSQL.
- Signed URLs are issued short-lived and are not persisted by the media service.
- Monitoring warnings remain separate from scores.
- There is no candidate ranking, trust score, cheating score, automatic rejection, or AI-driven candidate/application status mutation.

## Remaining Blockers

- Object storage must be configured and pass `npm run staging:object-storage-smoke` in Railway.
- The complete candidate browser recording flow must be exercised in Railway after object storage is configured.
- Email preview must be verified from the existing delivery/provider surface. Production SMTP credentials remain external.
- OpenAI production API key remains external; deterministic evaluation is available without it.
