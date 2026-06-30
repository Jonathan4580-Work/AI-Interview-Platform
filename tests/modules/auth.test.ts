import { describe, expect, it } from "vitest";

import {
  AuthenticationError,
  AuthService,
  hashPassword,
  hashToken,
  PasswordPolicyError,
  verifyPassword,
} from "@/modules/auth";
import { normalizeEmail } from "@/modules/identity";

import type {
  AuthCredentialId,
  AuthCredentialRecord,
  AuthRepository,
  AuthSessionId,
  AuthSessionRecord,
  AuthSessionStatus,
  AuthSubject,
  AuthTokenRecord,
  CreateAuthSessionInput,
  EmailVerificationTokenId,
  PasswordResetTokenId,
} from "@/modules/auth";
import type { NormalizedEmail, PlatformUserId, UserId } from "@/modules/identity";
import type { TenantId } from "@/modules/tenant";

describe("authentication foundation", () => {
  it("hashes passwords with policy enforcement and verifies without storing plaintext", () => {
    const hash = hashPassword("CorrectHorse42");

    expect(hash).not.toContain("CorrectHorse42");
    expect(verifyPassword("CorrectHorse42", hash)).toBe(true);
    expect(verifyPassword("IncorrectHorse42", hash)).toBe(false);
    expect(() => hashPassword("short")).toThrow(PasswordPolicyError);
  });

  it("authenticates active company users only within their tenant", async () => {
    const repository = new MemoryAuthRepository();
    const service = new AuthService(repository, fixedClock());
    const companyId = "company_1" as TenantId;
    const otherCompanyId = "company_2" as TenantId;
    const subject = companySubject({ companyId, userId: "user_1" as UserId });
    repository.addCredential(subject, "CorrectHorse42");

    const issued = await service.authenticateCompanyUser({
      companyId,
      email: "MEMBER@EXAMPLE.COM",
      password: "CorrectHorse42",
      security: securityContext,
    });

    expect(issued.session.subject).toEqual(subject);
    expect(issued.sessionToken).not.toEqual(issued.session.sessionTokenHash);
    expect(repository.logins).toHaveLength(1);

    await expect(
      service.authenticateCompanyUser({
        companyId: otherCompanyId,
        email: "member@example.com",
        password: "CorrectHorse42",
        security: securityContext,
      }),
    ).rejects.toThrow(AuthenticationError);
  });

  it("rotates refresh tokens and revokes the previous session", async () => {
    const repository = new MemoryAuthRepository();
    const service = new AuthService(repository, fixedClock());
    const subject = companySubject({
      companyId: "company_1" as TenantId,
      userId: "user_1" as UserId,
    });
    repository.addCredential(subject, "CorrectHorse42");
    const issued = await service.authenticateCompanyUser({
      companyId: subject.companyId,
      email: "member@example.com",
      password: "CorrectHorse42",
      security: securityContext,
    });

    const refreshed = await service.refreshSession({
      refreshToken: issued.refreshToken,
      security: securityContext,
    });

    expect(refreshed.refreshToken).not.toEqual(issued.refreshToken);
    expect(repository.sessions.get(issued.session.id)?.status).toBe("revoked");
    await expect(
      service.refreshSession({ refreshToken: issued.refreshToken, security: securityContext }),
    ).rejects.toThrow(AuthenticationError);
  });

  it("uses single-use password reset tokens without exposing token hashes", async () => {
    const repository = new MemoryAuthRepository();
    const service = new AuthService(repository, fixedClock());
    const subject = companySubject({
      companyId: "company_1" as TenantId,
      userId: "user_1" as UserId,
    });
    repository.addCredential(subject, "CorrectHorse42");
    await service.authenticateCompanyUser({
      companyId: subject.companyId,
      email: "member@example.com",
      password: "CorrectHorse42",
      security: securityContext,
    });

    const reset = await service.createCompanyPasswordReset({
      companyId: subject.companyId,
      email: "member@example.com",
    });

    expect(reset).not.toBeNull();
    if (reset === null) {
      throw new Error("Expected password reset token.");
    }
    const storedResetToken = repository.passwordResetTokens.values().next().value;
    if (storedResetToken === undefined) {
      throw new Error("Expected stored password reset token.");
    }
    expect(storedResetToken.tokenHash).toEqual(hashToken(reset.token));

    await service.resetPassword({
      token: reset.token,
      newPassword: "NewCorrect42",
    });

    expect([...repository.sessions.values()].every((session) => session.status === "revoked")).toBe(
      true,
    );
    await expect(
      service.resetPassword({
        token: reset.token,
        newPassword: "AnotherCorrect42",
      }),
    ).rejects.toThrow(AuthenticationError);
    await expect(
      service.authenticateCompanyUser({
        companyId: subject.companyId,
        email: "member@example.com",
        password: "NewCorrect42",
        security: securityContext,
      }),
    ).resolves.toBeDefined();
  });

  it("verifies email with a one-time verification token", async () => {
    const repository = new MemoryAuthRepository();
    const service = new AuthService(repository, fixedClock());
    const subject = companySubject({
      companyId: "company_1" as TenantId,
      userId: "user_1" as UserId,
    });
    const credential = repository.addCredential(subject, "CorrectHorse42", null);

    const verification = await service.createEmailVerification({ subject });
    await service.verifyEmail(verification.token);

    expect(repository.credentials.get(credential.id)?.emailVerifiedAt).toEqual(now);
    await expect(service.verifyEmail(verification.token)).rejects.toThrow(AuthenticationError);
  });
});

