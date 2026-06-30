# Phase 5 Production Readiness Review

## Scope

Reviewed Phase 5 Candidate Portal and Readiness only: invitation activation, magic-link exchange, candidate sessions, continuation tokens, candidate CSRF, candidate-facing preparation pages, consent, identity self-attestation, readiness checks, accommodation/support/withdrawal records, and internal inspection APIs.

No Phase 6 interview execution, recording, object storage upload, voice, camera monitoring, AI, transcription, evaluation, reports, or dashboards were reviewed or added.

## Findings

### P0 - Resolved

No P0 production blockers remain after this review.

### P1 - Fixed

1. Candidate readiness pages inherited the global `Permissions-Policy` of `camera=(), microphone=()`, which would block camera and microphone readiness checks in production browsers.
   - Fix: candidate routes now receive `camera=(self), microphone=(self)` while non-candidate routes remain blocked.
   - Files: `middleware.ts`, `src/server/api/security.ts`, `tests/server-api.test.ts`.

2. `/candidate/entry?token=...` depended on client hydration before removing the token from the visible URL.
   - Risk: token could remain visible longer than necessary and had higher exposure to browser history, referrer/subresource timing, screenshots, and client error tooling.
   - Fix: middleware now redirects query-token entries to `/candidate/entry#token=...` with `303`, `Cache-Control: no-store`, and `Referrer-Policy: no-referrer`; the client reads the fragment and immediately calls `history.replaceState` before exchange.
   - Files: `middleware.ts`, `src/app/candidate/entry/token-exchange.tsx`, `tests/ui/candidate-portal.test.tsx`.

3. Expired active candidate sessions could retain `activeLockKey` and block a future valid session for the same invitation.
   - Fix: token exchange clears expired active locks transactionally before creating a new session; session validation marks expired active sessions as `EXPIRED`, clears locks, and audits expiration.
   - File: `src/modules/candidate-portal/service.ts`.

4. Continuation tokens could be issued but had no exchange/consume path.
   - Fix: added single-use resume exchange that validates hash, expiry, consumed state, and active session state, then rotates candidate session and CSRF tokens.
   - Files: `src/modules/candidate-portal/service.ts`, `src/app/api/candidate/resume/route.ts`.

### P2 - Fixed

1. Identity snapshot metadata used placeholder checksum/size values.
   - Fix: client now captures a local still frame into a canvas, computes SHA-256 over the JPEG blob, and submits metadata only. No object storage upload or recording was added.
   - File: `src/app/candidate/identity/identity-form.tsx`.

2. Tests did not cover token URL stripping or candidate-specific media permissions.
   - Fix: added regression tests for candidate entry fragment exchange and scoped media permissions.
   - Files: `tests/ui/candidate-portal.test.tsx`, `tests/server-api.test.ts`.

## Security Review

Magic-link token security: approved with fixes. Tokens are generated with `randomBytes(32)`, stored as SHA-256 hashes, and raw invitation tokens are only used in-memory for the invitation URL. The exchange API does not return raw invitation tokens.

Token replay prevention: approved. Exchange updates the invitation only when `tokenConsumedAt` and `tokenRevokedAt` are null and expiry is valid. Replays return safe non-enumerating responses.

Token rotation and resend safety: acceptable for Phase 5. Resend activation rotates the stored hash and invalidates the prior raw link. Remaining risk: delivery failure after rotation can leave the newest token unsent; this should be revisited when operational resend UX is built.

Timing-safe token verification: acceptable. The lookup is by token hash, and equal-length timing-safe comparison is retained before exchange.

Candidate session fixation: approved. Session tokens are generated server-side, stored hashed, and rotated during resume exchange.

Session expiration and revocation: approved after fixes. Expired sessions clear active locks. Withdrawal revokes the candidate session and closes the invitation.

Continuation/resume token security: approved after fixes. Resume tokens are hash-only in storage, short-lived, single-use, and rotate session/CSRF tokens on exchange.

Multiple-browser conflict handling: approved for Phase 5. One active session per invitation is enforced with `activeLockKey`; expired locks are now cleared.

Candidate CSRF: approved. Candidate mutations use a separate candidate CSRF cookie/header and do not reuse company-user CSRF.

