import type { NormalizedEmail, PlatformUserId, UserId } from "@/modules/identity";
import type { TenantId } from "@/modules/tenant";
import type { Brand } from "@/shared";

export type AuthCredentialId = Brand<string, "AuthCredentialId">;
export type AuthSessionId = Brand<string, "AuthSessionId">;
export type PasswordResetTokenId = Brand<string, "PasswordResetTokenId">;
export type EmailVerificationTokenId = Brand<string, "EmailVerificationTokenId">;

export type AuthSubjectType = "user" | "platform_user";
export type AuthSessionStatus = "active" | "revoked" | "expired";

export interface RequestSecurityContext {
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
}

export interface CompanyAuthSubject {
  readonly type: "user";
  readonly companyId: TenantId;
  readonly userId: UserId;
  readonly email: NormalizedEmail;
  readonly name: string;
  readonly status: "invited" | "active" | "disabled";
}

export interface PlatformAuthSubject {
  readonly type: "platform_user";
  readonly platformUserId: PlatformUserId;
  readonly email: NormalizedEmail;
  readonly name: string;
  readonly status: "active" | "disabled";
}

export type AuthSubject = CompanyAuthSubject | PlatformAuthSubject;

export interface AuthCredentialRecord {
  readonly id: AuthCredentialId;
  readonly subject: AuthSubject;
  readonly passwordHash: string;
  readonly emailVerifiedAt: Date | null;
  readonly passwordUpdatedAt: Date;
}

export interface AuthSessionRecord {
  readonly id: AuthSessionId;
  readonly subject: AuthSubject;
  readonly status: AuthSessionStatus;
  readonly sessionTokenHash: string;
  readonly refreshTokenHash: string;
  readonly csrfTokenHash: string;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly lastSeenAt: Date;
  readonly expiresAt: Date;
  readonly refreshExpiresAt: Date;
  readonly revokedAt: Date | null;
  readonly createdAt: Date;
}

export interface IssuedAuthSession {
  readonly session: AuthSessionRecord;
  readonly sessionToken: string;
  readonly refreshToken: string;
  readonly csrfToken: string;
}

export interface AuthTokenRecord {
  readonly id: PasswordResetTokenId | EmailVerificationTokenId;
  readonly subject: AuthSubject;
  readonly tokenHash: string;
  readonly expiresAt: Date;
  readonly completedAt: Date | null;
  readonly createdAt: Date;
}

export interface CreateAuthSessionInput {
  readonly subject: AuthSubject;
  readonly sessionTokenHash: string;
  readonly refreshTokenHash: string;
  readonly csrfTokenHash: string;
  readonly security: RequestSecurityContext;
  readonly expiresAt: Date;
  readonly refreshExpiresAt: Date;
}

export interface AuthRepository {
  findCompanyCredential(input: {
    readonly companyId: TenantId;
    readonly email: NormalizedEmail;
  }): Promise<AuthCredentialRecord | null>;
  findPlatformCredential(email: NormalizedEmail): Promise<AuthCredentialRecord | null>;
  createCompanyCredential(input: {
    readonly companyId: TenantId;
    readonly userId: UserId;
    readonly passwordHash: string;
    readonly emailVerifiedAt: Date | null;
  }): Promise<AuthCredentialRecord>;
  createPlatformCredential(input: {
    readonly platformUserId: PlatformUserId;
    readonly passwordHash: string;
    readonly emailVerifiedAt: Date | null;
  }): Promise<AuthCredentialRecord>;
  updatePassword(input: {
    readonly subject: AuthSubject;
    readonly passwordHash: string;
  }): Promise<AuthCredentialRecord>;
  markEmailVerified(input: {
    readonly subject: AuthSubject;
    readonly verifiedAt: Date;
  }): Promise<AuthCredentialRecord>;
  recordLogin(input: { readonly subject: AuthSubject; readonly loggedInAt: Date }): Promise<void>;
  createSession(input: CreateAuthSessionInput): Promise<AuthSessionRecord>;
  findActiveSessionBySessionTokenHash(sessionTokenHash: string): Promise<AuthSessionRecord | null>;
  findActiveSessionByRefreshTokenHash(refreshTokenHash: string): Promise<AuthSessionRecord | null>;
  touchSession(input: {
    readonly sessionId: AuthSessionId;
    readonly lastSeenAt: Date;
  }): Promise<AuthSessionRecord>;
  revokeSession(input: {
    readonly sessionId: AuthSessionId;
    readonly revokedAt: Date;
    readonly status: AuthSessionStatus;
  }): Promise<AuthSessionRecord>;
  revokeSubjectSessions(input: {
    readonly subject: AuthSubject;
    readonly revokedAt: Date;
    readonly status: AuthSessionStatus;
  }): Promise<void>;
  createPasswordResetToken(input: {
    readonly subject: AuthSubject;
    readonly tokenHash: string;
    readonly expiresAt: Date;
  }): Promise<AuthTokenRecord>;
  findPasswordResetToken(tokenHash: string): Promise<AuthTokenRecord | null>;
  consumePasswordResetToken(input: {
    readonly tokenId: PasswordResetTokenId;
    readonly usedAt: Date;
  }): Promise<AuthTokenRecord>;
  createEmailVerificationToken(input: {
    readonly subject: AuthSubject;
    readonly tokenHash: string;
    readonly expiresAt: Date;
  }): Promise<AuthTokenRecord>;
  findEmailVerificationToken(tokenHash: string): Promise<AuthTokenRecord | null>;
  consumeEmailVerificationToken(input: {
    readonly tokenId: EmailVerificationTokenId;
    readonly verifiedAt: Date;
  }): Promise<AuthTokenRecord>;
}
