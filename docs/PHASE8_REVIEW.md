# Phase 8 Production Readiness Review

Review date: 2026-07-01

Scope: Phase 8 Monitoring Warnings only. This review covered consent enforcement, accommodation exemptions, candidate transparency, event validation, thresholding, cooldowns, aggregation, batching, tenant and candidate-session isolation, internal review APIs, privacy/data minimization, accessibility, audit coverage, retention/legal-hold compatibility, feature-disable behavior, and accidental Phase 9+ functionality.

## Verdict

Phase 8 is approved for Phase 9 after the hardening fixes listed below.

No transcription, speech-to-text processing, AI interviewer behavior, OpenAI integration, evaluation, competency scoring, hiring recommendation, candidate ranking, reports, analytics dashboards, HR dashboards, admin dashboards, or Phase 9 functionality was added during this review.

Monitoring remains warning-only. Monitoring events do not update candidate scores, application status, interview completion, hiring decisions, workflow results, or candidate ranking.

## Findings

### P0 - Monitoring Delivery Failure Could Block Interview Completion

The candidate interview room attempted to flush monitoring warnings immediately before interview completion. If the monitoring ingestion request threw due to network loss, browser fetch failure, or offline state, completion could be interrupted even though monitoring is contextual and must not block interview submission.

Fix applied: browser monitoring flush now catches transport failures, requeues the same limited batch, updates the candidate-facing monitoring status, and returns without throwing. Interview completion also treats monitoring flush as best-effort and continues if warning delivery is unavailable.

### P1 - Monitoring Disable Controls Were Not Enforced Server-Side

The Phase 8 service enforced monitoring consent and accommodation exemptions, but did not yet consult platform emergency disable or tenant feature flags before enabling monitoring configuration.

Fix applied: monitoring configuration now checks a platform emergency switch (`APTLY_MONITORING_ENABLED=false`) and tenant feature flags from `company_settings.featureFlagsJson`. Tenant flags `monitoring_enabled=false`, `monitoring_disabled=true`, or `monitoring_emergency_disabled=true` disable monitoring for candidate sessions with a neutral disabled reason.

### P1 - Cooldown Windows Were Documented But Not Centrally Enforced

Threshold definitions included cooldown windows, but aggregation keys were accepted directly from the browser. This could aggregate forever under one key or rely too heavily on client behavior for write-volume control.

Fix applied: the service now appends a threshold-derived cooldown bucket to accepted aggregation keys before persistence. Repeated identical warnings aggregate within the configured cooldown window and cannot flood storage, while future windows remain reviewable as separate contextual periods.

### P1 - Metadata Sanitization Needed Stricter Arbitrary JSON Rejection

The service rejected disallowed metadata keys, but allowed keys with nested or unsupported values were silently ignored. This was too loose for a privacy-sensitive public ingestion endpoint.

Fix applied: metadata now accepts only allowlisted keys with primitive string, finite number, or boolean values. Nested objects, arrays, nulls, and unsupported value types reject the event instead of being silently trimmed.

### P1 - Camera And Microphone Permission Removal Was Not Explicitly Captured

The candidate client detected recording interruption and camera sample warnings, but did not explicitly record browser track `ended` or `mute` events after permission removal or device loss.

Fix applied: the interview room now observes audio and video track availability and submits warning-only `camera_permission_removed` or `microphone_unavailable` events with safe reason codes. No frame, audio data, biometric data, or raw telemetry is sent.

### P2 - Test Coverage Did Not Fully Capture Phase 8 Disable, Cooldown, And Metadata Controls

Existing tests covered consent, weak face warnings, duplicate batches, neutral summaries, and audit. They did not cover global/company disable controls, accommodation exemption behavior in the same path, nested metadata rejection, or cooldown aggregation.

Fix applied: focused service tests were added for those controls.

## Fixes Applied

