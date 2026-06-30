# Phase 4A Principal Engineer Review

## Scope

Reviewed Phase 4A only: authentication, authorization, internal API foundation, security helpers, and internal CRUD APIs for companies, departments, teams, locations, jobs, job templates, hiring pipelines, and pipeline stages.

No Phase 4B functionality was reviewed as implementation scope because Phase 4B has not started.

## Findings

### Fixed During Review

1. Authenticated CRUD mutations lacked CSRF enforcement.
   - Risk: A browser session could be used for cross-site POST/PUT/DELETE requests against internal configuration APIs.
   - Fix: Added CSRF-enforcing mutation guards for tenant and platform scoped internal mutations, and wired all Phase 4A CRUD POST/PUT/DELETE handlers through those guards.

2. Auth-domain errors normalized as generic 500 responses.
   - Risk: Invalid credentials, expired sessions, and password policy failures could return incorrect internal-error responses.
   - Fix: Mapped `AuthenticationError` to 401 and `PasswordPolicyError` to 422 through the standard API error envelope.

3. Prisma not-found and unique-conflict errors normalized as generic 500 responses.
   - Risk: Missing records and uniqueness collisions produced inconsistent API behavior.
   - Fix: Mapped Prisma `P2025` to 404 and `P2002` to 409.

4. Non-production cookies used the `__Host-` prefix without `Secure`.
   - Risk: Browsers may reject prefixed cookies when they do not satisfy prefix requirements in local/test HTTP environments.
   - Fix: Kept `__Host-` names for production secure cookies and used non-prefixed names in non-production.

5. CSRF comparison used direct string equality.
   - Risk: Low practical risk, but inconsistent with security-sensitive token comparison patterns.
   - Fix: Switched CSRF token comparison to timing-safe equality.

6. Password reset did not revoke existing sessions.
   - Risk: A compromised or stale session could remain active after password reset.
   - Fix: Added subject-level session revocation after successful password reset.

7. In-memory rate limiter retained expired buckets indefinitely.
   - Risk: Long-running processes could accumulate stale limiter keys.
   - Fix: Added expired-bucket pruning during rate-limit checks.

8. Nested pipeline-stage item routes did not verify the stage belonged to the pipeline ID in the URL for update/delete.
   - Risk: A same-tenant stage could be updated through the wrong parent route if its ID was known.
   - Fix: Added parent-pipeline membership checks before stage update/delete.

## Security Review

Auth security is acceptable for Phase 4A after fixes. Passwords are hashed with scrypt and never returned by APIs. Sessions and reset/verification tokens are opaque and stored hashed. Refresh tokens rotate on use. Password reset consumes the reset token and now revokes active sessions for the subject.

CSRF protection is now enforced on authenticated state-changing routes. Public token flows remain intentionally CSRF-exempt because they do not rely on existing authenticated browser state.

Cookies use `httpOnly` for session and refresh tokens, `sameSite=lax`, path `/`, and production `Secure` with `__Host-` prefix. CSRF cookie remains script-readable by design for double-submit protection.

## Tenant And RBAC Review

Tenant isolation is enforced through authenticated company context or explicit platform `x-company-id` tenant scoping. CRUD queries use tenant-scoped composite identifiers where applicable. Platform routes require platform auth context and tenant permissions.

RBAC enforcement is present for all internal configuration APIs. Platform admins receive platform-wide permission context. Company users receive permissions loaded from assigned roles.

## API Review

Validation uses Zod at request boundaries. API responses use the standard `{ ok, data|error, meta }` envelope. Pagination primitives exist, and list endpoints apply bounded limits. Errors are normalized consistently after the fixes above.

Some list routes currently return raw Prisma records. These records do not include credentials or token hashes in Phase 4A routes, but response projection should be tightened before broader API exposure.

## Test Coverage

Existing tests cover password hashing, session rotation, reset/verification token behavior, API envelopes, CSRF helper behavior, rate limiting, security headers, and tenant/RBAC guard behavior.

Additional review-driven coverage was added for:

- Password reset revoking existing sessions.
- Environment-correct cookie prefix behavior.
- Auth/password policy error normalization.

## Remaining Risks

1. Rate limiting is in-memory.
   - Acceptable for Phase 4A foundation, but must move to Redis-backed distributed enforcement before production traffic.

2. Route-level integration tests do not exercise every internal CRUD handler against a test database.
   - Unit and static coverage are adequate for Phase 4A, but Phase 4B should add route integration tests before expanding user-facing workflows.

3. MFA remains architecture-ready, not implemented.
   - This matches Phase 4A scope. Enrollment, challenge verification, recovery codes, and device binding remain future work.

4. Internal CRUD responses return complete non-secret configuration records.
   - Acceptable for internal Phase 4A APIs, but response DTOs should be introduced before public or frontend consumption.

5. Password reset and email verification foundations create tokens but do not deliver email.
   - This is intentional. Email delivery belongs to a later phase.

## Phase 4B Boundary Check

No Phase 4B+ functionality was introduced. There are no candidate interview flows, interview execution, AI integration, camera/voice/media handling, dashboards, frontend pages, email delivery, or candidate portal routes.

## Approval

Phase 4A is approved for Phase 4B after the hardening fixes completed in this review.