const now = new Date("2026-06-30T00:00:00.000Z");
const securityContext = { ipAddress: "203.0.113.10", userAgent: "vitest" };

function fixedClock(): () => Date {
  return () => now;
}

function companySubject(input: {
  readonly companyId: TenantId;
  readonly userId: UserId;
}): AuthSubject & { readonly type: "user" } {
  return {
    type: "user",
    companyId: input.companyId,
    userId: input.userId,
    email: normalizeEmail("member@example.com"),
    name: "Member Example",
    status: "active",
  };
}

class MemoryAuthRepository implements AuthRepository {
  public readonly credentials = new Map<AuthCredentialId, AuthCredentialRecord>();
  public readonly sessions = new Map<AuthSessionId, AuthSessionRecord>();
  public readonly passwordResetTokens = new Map<PasswordResetTokenId, AuthTokenRecord>();
  public readonly emailVerificationTokens = new Map<EmailVerificationTokenId, AuthTokenRecord>();
  public readonly logins: { readonly subject: AuthSubject; readonly loggedInAt: Date }[] = [];
  private sequence = 0;

  public addCredential(
    subject: AuthSubject,
    password: string,
    emailVerifiedAt: Date | null = now,
  ): AuthCredentialRecord {
    const credential: AuthCredentialRecord = {
      id: this.nextId("credential") as AuthCredentialId,
      subject,
      passwordHash: hashPassword(password),
      emailVerifiedAt,
      passwordUpdatedAt: now,
    };
    this.credentials.set(credential.id, credential);
    return credential;
  }

  public findCompanyCredential(input: {
    readonly companyId: TenantId;
    readonly email: NormalizedEmail;
  }): Promise<AuthCredentialRecord | null> {
    return Promise.resolve(
      [...this.credentials.values()].find(
        (credential) =>
          credential.subject.type === "user" &&
          credential.subject.companyId === input.companyId &&
          credential.subject.email === input.email,
      ) ?? null,
    );
  }

  public findPlatformCredential(email: NormalizedEmail): Promise<AuthCredentialRecord | null> {
    return Promise.resolve(
      [...this.credentials.values()].find(
        (credential) =>
          credential.subject.type === "platform_user" && credential.subject.email === email,
      ) ?? null,
    );
  }

  public createCompanyCredential(input: {
    readonly companyId: TenantId;
    readonly userId: UserId;
    readonly passwordHash: string;
    readonly emailVerifiedAt: Date | null;
  }): Promise<AuthCredentialRecord> {
    const subject = companySubject({ companyId: input.companyId, userId: input.userId });
    return Promise.resolve(
      this.storeCredential(subject, input.passwordHash, input.emailVerifiedAt),
    );
  }