- Added monitoring feature-control contract to the monitoring repository boundary.
- Added platform-level monitoring emergency disable via `APTLY_MONITORING_ENABLED=false`.
- Added tenant-level monitoring disable checks from company feature flags.
- Added server-side cooldown-bucket aggregation for accepted warning events.
- Tightened metadata sanitization to reject nested or arbitrary JSON values.
- Made browser monitoring flush failure non-blocking for interview completion.
- Added camera and microphone track-loss warning capture using safe reason codes only.
- Added tests for disable controls, accommodation exemption, nested metadata rejection, and cooldown aggregation.

## Privacy Limitations

- The browser client samples camera frames only locally for simple brightness and face-count checks. It does not upload or persist frames, crops, facial embeddings, biometric templates, or raw telemetry.
- Copy and paste monitoring records only occurrence events and safe reason codes. Clipboard content and typed text are not read, submitted, persisted, or logged.
- Warning metadata is restricted to a small allowlist and primitive values.
- Monitoring ingestion stores warning summaries and safe metadata only. It does not store signed media URLs, raw media bytes, transcripts, prompts, scores, or evaluation payloads.
- `FaceDetector` support varies by browser. Unsupported browsers record neutral monitoring unavailability and do not block the interview.

## Fairness And Accessibility Considerations

- Monitoring warnings remain contextual and non-decisional. They do not produce cheating verdicts, trust scores, automatic rejection, ranking, or application status changes.
- Short face or focus events must pass minimum duration, occurrence, and confidence thresholds before they become stored warnings.
- Accommodation exemptions disable monitoring for the candidate session and do not create negative warnings.
- Candidate copy remains neutral and transparent: the UI describes limited warning signals and avoids guilt-implying language.
- The interview can continue when monitoring is disabled, unavailable, or temporarily unable to submit events.
- Candidate monitoring notices use readable text, status labels, and existing focus-visible design-system behavior. No color-only state is required to understand monitoring state.

## Remaining Accepted Risks

- Phase 8 stores `retentionDeleteAt` and legal-hold linkage fields, but full scheduled monitoring-warning deletion and privacy-request fulfillment remain part of the broader data lifecycle hardening path.
- Support-access review APIs rely on the existing authenticated tenant-context and support-access foundations. A later enterprise hardening pass should run an end-to-end platform support-access drill against monitoring timeline and review endpoints.
- Browser detector behavior is intentionally conservative and warning-only, but real-world false-positive tuning requires seeded browser/device testing across actual camera hardware and network conditions.
- Tenant feature flags are stored in existing company settings JSON. A future platform settings table should own global feature flags beyond the current environment emergency switch.

## Browser And Device Manual Testing Still Required

Automated tests validate the service rules, route validation, warning-only UI copy, accessibility-critical status rendering, and no-scoring behavior. Practical hardware/browser checks still require seeded candidate sessions and real permission prompts.

Checks performed in this environment:

- Service-level monitoring consent, accommodation, disable, threshold, cooldown, metadata, idempotency, aggregation, summary, and review-audit tests.
- UI-level candidate interview room rendering with neutral monitoring copy and accessible recording status.
- Static verification that the monitoring client does not upload camera frames, face crops, biometric templates, clipboard content, typed text, or signed URLs.
- Verification that automated build, lint, tests, format check, and npm audit pass.

Manual checks still required before production pilot:

- Chrome and Edge with native `FaceDetector` where available: camera obstruction, candidate leaving frame, multiple-face threshold behavior, focus/tab changes, and event aggregation.
- Firefox without native `FaceDetector`: neutral monitoring unavailable state and continued interview completion.
- Safari compatibility assumptions: local sampling, MediaRecorder coexistence, permission prompts, and monitoring-unavailable behavior where APIs differ.
- Camera permission removal and device unplug/track-ended behavior.
- Network degradation and offline event batching/retry.
- Monitoring disabled globally via `APTLY_MONITORING_ENABLED=false`.
- Monitoring disabled per company via tenant feature flags.
- Accommodation exemption behavior for sessions with approved accessibility support.
- Interview completion while monitoring ingestion fails.

## Phase 9 Readiness

Approved for Phase 9 with the accepted manual browser/device validation risks above. Phase 9 may consume monitoring summaries as contextual warning data only; it must not treat warnings as scoring, guilt, automatic rejection, ranking, or hiring-decision input without human-owned review framing.
