# Aptly Product Blueprint

Last updated: July 15, 2026

## Mission

Aptly is an AI-assisted recruiting platform that helps companies move from a job description to a structured, evidence-backed hiring decision.

The product is not meant to feel like an AI chatbot or novelty tool. Aptly should feel like premium HR operations software: calm, trustworthy, organized, and human-owned. AI works behind the scenes to help HR teams structure jobs, screen resumes, conduct browser interviews, summarize evidence, and prepare reports. Final hiring decisions remain owned by humans.

## What Aptly Is Trying To Build

Aptly’s full workflow is:

1. HR signs in to a company workspace.
2. HR creates a job from a pasted or uploaded job description.
3. AI helps structure the job profile, competencies, and interview questions.
4. HR reviews and publishes the job.
5. Candidates discover the job on a public careers page.
6. Candidates create a candidate account and apply with a CV.
7. AI screens the CV against the job requirements.
8. HR reviews the screening result and shortlists candidates.
9. HR requests candidate availability.
10. Candidate confirms an interview slot.
11. HR sends a secure interview invitation.
12. Candidate completes consent, readiness checks, and a browser interview.
13. Background workers process the recording, transcript, evaluation, and report.
14. HR reviews transcript, evidence, scores, confidence, limitations, and report.
15. HR records the final human decision.

AI supports the workflow. It does not automatically reject, rank, hire, or change candidate status.

## Core Product Principles

- HR stays in control.
- AI output is decision support only.
- Candidate experience must feel professional and respectful.
- Public pages must feel like a real careers site.
- Internal HR pages must feel like premium recruiting operations software.
- Security, privacy, auditability, and tenant isolation are core product requirements.
- The local XAMPP demo must work end to end with synthetic data.

## Current Technology Stack

- Next.js
- TypeScript
- Prisma
- MySQL locally through XAMPP
- Tailwind CSS
- Radix/shadcn-style UI primitives
- Local file storage
- Gmail SMTP for local email
- OpenAI for evaluation
- Local background worker
- Vitest test suite

## Current Local Runtime

Aptly currently runs locally with:

- XAMPP MySQL
- `.env.local`
- local file storage in `storage/`
- Gmail SMTP
- OpenAI API
- Next.js dev server
- local worker process

Important local commands:

```powershell
npm.cmd run db:local:migrate
npm.cmd run db:local:seed
npm.cmd run dev
npm.cmd run worker:local
npm.cmd run local:demo-readiness
npm.cmd run local:storage-smoke
npm.cmd run local:smtp-smoke
npm.cmd run local:openai-smoke
npm.cmd run local:full-flow-status
```

## Implemented Product Areas

### 1. Authentication And Workspace

Implemented:

- HR login.
- Company Admin login.
- Workspace ID-based company login.
- Authenticated HR shell.
- Sidebar navigation.
- Account menu.
- Real user identity display.
- Real company/workspace display.
- Sign out.
- Role-aware navigation.
- Protected HR routes.

Fixed earlier issues:

- Invalid `/workspace` redirect.
- Missing `/dashboard`.
- Placeholder account menu values.
- Dead navigation links.
- Poor sidebar contrast.
- Light/dark theme support.

### 2. Public Landing Page

Implemented `/`.

The landing page presents Aptly as an AI-powered recruiting platform with:

- Hero section.
- Sign-in CTA.
- Careers page CTA.
- Feature cards.
- How-it-works section.
- HR-focused messaging.
- Candidate-friendly messaging.
- Footer.

### 3. HR Dashboard

Implemented a real HR dashboard using database values.

Dashboard shows:

- Open jobs.
- New applications.
- Screening pending.
- Recommended candidates.
- Shortlisted candidates.
- Availability requested.
- Interviews pending.
- Reports ready.
- Hired candidates.
- Not selected candidates.
- Recent activity.
- Quick actions.

No fake metrics are used.

### 4. JD-Driven Job Creation

Implemented `/jobs/new`.

HR can:

- Paste a job description.
- Upload PDF.
- Upload DOCX.
- Use local deterministic autofill without OpenAI.
- Click Analyze JD to run AI.
- Create a structured job draft.

Local autofill can detect:

- Job title.
- Responsibilities.
- Requirements.
- Nice-to-have skills.
- Location.
- Employment type.
- Department.
- Experience level.

Fixed:

- Empty slug crash.
- Slow button states.
- Dead edit/review buttons.
- Paste autofill not submitting title.
- Local parsing accidentally calling OpenAI.

### 5. Job Review And Publishing

Implemented `/jobs/[jobId]/review`.

HR can review:

- Role profile.
- Competencies.
- Interview questions.
- Scoring rubric.
- AI-generated draft.

