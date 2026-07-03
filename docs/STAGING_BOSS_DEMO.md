# Staging Boss Demo

This runbook is for the controlled Aptly staging demonstration. Use only synthetic candidates and synthetic company data.

## Preconditions

- Web service is deployed from `/railway.json`.
- Worker service is deployed from `/railway.worker.json`.
- Worker start command is `npm run worker:prod`.
- PostgreSQL, Redis, S3-compatible object storage, Gmail SMTP, and OpenAI are configured for both web and worker where applicable.
- `npm run staging:object-storage-smoke`, `npm run staging:smtp-smoke`, and `npm run staging:openai-smoke` have been run from the Railway console.
- Do not claim the full flow has passed until a real synthetic candidate completes the interview and HR can see the generated report.

## Demo Steps

1. Open Aptly staging at the public `APP_URL`.
   - Expected: login page loads with Aptly styling.
2. Select **Company** account.
   - Expected: Workspace ID field is visible.
3. Sign in as the staging HR user.
   - Expected: dashboard opens without placeholder identity data.
4. Open **Jobs** and select the demo job, or create a new job.
   - Expected: job status is Open and an interview plan is published.
5. Open **Candidates** and select the demo candidate, or create a new synthetic candidate.
   - Expected: candidate has a synthetic email address controlled for staging.
6. Attach the candidate to the job.
   - Expected: application appears under the candidate and job.
7. Send the interview invitation with the default 3-day expiry.
   - Expected: invitation status becomes Sent and email status becomes Sent after the worker sends via SMTP.
8. Confirm the real invitation email arrives.
   - Expected: email includes job title, camera/microphone requirement, quiet environment guidance, stable internet guidance, desktop/laptop recommendation, support guidance, and expiry.
9. If SMTP is unavailable, use the authorized staging fallback from the candidate detail application card:
   - **View email preview**
   - **Open candidate experience**
   - **Copy candidate link**
   - Expected: fallback is available only for authorized Company Admin/HR users in the same workspace.
10. Candidate opens the secure invitation link.
    - Expected: no false expired-link flash; token is removed from the visible URL.
11. Complete privacy and consent.
    - Expected: consent request succeeds and does not return 401.
12. Complete identity self-attestation.
    - Expected: candidate can continue without internal IDs or debug details.
13. Complete camera/microphone readiness.
    - Expected: camera and microphone checks show clear pass/warning/fail states.
14. Start the browser interview.
    - Expected: recording indicator is visible before recording begins.
15. Record and submit answers.
    - Expected: chunks upload directly to object storage; no media bytes pass through Next.js.
16. Complete the interview.
    - Expected: interview moves to completed/processing, not a blank or endless spinner.
17. Wait for the worker pipeline.
    - Expected: transcript, OpenAI evaluation, and HR report are generated.
18. HR opens the interview detail/report.
    - Expected: report shows overall screening score, competency breakdown, evidence, strengths, concerns, recommendation, confidence, limitations, generated timestamp, and human-review notice.

## Railway Logs

- Web logs: `AI-Interview-Platform` service logs.
- Worker logs: `aptly-worker` service logs.
- Email issues: search worker logs for `email` delivery IDs; do not print SMTP credentials.
- Processing issues: search worker logs for workflow, transcription, evaluation, and report step IDs.

## Safe Recovery

- SMTP failure: run `npm run staging:smtp-smoke`; verify Gmail app password and `SMTP_SECRET_REF` on both web and worker.
- Worker not processing: verify `aptly-worker` uses `/railway.worker.json` and has `STAGING_WORKER_SERVICE_ENABLED=true`.
- Object upload failure: run `npm run staging:object-storage-smoke`; verify bucket CORS allows the staging app origin.
- OpenAI failure: run `npm run staging:openai-smoke`; verify `EVALUATION_PROVIDER=openai`, `OPENAI_MODEL=gpt-5-mini`, and the API key exists on the worker.
- Candidate link issue: use **Copy candidate link** from the candidate detail page. Copying and previewing do not consume the invitation.

## Status Command

Run this from Railway after the demo flow begins:

```powershell
npm run staging:full-flow-status
```

The command prints `PASSED`, `BLOCKED`, or `FAILED` for each step and never prints passwords, API keys, candidate tokens, candidate links, SMTP credentials, email bodies, recordings, transcripts, or candidate answers.

## Known Limitations

- Full pass requires a real synthetic candidate recording and a visible HR report.
- Browser permission behavior still requires manual validation in Chrome, Edge, Firefox, and Safari.
- Gmail delivery can be delayed or filtered by the recipient mailbox; do not claim delivery until the email is visible.
