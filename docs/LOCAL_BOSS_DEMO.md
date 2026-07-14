# Local Boss Demo

Use only synthetic data for the local demo.

## Prerequisites

1. XAMPP MySQL is running.
2. `aptly_local` exists in phpMyAdmin.
3. `.env.local` is configured with Gmail SMTP and OpenAI.
4. The web app is running at `http://localhost:3000`.
5. The local worker is running with `npm run worker:local`.

## Demo Setup

```powershell
npm run db:local:migrate
$env:LOCAL_DEMO_COMPANY_ADMIN_EMAIL="admin@example.test"
$env:LOCAL_DEMO_COMPANY_ADMIN_PASSWORD="<strong-password>"
$env:LOCAL_DEMO_HR_EMAIL="hr@example.test"
$env:LOCAL_DEMO_HR_PASSWORD="<strong-password>"
npm run db:local:seed
```

Save the printed Company Workspace ID.

## Readiness Check

Before showing the product, run:

```powershell
npm run local:demo-readiness
```

The command prints `READY`, `ACTION`, or `BLOCKED` for XAMPP MySQL, local storage, Gmail SMTP, OpenAI, seeded company data, worker queue state, and post-interview artifacts. It does not print passwords, API keys, invitation tokens, candidate URLs, transcripts, or email bodies.

Run provider smoke checks when credentials are configured:

```powershell
npm run local:storage-smoke
$env:LOCAL_SMTP_TEST_RECIPIENT="your-email@example.com"
npm run local:smtp-smoke
npm run local:openai-smoke
```

## Demo Flow

1. Open `http://localhost:3000/login`.
2. Choose **Company**.
3. Enter the printed Company Workspace ID.
4. Sign in as the seeded HR user.
5. Open **Jobs** and confirm the demo job exists.
6. Open **Candidates** and open the synthetic candidate.
7. Send or resend an interview invitation.
8. Confirm Gmail receives the invitation email.
9. Open the secure candidate link from the email.
10. Complete consent and privacy acknowledgement.
11. Complete identity self-attestation.
12. Complete camera and microphone readiness.
13. Start the browser interview.
14. Answer each question and complete the interview.
15. Confirm recording uploads to `storage/`.
16. Keep `npm run worker:local` running until transcript, evaluation, and report processing complete.
17. Return to the HR interview detail page.
18. Confirm the transcript, evaluation, evidence, confidence, limitations, and HR report are visible.
19. Run:

```powershell
npm run local:full-flow-status
```

The demo is complete only when the flow status reaches `PASSED` for recording, transcript, OpenAI evaluation, and report.

## Demo Reset

Rerun `npm run db:local:seed` after changing the local demo password environment variables. The seed is idempotent and refreshes existing synthetic Company Admin and HR credentials without printing passwords or hashes.

If a workflow is stuck after a local interruption, run:

```powershell
npm run local:repair-workflow-attempts -- <workflowId>
```

Then restart:

```powershell
npm run worker:local
```

## Honest Blockers

If Gmail SMTP is not configured, invitation email delivery is blocked.
If OpenAI is not configured, evaluation is blocked.
If camera/microphone permissions are denied, the candidate readiness and interview recording flow is blocked.
If `npm run worker:local` is not running, transcript, evaluation, and report processing will not complete.