HR can publish the job and interview plan.

### 6. Jobs

Implemented:

```text
/jobs
/jobs/[jobId]
/jobs/[jobId]/edit
```

HR can:

- List jobs.
- View job detail.
- Edit job.
- Close/reopen job.
- View public posting link.
- View candidates and applications.
- See CV screening status.
- Send availability request.
- Send interview invitation.

### 7. Public Careers Marketplace

Implemented:

```text
/careers/[companySlug]
/careers/[companySlug]/jobs/[jobSlug]
```

Public careers page shows:

- Company name.
- Open roles only.
- Job cards.
- Location/type/level.
- Apply CTA.

Public job detail shows:

- Job title.
- Company.
- Role summary.
- Responsibilities.
- Requirements.
- Skills.
- Interview process.
- Apply button.

Visibility rules:

- Published/open jobs appear.
- Draft jobs are hidden.
- Closed jobs are hidden.
- Archived jobs are hidden.
- Unknown jobs return 404.

### 8. Candidate Account And Application Flow

Implemented:

```text
/careers/[companySlug]/jobs/[jobSlug]/apply
/candidate
/candidate/applications
```

Candidate can:

- Register.
- Log in.
- Upload CV.
- Submit application.
- View dashboard.
- Track application status.
- See next steps.

Candidate accounts are separate from HR access. Candidate users cannot access HR workspace pages.

### 9. CV Upload And Storage

Supported CV uploads:

- DOCX.
- PDF.

CVs are stored in local storage and linked to candidate/application records.

DOCX extraction works well.

PDF handling was hardened:

- Metadata filtering.
- Garbage detection.
- Readability scoring.
- Low-quality warning.
- No hallucinated screening from unreadable PDFs.

Candidate-facing guidance:

> DOCX is recommended for best AI screening accuracy. PDF is supported, but scanned or protected PDFs may not extract clearly.

### 10. AI CV Screening

Implemented AI CV screening using OpenAI.

HR can see:

- Match score.
- Recommendation.
- Confidence.
- Matched skills.
- Missing skills.
- Concerns.
- Suggested interview focus.
- Evidence excerpts.
- Extraction quality.
- Limitations.
- Advisory disclaimer.

Safety behavior:

- Low-quality CV extraction is not treated as valid evidence.
- AI does not automatically reject candidates.
- HR owns decisions.

### 11. Shortlist And Availability Flow

Implemented HR actions:

- Shortlist.
- Mark not selected.
- Return to review.

Implemented availability flow:

- HR creates availability slots.
- HR sends availability request.
- Candidate opens secure availability link.
- Candidate chooses a slot.
- HR sees confirmed availability.

### 12. Interview Invitation Flow

Implemented secure invitation flow.

HR can:

- Send interview invite.
- Use SMTP or preview email mode.
- View invitation status.
- Revoke or resend where supported.

Interview invitation email includes:

- Job title.
- Camera and microphone requirement.
- Quiet environment guidance.
- Stable internet guidance.
- Desktop/laptop recommendation.
- Expiry.
- Support/next steps.

### 13. Candidate Interview Flow

Implemented browser interview backbone.

Candidate completes:

- Welcome.
- Privacy/consent.
- Readiness checks.
- Instructions.
- Interview room.
- Recording.
- Answer submission.
- Completion.

Recording upload works locally.

Meaningful transcript capture was added:

- Browser speech recognition where available.
- Typed answer fallback.
- Stored answer text per question.
- Transcript uses actual captured text instead of placeholder text.

This fixed the earlier issue where OpenAI evaluated placeholder transcript text and returned insufficient evidence.

### 14. Local Worker Pipeline

Implemented and fixed post-interview processing.

Worker handles:

- Email.
- Orchestration.
- Media finalization.
- Transcription.
- OpenAI evaluation.
- HR report generation.

Major workflow bugs fixed:

- Steps marked succeeded while attempts stayed running.
- Duplicate attempt number crashes.
- Stale failure after success.
- Workflow stuck in running/failed state.
- Retry/repair behavior.

Diagnostics added:

```text
npm run local:evaluation-diagnostic
npm run local:repair-workflow-attempts
npm run local:full-flow-status
```

### 15. OpenAI Evaluation Provider

OpenAI is now the production/staging/local evaluation provider.

Provider modes:

- Deterministic for local/test where needed.
- OpenAI for real evaluation.

Environment variables:

```env
EVALUATION_PROVIDER=openai
OPENAI_API_KEY=
OPENAI_MODEL=
OPENAI_API_URL=https://api.openai.com/v1
EVALUATION_PROVIDER_TIMEOUT_MS=
```