Cookie configuration: acceptable. Candidate session cookie is HTTP-only, path-scoped to `/candidate`, `SameSite=Lax`, and secure in production. Candidate CSRF cookie is readable by client code by design.

Rate limiting: acceptable for Phase 5. Public endpoints use memory rate limiting by IP/user-agent scope and token attempts are persisted. Remaining risk: distributed production deployments require Redis-backed rate limiting.

Invitation enumeration: approved. Public exchange responses use generic accepted/reason routing without candidate or tenant identifiers.

Tenant isolation and cross-tenant safety: approved. Phase 5 tables use tenant-qualified foreign keys and APIs query through tenant-scoped IDs.

Sensitive logging and redaction: approved. Raw tokens are not logged or audited. Session and CSRF hashes are redacted in audit snapshots.

CSP and Referrer-Policy: approved after fixes. Candidate entry responses are no-store/no-referrer, global pages use `Referrer-Policy: no-referrer`, and frame embedding is denied.

## Privacy And Compliance Review

Consent versioning and auditability: approved. Consent records include consent version, policy version, timestamp, invitation, session, and tenant scope.

Consent denial and withdrawal behavior: acceptable. API can persist denial states, and UI directs candidates to support/withdrawal instead of creating a broken state.

Identity verification minimization: approved after fixes. The system stores self-attestation and snapshot metadata only, with restricted classification metadata. No biometric templates or embeddings are stored.

Retention-policy integration: partial. Phase 5 records include metadata needed for retention classification, but automated retention jobs remain later lifecycle work.

Accommodation/support privacy: acceptable. Records are tenant-scoped and auditable; internal inspection APIs require tenant-authenticated permissions.

Withdrawal consistency: approved. Withdrawal records are unique per invitation, update invitation state, revoke the active session, and create HR notification intent.

## Accessibility Review

WCAG 2.2 AA target: acceptable for Phase 5 foundation.

Keyboard navigation: core controls are native or Radix-based; candidate forms can be operated by keyboard.

Screen-reader behavior: primary pages use semantic landmarks, labels, status alerts, and descriptive link/button text.

Focus management: acceptable for static pages and forms. Remaining risk: no custom focus restoration for route transitions yet.

Reduced motion: no custom animation was added in Phase 5.

Mobile and unsupported-device recovery: acceptable. Dedicated unsupported and permission-denied recovery pages exist, and readiness results distinguish pass/warning/fail.

## Accidental Phase 6+ Functionality Check

No interview room, media recording, object storage upload, voice interaction, monitoring, AI, transcription, evaluation, reporting, analytics dashboards, or HR dashboards were introduced.

The webcam identity step captures metadata for a single local still frame only and does not upload media or start interview recording.

## Remaining Accepted Risks

1. Public rate limiting is in-memory and must move to Redis or an edge/provider limiter before multi-instance production deployment.
2. Invitation activation can rotate a token before email delivery is confirmed; production resend UX should handle delivery failure recovery explicitly.
3. Resume token creation API returns a raw continuation token to the active candidate session; this is acceptable for Phase 5 but should be paired with UX constraints before broad use.
4. Retention enforcement for Phase 5 records depends on later lifecycle jobs.
5. Manual assistive-technology testing remains required for full WCAG 2.2 AA sign-off.

## Manual Testing Still Required

1. Open `/candidate/entry?token=...` in Chrome, Edge, Safari, and Firefox and confirm it redirects to a fragment URL, then immediately replaces the URL with `/candidate/entry`.
2. Confirm no raw token appears in browser history after successful exchange.
3. Confirm request logs, client error reports, and analytics are not collecting full candidate URLs before production analytics is enabled.
4. Validate camera and microphone prompts on supported desktop browsers.
5. Validate permission-denied recovery flows on Chrome, Edge, Safari, and Firefox.
6. Test keyboard-only navigation through consent, identity, readiness, support, accommodation, and withdrawal pages.
7. Test with NVDA, JAWS, VoiceOver, and browser zoom at 200%.
8. Verify mobile unsupported-device guidance on iOS Safari and Android Chrome.

## Approval

Phase 5 is approved for Phase 6 after the fixes in this review, subject to the accepted risks above being tracked before production launch.
