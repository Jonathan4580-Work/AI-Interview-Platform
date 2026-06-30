import { normalizeEmail } from "@/modules/identity";

import { hashPassword, verifyPassword } from "./password";
import { createOpaqueToken, hashToken } from "./tokens";

import type { PlatformUserId, UserId } from "@/modules/identity";
import type { TenantId } from "@/modules/tenant";
import type {
  AuthCredentialRecord,
  AuthRepository,
  AuthSessionRecord,
  AuthSubject,
  EmailVerificationTokenId,
  IssuedAuthSession,
  PasswordResetTokenId,
  RequestSecurityContext,
} from "./types";

const sessionDurationMs = 1000 * 60 * 60 * 8;
const refreshDurationMs = 1000 * 60 * 60 * 24 * 30;
const passwordResetDurationMs = 1000 * 60 * 30;
const emailVerificationDurationMs = 1000 * 60 * 60 * 24 * 7;

export class AuthenticationError extends Error {
  public constructor(message = "Authentication failed.") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class AuthService {
  public constructor(
    private readonly repository: AuthRepository,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  public async createCompanyCredential(input: {
    readonly companyId: TenantId;
    readonly userId: UserId;
    readonly password: string;
    readonly emailVerifiedAt?: Date | null;
  }): Promise<AuthCredentialRecord> {
    return this.repository.createCompanyCredential({
      companyId: input.companyId,
      userId: input.userId,
      passwordHash: hashPassword(input.password),
      emailVerifiedAt: input.emailVerifiedAt ?? null,
    });
  }

  public async createPlatformCredential(input: {
    readonly platformUserId: PlatformUserId;
    readonly password: string;
    readonly emailVerifiedAt?: Date | null;
  }): Promise<AuthCredentialRecord> {
    return this.repository.createPlatformCredential({
      platformUserId: input.platformUserId,
      passwordHash: hashPassword(input.password),
      emailVerifiedAt: input.emailVerifiedAt ?? null,
    });
  }

  public async authenticateCompanyUser(input: {
    readonly companyId: TenantId;
    readonly email: string;
    readonly password: string;
    readonly security: RequestSecurityContext;
  }): Promise<IssuedAuthSession> {
    const email = normalizeEmail(input.email);
    const credential = await this.repository.findCompanyCredential({
      companyId: input.companyId,
      email,
    });

    return this.authenticateCredential(credential, input.password, input.security);
  }

  public async authenticatePlatformUser(input: {
    readonly email: string;
    readonly password: string;
    readonly security: RequestSecurityContext;
  }): Promise<IssuedAuthSession> {
    const credential = await this.repository.findPlatformCredential(normalizeEmail(input.email));

    return this.authenticateCredential(credential, input.password, input.security);
  }

  public async verifySession(sessionToken: string): Promise<AuthSessionRecord> {
    const now = this.clock();
    const session = await this.repository.findActiveSessionBySessionTokenHash(
      hashToken(sessionToken),
    );
    if (session === null) {
      throw new AuthenticationError();
    }
    if (session.expiresAt <= now) {
      await this.repository.revokeSession({
        sessionId: session.id,
        revokedAt: now,
        status: "expired",
      });
      throw new AuthenticationError("Session has expired.");
    }

    return this.repository.touchSession({ sessionId: session.id, lastSeenAt: now });
  }

  public async refreshSession(input: {
    readonly refreshToken: string;
    readonly security: RequestSecurityContext;
  }): Promise<IssuedAuthSession> {
    const now = this.clock();
    const session = await this.repository.findActiveSessionByRefreshTokenHash(
      hashToken(input.refreshToken),
    );
    if (session === null) {
      throw new AuthenticationError();
    }
    if (session.refreshExpiresAt <= now) {
      await this.repository.revokeSession({
        sessionId: session.id,
        revokedAt: now,
        status: "expired",
      });
      throw new AuthenticationError("Refresh token has expired.");
    }

    await this.repository.revokeSession({
      sessionId: session.id,
      revokedAt: now,
      status: "revoked",
    });

    return this.issueSession(session.subject, input.security);
  }

  public async revokeSession(sessionToken: string): Promise<AuthSessionRecord> {
    const session = await this.repository.findActiveSessionBySessionTokenHash(
      hashToken(sessionToken),
    );
    if (session === null) {
      throw new AuthenticationError();
    }

    return this.repository.revokeSession({
      sessionId: session.id,
      revokedAt: this.clock(),
      status: "revoked",
    });
  }

  public async createCompanyPasswordReset(input: {
    readonly companyId: TenantId;
    readonly email: string;
  }): Promise<{ readonly token: string; readonly tokenId: PasswordResetTokenId } | null> {
    const credential = await this.repository.findCompanyCredential({
      companyId: input.companyId,
      email: normalizeEmail(input.email),
    });
    if (credential === null) {
      return null;
    }

    return this.createPasswordResetForSubject(credential.subject);
  }

  public async createPlatformPasswordReset(input: {
    readonly email: string;
  }): Promise<{ readonly token: string; readonly tokenId: PasswordResetTokenId } | null> {
    const credential = await this.repository.findPlatformCredential(normalizeEmail(input.email));
    if (credential === null) {
      return null;
    }

    return this.createPasswordResetForSubject(credential.subject);
  }

  public async resetPassword(input: {
    readonly token: string;
    readonly newPassword: string;
  }): Promise<AuthCredentialRecord> {
    const now = this.clock();
    const token = await this.repository.findPasswordResetToken(hashToken(input.token));
    if (token?.completedAt !== null || token.expiresAt <= now) {
      throw new AuthenticationError("Password reset token is invalid or expired.");
    }

    await this.repository.consumePasswordResetToken({
      tokenId: token.id as PasswordResetTokenId,
      usedAt: now,
    });

    const credential = await this.repository.updatePassword({
      subject: token.subject,
      passwordHash: hashPassword(input.newPassword),
    });
    await this.repository.revokeSubjectSessions({
      subject: token.subject,
      revokedAt: now,
      status: "revoked",
    });

    return credential;
  }

  public async createEmailVerification(input: {
    readonly subject: AuthSubject;
  }): Promise<{ readonly token: string; readonly tokenId: EmailVerificationTokenId }> {
    const token = createOpaqueToken();
    const record = await this.repository.createEmailVerificationToken({
      subject: input.subject,
      tokenHash: hashToken(token),
      expiresAt: new Date(this.clock().getTime() + emailVerificationDurationMs),
    });

    return { token, tokenId: record.id as EmailVerificationTokenId };
  }

  public async verifyEmail(tokenValue: string): Promise<AuthCredentialRecord> {
    const now = this.clock();
    const token = await this.repository.findEmailVerificationToken(hashToken(tokenValue));
    if (token?.completedAt !== null || token.expiresAt <= now) {
      throw new AuthenticationError("Email verification token is invalid or expired.");
    }

    await this.repository.consumeEmailVerificationToken({
      tokenId: token.id as EmailVerificationTokenId,
      verifiedAt: now,
    });

    return this.repository.markEmailVerified({
      subject: token.subject,
      verifiedAt: now,
    });
  }

  private async authenticateCredential(
    credential: AuthCredentialRecord | null,
    password: string,
    security: RequestSecurityContext,
  ): Promise<IssuedAuthSession> {
    if (credential === null || !isSubjectActive(credential.subject)) {
      throw new AuthenticationError();
    }
    if (!verifyPassword(password, credential.passwordHash)) {
      throw new AuthenticationError();
    }

    const issued = await this.issueSession(credential.subject, security);
    await this.repository.recordLogin({ subject: credential.subject, loggedInAt: this.clock() });

    return issued;
  }

  private async issueSession(
    subject: AuthSubject,
    security: RequestSecurityContext,
  ): Promise<IssuedAuthSession> {
    const now = this.clock();
    const sessionToken = createOpaqueToken();
    const refreshToken = createOpaqueToken();
    const csrfToken = createOpaqueToken();
    const session = await this.repository.createSession({
      subject,
      sessionTokenHash: hashToken(sessionToken),
      refreshTokenHash: hashToken(refreshToken),
      csrfTokenHash: hashToken(csrfToken),
      security,
      expiresAt: new Date(now.getTime() + sessionDurationMs),
      refreshExpiresAt: new Date(now.getTime() + refreshDurationMs),
    });

    return {
      session,
      sessionToken,
      refreshToken,
      csrfToken,
    };
  }

  private async createPasswordResetForSubject(
    subject: AuthSubject,
  ): Promise<{ readonly token: string; readonly tokenId: PasswordResetTokenId }> {
    const token = createOpaqueToken();
    const record = await this.repository.createPasswordResetToken({
      subject,
      tokenHash: hashToken(token),
      expiresAt: new Date(this.clock().getTime() + passwordResetDurationMs),
    });

    return { token, tokenId: record.id as PasswordResetTokenId };
  }
}

function isSubjectActive(subject: AuthSubject): boolean {
  return subject.status === "active";
}