  public createPlatformCredential(input: {
    readonly platformUserId: PlatformUserId;
    readonly passwordHash: string;
    readonly emailVerifiedAt: Date | null;
  }): Promise<AuthCredentialRecord> {
    return Promise.resolve(
      this.storeCredential(
        {
          type: "platform_user",
          platformUserId: input.platformUserId,
          email: normalizeEmail("platform@example.com"),
          name: "Platform Admin",
          status: "active",
        },
        input.passwordHash,
        input.emailVerifiedAt,
      ),
    );
  }

  public updatePassword(input: {
    readonly subject: AuthSubject;
    readonly passwordHash: string;
  }): Promise<AuthCredentialRecord> {
    const existing = this.findCredentialBySubject(input.subject);
    const updated = {
      ...existing,
      passwordHash: input.passwordHash,
      passwordUpdatedAt: now,
    };
    this.credentials.set(updated.id, updated);
    return Promise.resolve(updated);
  }

  public markEmailVerified(input: {
    readonly subject: AuthSubject;
    readonly verifiedAt: Date;
  }): Promise<AuthCredentialRecord> {
    const existing = this.findCredentialBySubject(input.subject);
    const updated = { ...existing, emailVerifiedAt: input.verifiedAt };
    this.credentials.set(updated.id, updated);
    return Promise.resolve(updated);
  }

  public recordLogin(input: {
    readonly subject: AuthSubject;
    readonly loggedInAt: Date;
  }): Promise<void> {
    this.logins.push(input);
    return Promise.resolve();
  }

  public createSession(input: CreateAuthSessionInput): Promise<AuthSessionRecord> {
    const session: AuthSessionRecord = {
      id: this.nextId("session") as AuthSessionId,
      subject: input.subject,
      status: "active",
      sessionTokenHash: input.sessionTokenHash,
      refreshTokenHash: input.refreshTokenHash,
      csrfTokenHash: input.csrfTokenHash,
      ipAddress: input.security.ipAddress,
      userAgent: input.security.userAgent,
      lastSeenAt: now,
      expiresAt: input.expiresAt,
      refreshExpiresAt: input.refreshExpiresAt,
      revokedAt: null,
      createdAt: now,
    };
    this.sessions.set(session.id, session);
    return Promise.resolve(session);
  }

  public findActiveSessionBySessionTokenHash(
    sessionTokenHash: string,
  ): Promise<AuthSessionRecord | null> {
    return Promise.resolve(
      [...this.sessions.values()].find(
        (session) => session.status === "active" && session.sessionTokenHash === sessionTokenHash,
      ) ?? null,
    );
  }

  public findActiveSessionByRefreshTokenHash(
    refreshTokenHash: string,
  ): Promise<AuthSessionRecord | null> {
    return Promise.resolve(
      [...this.sessions.values()].find(
        (session) => session.status === "active" && session.refreshTokenHash === refreshTokenHash,
      ) ?? null,
    );
  }

  public touchSession(input: {
    readonly sessionId: AuthSessionId;
    readonly lastSeenAt: Date;
  }): Promise<AuthSessionRecord> {
    const existing = this.requireSession(input.sessionId);
    const updated = { ...existing, lastSeenAt: input.lastSeenAt };
    this.sessions.set(updated.id, updated);
    return Promise.resolve(updated);
  }

  public revokeSession(input: {
    readonly sessionId: AuthSessionId;
    readonly revokedAt: Date;
    readonly status: AuthSessionStatus;
  }): Promise<AuthSessionRecord> {
    const existing = this.requireSession(input.sessionId);
    const updated = { ...existing, status: input.status, revokedAt: input.revokedAt };
    this.sessions.set(updated.id, updated);
    return Promise.resolve(updated);
  }

  public revokeSubjectSessions(input: {
    readonly subject: AuthSubject;
    readonly revokedAt: Date;
    readonly status: AuthSessionStatus;
  }): Promise<void> {
    for (const session of this.sessions.values()) {
      if (session.status === "active" && sameSubject(session.subject, input.subject)) {
        this.sessions.set(session.id, {
          ...session,
          status: input.status,
          revokedAt: input.revokedAt,
        });
      }
    }
    return Promise.resolve();
  }

