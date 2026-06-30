import { describe, expect, it } from "vitest";

import {
  createCandidateCsrfToken,
  createCandidateSessionToken,
  createInvitationToken,
  hashCandidateToken,
  isWellFormedToken,
  timingSafeHashEqual,
} from "@/modules/candidate-portal";

describe("candidate portal token security", () => {
  it("generates opaque invitation, session, and csrf tokens that are never their hashes", () => {
    const invitationToken = createInvitationToken();
    const sessionToken = createCandidateSessionToken();
    const csrfToken = createCandidateCsrfToken();

    expect(isWellFormedToken(invitationToken)).toBe(true);
    expect(isWellFormedToken(sessionToken)).toBe(true);
    expect(isWellFormedToken(csrfToken)).toBe(true);
    expect(hashCandidateToken(invitationToken)).not.toBe(invitationToken);
    expect(hashCandidateToken(sessionToken)).not.toBe(sessionToken);
    expect(hashCandidateToken(csrfToken)).not.toBe(csrfToken);
  });

  it("compares token hashes with equal-length timing-safe semantics", () => {
    const token = createInvitationToken();
    const hash = hashCandidateToken(token);

    expect(timingSafeHashEqual(hash, hashCandidateToken(token))).toBe(true);
    expect(timingSafeHashEqual(hash, hashCandidateToken(createInvitationToken()))).toBe(false);
    expect(timingSafeHashEqual(hash, "short")).toBe(false);
  });

  it("rejects malformed candidate link tokens", () => {
    expect(isWellFormedToken("")).toBe(false);
    expect(isWellFormedToken("not a token")).toBe(false);
    expect(isWellFormedToken("a".repeat(12))).toBe(false);
  });
});