Implemented:

- OpenAI Responses API.
- Structured output validation.
- Timeout handling.
- Malformed response handling.
- Safe error diagnostics.
- Secret redaction.

### 16. Transcript, Evaluation, And HR Report

Implemented post-interview results visibility.

HR can see:

- Interview status.
- Transcript.
- Evaluation summary.
- Competency scores.
- Evidence citations.
- Confidence.
- Limitations.
- Strengths.
- Development areas.
- Recommendation.
- HR report.
- Monitoring warnings separately.

Reports page now lists recent candidate reports.

Interviews page has a clear View Results path.

Candidate detail page shows interview/report status.

### 17. Human Decision And Final Outcome

Implemented HR final decision flow.

HR can record:

- Hired.
- Not selected.
- HR reason/note.
- Onboarding date if hired.

Important behavior:

- AI does not mutate candidate status automatically.
- AI does not hire or reject.
- HR decision is separate from AI recommendation.
- Decision trail remains visible.

### 18. UI/UX Redesign

Completed a major UI redesign.

Improved:

- HR workspace.
- Dashboard.
- Jobs.
- Applications.
- Candidates.
- Interviews.
- Reports.
- Public careers.
- Public job detail.
- Apply page.
- Candidate dashboard.
- Candidate applications.
- Availability page.
- AI screening cards.
- Status badges.
- Buttons/loading states.
- Cards/layouts.
- Responsive behavior.
- Light/dark mode.
- Sidebar contrast.

Removed or cleaned:

- Demo branding from visible product UI.
- Placeholder user data.
- Dead buttons.
- Raw status labels.
- Technical enum text.
- Internal phase/foundation language from normal users.

### 19. Local Demo Readiness

Added:

```text
npm run local:demo-readiness
```

It checks:

- MySQL.
- Local storage.
- Gmail SMTP config.
- OpenAI config.
- Demo company data.
- HR users.
- Jobs.
- Applications.
- Worker queue.
- Transcript/evaluation/report readiness.

It prints:

- READY.
- ACTION.
- BLOCKED.

It does not print:

- Passwords.
- API keys.
- Tokens.
- Candidate links.
- Transcripts.
- Email bodies.

## Current Verification Status

Repository checks currently pass:

```text
npm run build
npm run lint
npm run test
npm run format:check
npm audit
npm run next:build
```

Latest test status:

```text
95 test files passed
511 tests passed
0 vulnerabilities
```

Live XAMPP checks must be run from the local XAMPP copy because this workspace did not have `.env.local`.

## What Still Needs To Be Proven

### 1. One Fresh End-To-End Local Demo

Run the full workflow from XAMPP:

1. HR login.
2. Create/publish job.
3. Candidate applies.
4. CV screening.
5. Shortlist.
6. Availability request.
7. Candidate confirms availability.
8. HR sends interview invite.
9. Candidate completes interview.
10. Worker processes transcript/evaluation/report.
11. HR reviews report.
12. HR records final decision.

Then run:

```powershell
npm.cmd run local:full-flow-status
```

The final required result:

```text
PASSED transcript ready
PASSED OpenAI evaluation ready
PASSED report ready
```

### 2. Manual Browser QA

Still needs real browser/device testing:

- Chrome.
- Camera permission.
- Microphone permission.
- Speech recognition.
- Typed answer fallback.
- Mobile responsiveness.
- Candidate flow.
- HR flow.
- Dark/light mode.

### 3. PDF Extraction Limitation

DOCX is strong.

PDF support is safe but not perfect.

Current strategy:

- Support readable PDFs.
- Detect unreadable/corrupted extraction.
- Warn HR.
- Recommend DOCX.
- Do not hallucinate from garbage.

Future improvement:

- OCR.
- Stronger PDF parser.
- Candidate re-upload flow.

### 4. Production Deployment

Local XAMPP works.

Production still needs:

- Hosted database.
- Storage provider.
- Email provider.
- Deployed web service.
- Deployed worker service.
- Secrets.
- Domain/TLS.
- Monitoring.
- Backup/restore.

## Final Simple Summary

Aptly now works as a local AI recruiting platform.

It can:

- Create jobs from JDs.
- Publish jobs.
- Let candidates apply.
- Upload CVs.
- Screen CVs with AI.
- Shortlist candidates.
- Collect availability.
- Invite candidates to interviews.
- Run browser interviews.
- Capture real answer text.
- Process transcripts.
- Run OpenAI evaluation.
- Generate HR reports.
- Let HR make final decisions.
- Run locally through XAMPP.

The biggest remaining task is proving one clean full local demo from start to finish, then deciding whether to polish for a demo video or prepare production deployment.
