# Phase 9 Production Readiness Review

## Scope

Reviewed Phase 9 only: transcript generation and storage, evaluation provider abstraction, AI governance, redaction, evidence validation, HR reports, human review and overrides, results-ready notification intents, workflow handlers, and internal APIs.

This review did not begin Phase 10 and did not add enterprise search, aggregate analytics, dashboards, broad exports, SSO, SCIM, ATS integrations, or deployment functionality.

## Findings

### P0

No P0 issues remain open.

### P1

1. Transcript read APIs did not consistently pass through audited transcript access paths.
   - Risk: transcript text access could be visible to authorized users without a dedicated transcript-access audit event.
   - Fix: transcript segment reads now use `TranscriptionService.listSegments`, and transcript metadata reads record `transcription.metadata_accessed`.

2. Transcript correction source validation was incomplete.
   - Risk: a corrected transcript version could reference a prior version id that did not belong to the same interview transcript.
   - Fix: `PrismaTranscriptRepository.createTranscriptVersion` now validates correction source tenant, transcript, and interview ownership before creating a correction.

3. Explicit safe reprocessing behavior was missing.
   - Risk: operators had no governed way to create a replacement evaluation version after transcript correction or provider recovery.
   - Fix: added `EvaluationService.reprocessInterview` and `POST /api/internal/v1/evaluations/[evaluationVersionId]/reprocess`. Reprocessing requires `evaluations:manage`, CSRF, authenticated user actor, and reason; the route tenant-safely resolves the evaluation version to its interview session and creates a new evaluation version through the existing supersession behavior.

### P2

1. Evaluation review audit metadata used the evaluation completion timestamp instead of the review timestamp.
   - Fix: `EvaluationVersionRecord` now exposes `reviewedAt`, and review audit records that value.

2. Provider-edge tests were incomplete.
   - Fix: added focused tests for DeepSeek-without-key behavior, provider timeout normalization, malformed provider output normalization, low-evidence development provider behavior, and reprocessing version creation.

## Review Results

Workflow:

- Step ordering is explicit: `finalize_media`, `transcribe_recording`, `evaluate_interview`, `generate_report`, `notify_results_ready`.
- Dependent steps rely on Phase 6 workflow orchestration and do not run before prerequisites succeed.
- Workflow payload/checkpoints contain IDs and counts only, not transcript text, prompts, evidence text, provider responses, signed URLs, media bytes, or secrets.

Media finalization:

- Media manifest validation checks verified interview-turn media, completed upload status, ready processing status, recording purpose, interview ownership, subject type, and size presence.
- The manifest carries storage references and metadata only. The app does not stream media.

Transcripts:

- Transcript segments are ordered by sequence and stored as rows.
- Transcript versions are append-only. Corrections create new versions and preserve provider output.
- Correction source version must belong to the same company, transcript, and interview.
- Transcript segment access is audited.
- Retention delete dates are assigned; legal-hold enforcement remains handled by the broader lifecycle modules.

Providers:

- Development transcription and evaluation providers are deterministic and work without external keys.
- DeepSeek remains optional. Without a key, the adapter returns normalized `provider_unavailable`.
- Provider timeout, retryable failures, malformed JSON, and schema failures are normalized.
- Provider secrets are never stored in PostgreSQL, audit logs, queue payloads, or provider metadata.

AI governance:

- Prompt and rubric versions are published, versioned records.
- Provider-specific payload storage uses request/response hashes and safe metadata, not raw responses.
- Redaction removes direct email and phone identifiers from transcript text before evaluation.
- Candidate notes, accommodation data, identity metadata, health data, monitoring warning payloads, and HR-only metadata are not included in provider inputs.

Evaluation:

- Score bounds are enforced against the rubric range.
- Confidence is stored separately from scores.
- Material competency results require evidence unless marked incomplete.
- Evidence citations must reference transcript segments from the active transcript bundle and excerpts must derive from stored transcript content.
- Unsupported protected-characteristic, health, appearance, emotion, or misconduct inferences are rejected.
- Monitoring warnings are not sent to the provider and do not affect scores.

Reports:

- HR reports are versioned and immutable.
- Reports use decision-support language and include a disclaimer that AI output supports but does not replace human decision-making.
- Reports do not include hidden prompts, chain-of-thought, raw provider responses, biometric data, accommodation details, or objective hiring verdicts.

Human review:

- Review, override, and decision mutations require authenticated user actors, RBAC, CSRF, tenant scoping, and reasons.
- Overrides are append-only and do not mutate original AI scores.
- Human hiring decision history is stored separately from AI output.

Notifications:

- Results-ready notification intent creation is idempotent by company, recipient, target type, and interview session.
- Notification payloads contain IDs only and do not send email directly in Phase 9.

## Fixes Applied

- Added transcript metadata access auditing.
- Routed transcript segment API reads through `TranscriptionService.listSegments`.
- Added same-interview validation for transcript correction source versions.
- Added explicit evaluation reprocessing service/API path with required reason and new-version creation.
- Corrected evaluation review audit timestamp.
- Added focused provider and reprocessing tests.
- Added `docs/PHASE9_REVIEW.md`.

## Remaining Accepted Risks

- DeepSeek live API behavior still requires manual integration testing with real credentials in a controlled environment.
- Legal-hold blocking and physical deletion are delegated to existing lifecycle/media modules and were not expanded in this review.
- Redaction policy currently covers direct email and phone identifiers. Broader NLP-based PII redaction should be evaluated before regulated-enterprise rollout.
- Transcript correction does not yet have a dedicated internal API in this review; service-level correction exists and reprocessing can be invoked after approved corrections.
- Results-ready notification recipient selection is permission-based and capped; enterprise notification routing rules can be refined later without changing workflow semantics.

## Provider And Manual Testing Still Required

- DeepSeek live request/response validation with a non-production key.
- Provider timeout and retry behavior against real network failures.
- Manual review of prompt/rubric publication workflows with seeded enterprise data.
- Manual audit-log review for transcript access, reprocessing, override, and decision events.
- Manual report copy review by HR/legal stakeholders for decision-support wording.

## Privacy And AI-Governance Limitations

- AI output is decision-support only.
- AI does not update candidate status, application status, hiring stage, or invitation status.
- No automatic rejection, candidate ranking, trust score, cheating score, or monitoring-based scoring exists.
- No chain-of-thought or hidden reasoning is exposed.
- Provider inputs are minimized, but broader PII redaction should be strengthened before production use in highly regulated regions.

## Approval

Phase 9 is approved for Phase 10 after the hardening fixes above and successful verification.