  public createPasswordResetToken(input: {
    readonly subject: AuthSubject;
    readonly tokenHash: string;
    readonly expiresAt: Date;
  }): Promise<AuthTokenRecord> {
    const record = this.createToken(input.subject, input.tokenHash, input.expiresAt);
    this.passwordResetTokens.set(record.id as PasswordResetTokenId, record);
    return Promise.resolve(record);
  }

  public findPasswordResetToken(tokenHash: string): Promise<AuthTokenRecord | null> {
    return Promise.resolve(
      [...this.passwordResetTokens.values()].find((token) => token.tokenHash === tokenHash) ?? null,
    );
  }

  public consumePasswordResetToken(input: {
    readonly tokenId: PasswordResetTokenId;
    readonly usedAt: Date;
  }): Promise<AuthTokenRecord> {
    const token = this.passwordResetTokens.get(input.tokenId);
    if (token === undefined) {
      throw new Error("Password reset token not found.");
    }
    const updated = { ...token, completedAt: input.usedAt };
    this.passwordResetTokens.set(input.tokenId, updated);
    return Promise.resolve(updated);
  }

  public createEmailVerificationToken(input: {
    readonly subject: AuthSubject;
    readonly tokenHash: string;
    readonly expiresAt: Date;
  }): Promise<AuthTokenRecord> {
    const record = this.createToken(input.subject, input.tokenHash, input.expiresAt);
    this.emailVerificationTokens.set(record.id as EmailVerificationTokenId, record);
    return Promise.resolve(record);
  }

  public findEmailVerificationToken(tokenHash: string): Promise<AuthTokenRecord | null> {
    return Promise.resolve(
      [...this.emailVerificationTokens.values()].find((token) => token.tokenHash === tokenHash) ??
        null,
    );
  }

  public consumeEmailVerificationToken(input: {
    readonly tokenId: EmailVerificationTokenId;
    readonly verifiedAt: Date;
  }): Promise<AuthTokenRecord> {
    const token = this.emailVerificationTokens.get(input.tokenId);
    if (token === undefined) {
      throw new Error("Email verification token not found.");
    }
    const updated = { ...token, completedAt: input.verifiedAt };
    this.emailVerificationTokens.set(input.tokenId, updated);
    return Promise.resolve(updated);
  }

  private storeCredential(
    subject: AuthSubject,
    passwordHash: string,
    emailVerifiedAt: Date | null,
  ): AuthCredentialRecord {
    const credential: AuthCredentialRecord = {
      id: this.nextId("credential") as AuthCredentialId,
      subject,
      passwordHash,
      emailVerifiedAt,
      passwordUpdatedAt: now,
    };
    this.credentials.set(credential.id, credential);
    return credential;
  }

  private findCredentialBySubject(subject: AuthSubject): AuthCredentialRecord {
    const credential = [...this.credentials.values()].find((candidate) =>
      sameSubject(candidate.subject, subject),
    );
    if (credential === undefined) {
      throw new Error("Credential not found.");
    }
    return credential;
  }

  private requireSession(sessionId: AuthSessionId): AuthSessionRecord {
    const session = this.sessions.get(sessionId);
    if (session === undefined) {
      throw new Error("Session not found.");
    }
    return session;
  }

  private createToken(subject: AuthSubject, tokenHash: string, expiresAt: Date): AuthTokenRecord {
    return {
      id: this.nextId("token") as PasswordResetTokenId,
      subject,
      tokenHash,
      expiresAt,
      completedAt: null,
      createdAt: now,
    };
  }

  private nextId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}_${String(this.sequence)}`;
  }
}

function sameSubject(left: AuthSubject, right: AuthSubject): boolean {
  if (left.type !== right.type) {
    return false;
  }
  if (left.type === "user" && right.type === "user") {
    return left.companyId === right.companyId && left.userId === right.userId;
  }
  if (left.type === "platform_user" && right.type === "platform_user") {
    return left.platformUserId === right.platformUserId;
  }
  return false;
}
