import type { Prisma, PrismaClient } from "@prisma/client";
import type { NormalizedEmail, PlatformUserId, UserId } from "@/modules/identity";
import type { TenantId } from "@/modules/tenant";
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
} from "./types";

type PrismaClientLike = PrismaClient | Prisma.TransactionClient;

type CompanyCredentialPayload = Prisma.AuthCredentialGetPayload<{
  include: { user: true };
}>;

type PlatformCredentialPayload = Prisma.AuthCredentialGetPayload<{
  include: { platformUser: true };
}>;

type SessionPayload = Prisma.AuthSessionGetPayload<{
  include: { user: true; platformUser: true };
}>;

type PasswordResetPayload = Prisma.PasswordResetTokenGetPayload<{
  include: { user: true; platformUser: true };
}>;

type EmailVerificationPayload = Prisma.EmailVerificationTokenGetPayload<{
  include: { user: true; platformUser: true };
}>;

export class PrismaAuthStore implements AuthRepository {
  public constructor(private readonly prisma: PrismaClientLike) {}

  public async findCompanyCredential(input: {
    readonly companyId: TenantId;
    readonly email: NormalizedEmail;
  }): Promise<AuthCredentialRecord | null> {
    const credential = await this.prisma.authCredential.findFirst({
      where: {
        subjectType: "USER",
        companyId: input.companyId,
        user: {
          email: input.email,
          deletedAt: null,
        },
      },
      include: { user: true },
    });

    return credential === null ? null : mapCompanyCredential(credential);
  }

  public async findPlatformCredential(
    email: NormalizedEmail,
  ): Promise<AuthCredentialRecord | null> {
    const credential = await this.prisma.authCredential.findFirst({
      where: {
        subjectType: "PLATFORM_USER",
        platformUser: { email },
      },
      include: { platformUser: true },
    });

    return credential === null ? null : mapPlatformCredential(credential);
  }

  public async createCompanyCredential(input: {
    readonly companyId: TenantId;
    readonly userId: UserId;
    readonly passwordHash: string;
    readonly emailVerifiedAt: Date | null;
  }): Promise<AuthCredentialRecord> {
    const credential = await this.prisma.authCredential.create({
      data: {
        subjectType: "USER",
        companyId: input.companyId,
        userId: input.userId,
        passwordHash: input.passwordHash,
        emailVerifiedAt: input.emailVerifiedAt,
      },
      include: { user: true },
    });

    return mapCompanyCredential(credential);
  }

  public async createPlatformCredential(input: {
    readonly platformUserId: PlatformUserId;
    readonly passwordHash: string;
    readonly emailVerifiedAt: Date | null;
  }): Promise<AuthCredentialRecord> {
    const credential = await this.prisma.authCredential.create({
      data: {
        subjectType: "PLATFORM_USER",
        platformUserId: input.platformUserId,
        passwordHash: input.passwordHash,
        emailVerifiedAt: input.emailVerifiedAt,
      },
      include: { platformUser: true },
    });

    return mapPlatformCredential(credential);
  }

  public async updatePassword(input: {
    readonly subject: AuthSubject;
    readonly passwordHash: string;
  }): Promise<AuthCredentialRecord> {
    if (input.subject.type === "user") {
      const credential = await this.prisma.authCredential.update({
        where: {
          companyId_userId: {
            companyId: input.subject.companyId,
            userId: input.subject.userId,
          },
        },
        data: {
          passwordHash: input.passwordHash,
          passwordUpdatedAt: new Date(),
        },
        include: { user: true },
      });
      return mapCompanyCredential(credential);
    }

    const credential = await this.prisma.authCredential.update({
      where: { platformUserId: input.subject.platformUserId },
      data: {
        passwordHash: input.passwordHash,
        passwordUpdatedAt: new Date(),
      },
      include: { platformUser: true },
    });
    return mapPlatformCredential(credential);
  }

  public async markEmailVerified(input: {
    readonly subject: AuthSubject;
    readonly verifiedAt: Date;
  }): Promise<AuthCredentialRecord> {
    if (input.subject.type === "user") {
      const credential = await this.prisma.authCredential.update({
        where: {
          companyId_userId: {
            companyId: input.subject.companyId,
            userId: input.subject.userId,
          },
        },
        data: { emailVerifiedAt: input.verifiedAt },
        include: { user: true },
      });
      return mapCompanyCredential(credential);
    }

    const credential = await this.prisma.authCredential.update({
      where: { platformUserId: input.subject.platformUserId },
      data: { emailVerifiedAt: input.verifiedAt },
      include: { platformUser: true },
    });
    return mapPlatformCredential(credential);
  }

  public async recordLogin(input: {
    readonly subject: AuthSubject;
    readonly loggedInAt: Date;
  }): Promise<void> {
    if (input.subject.type === "user") {
      await this.prisma.user.update({
        where: {
          companyId_id: {
            companyId: input.subject.companyId,
            id: input.subject.userId,
          },
        },
        data: { lastLoginAt: input.loggedInAt },
      });
    }
  }

  public async createSession(input: CreateAuthSessionInput): Promise<AuthSessionRecord> {
    const data =
      input.subject.type === "user"
        ? {
            subjectType: "USER" as const,
            companyId: input.subject.companyId,
            userId: input.subject.userId,
            platformUserId: null,
          }
        : {
            subjectType: "PLATFORM_USER" as const,
            companyId: null,
            userId: null,
            platformUserId: input.subject.platformUserId,
          };

    const session = await this.prisma.authSession.create({
      data: {
        ...data,
        sessionTokenHash: input.sessionTokenHash,
        refreshTokenHash: input.refreshTokenHash,
        csrfTokenHash: input.csrfTokenHash,
        ipAddress: input.security.ipAddress,
        userAgent: input.security.userAgent,
        expiresAt: input.expiresAt,
        refreshExpiresAt: input.refreshExpiresAt,
      },
      include: { user: true, platformUser: true },
    });

    return mapSession(session);
  }

  public async findActiveSessionBySessionTokenHash(
    sessionTokenHash: string,
  ): Promise<AuthSessionRecord | null> {
    const session = await this.prisma.authSession.findUnique({
      where: { sessionTokenHash },
      include: { user: true, platformUser: true },
    });

    return session?.status === "ACTIVE" ? mapSession(session) : null;
  }

  public async findActiveSessionByRefreshTokenHash(
    refreshTokenHash: string,
  ): Promise<AuthSessionRecord | null> {
    const session = await this.prisma.authSession.findUnique({
      where: { refreshTokenHash },
      include: { user: true, platformUser: true },
    });

    return session?.status === "ACTIVE" ? mapSession(session) : null;
  }

  public async touchSession(input: {
    readonly sessionId: AuthSessionId;
    readonly lastSeenAt: Date;
  }): Promise<AuthSessionRecord> {
    const session = await this.prisma.authSession.update({
      where: { id: input.sessionId },
      data: { lastSeenAt: input.lastSeenAt },
      include: { user: true, platformUser: true },
    });

    return mapSession(session);
  }

  public async revokeSession(input: {
    readonly sessionId: AuthSessionId;
    readonly revokedAt: Date;
    readonly status: AuthSessionStatus;
  }): Promise<AuthSessionRecord> {
    const session = await this.prisma.authSession.update({
      where: { id: input.sessionId },
      data: {
        status: mapSessionStatusToPrisma(input.status),
        revokedAt: input.revokedAt,
      },
      include: { user: true, platformUser: true },
    });

    return mapSession(session);
  }

  public async revokeSubjectSessions(input: {
    readonly subject: AuthSubject;
    readonly revokedAt: Date;
    readonly status: AuthSessionStatus;
  }): Promise<void> {
    await this.prisma.authSession.updateMany({
      where:
        input.subject.type === "user"
          ? {
              subjectType: "USER",
              companyId: input.subject.companyId,
              userId: input.subject.userId,
              status: "ACTIVE",
            }
          : {
              subjectType: "PLATFORM_USER",
              platformUserId: input.subject.platformUserId,
              status: "ACTIVE",
            },
      data: {
        status: mapSessionStatusToPrisma(input.status),
        revokedAt: input.revokedAt,
      },
    });
  }

  public async createPasswordResetToken(input: {
    readonly subject: AuthSubject;
    readonly tokenHash: string;
    readonly expiresAt: Date;
  }): Promise<AuthTokenRecord> {
    const data = tokenSubjectData(input.subject);
    const record = await this.prisma.passwordResetToken.create({
      data: {
        ...data,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
      },
      include: { user: true, platformUser: true },
    });

    return mapPasswordResetToken(record);
  }

  public async findPasswordResetToken(tokenHash: string): Promise<AuthTokenRecord | null> {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true, platformUser: true },
    });

    return record === null ? null : mapPasswordResetToken(record);
  }

  public async consumePasswordResetToken(input: {
    readonly tokenId: PasswordResetTokenId;
    readonly usedAt: Date;
  }): Promise<AuthTokenRecord> {
    const record = await this.prisma.passwordResetToken.update({
      where: { id: input.tokenId },
      data: { usedAt: input.usedAt },
      include: { user: true, platformUser: true },
    });

    return mapPasswordResetToken(record);
  }

  public async createEmailVerificationToken(input: {
    readonly subject: AuthSubject;
    readonly tokenHash: string;
    readonly expiresAt: Date;
  }): Promise<AuthTokenRecord> {
    const data = tokenSubjectData(input.subject);
    const record = await this.prisma.emailVerificationToken.create({
      data: {
        ...data,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
      },
      include: { user: true, platformUser: true },
    });

    return mapEmailVerificationToken(record);
  }

  public async findEmailVerificationToken(tokenHash: string): Promise<AuthTokenRecord | null> {
    const record = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
      include: { user: true, platformUser: true },
    });

    return record === null ? null : mapEmailVerificationToken(record);
  }

  public async consumeEmailVerificationToken(input: {
    readonly tokenId: EmailVerificationTokenId;
    readonly verifiedAt: Date;
  }): Promise<AuthTokenRecord> {
    const record = await this.prisma.emailVerificationToken.update({
      where: { id: input.tokenId },
      data: { verifiedAt: input.verifiedAt },
      include: { user: true, platformUser: true },
    });

    return mapEmailVerificationToken(record);
  }
}

function tokenSubjectData(subject: AuthSubject): {
  readonly subjectType: "USER" | "PLATFORM_USER";
  readonly companyId: string | null;
  readonly userId: string | null;
  readonly platformUserId: string | null;
} {
  if (subject.type === "user") {
    return {
      subjectType: "USER",
      companyId: subject.companyId,
      userId: subject.userId,
      platformUserId: null,
    };
  }

  return {
    subjectType: "PLATFORM_USER",
    companyId: null,
    userId: null,
    platformUserId: subject.platformUserId,
  };
}

function mapCompanyCredential(record: CompanyCredentialPayload): AuthCredentialRecord {
  if (record.user === null) {
    throw new Error("Company credential is missing user relation.");
  }

  return {
    id: record.id as AuthCredentialId,
    subject: {
      type: "user",
      companyId: record.companyId as TenantId,
      userId: record.userId as UserId,
      email: record.user.email as NormalizedEmail,
      name: record.user.name,
      status: record.user.status.toLowerCase() as "invited" | "active" | "disabled",
    },
    passwordHash: record.passwordHash,
    emailVerifiedAt: record.emailVerifiedAt,
    passwordUpdatedAt: record.passwordUpdatedAt,
  };
}

function mapPlatformCredential(record: PlatformCredentialPayload): AuthCredentialRecord {
  if (record.platformUser === null) {
    throw new Error("Platform credential is missing platform user relation.");
  }

  return {
    id: record.id as AuthCredentialId,
    subject: {
      type: "platform_user",
      platformUserId: record.platformUserId as PlatformUserId,
      email: record.platformUser.email as NormalizedEmail,
      name: record.platformUser.name,
      status: record.platformUser.status.toLowerCase() as "active" | "disabled",
    },
    passwordHash: record.passwordHash,
    emailVerifiedAt: record.emailVerifiedAt,
    passwordUpdatedAt: record.passwordUpdatedAt,
  };
}

function mapSession(record: SessionPayload): AuthSessionRecord {
  return {
    id: record.id as AuthSessionId,
    subject: mapSessionSubject(record),
    status: record.status.toLowerCase() as AuthSessionStatus,
    sessionTokenHash: record.sessionTokenHash,
    refreshTokenHash: record.refreshTokenHash,
    csrfTokenHash: record.csrfTokenHash,
    ipAddress: record.ipAddress,
    userAgent: record.userAgent,
    lastSeenAt: record.lastSeenAt,
    expiresAt: record.expiresAt,
    refreshExpiresAt: record.refreshExpiresAt,
    revokedAt: record.revokedAt,
    createdAt: record.createdAt,
  };
}

function mapPasswordResetToken(record: PasswordResetPayload): AuthTokenRecord {
  return {
    id: record.id as PasswordResetTokenId,
    subject: mapTokenSubject(record),
    tokenHash: record.tokenHash,
    expiresAt: record.expiresAt,
    completedAt: record.usedAt,
    createdAt: record.createdAt,
  };
}

function mapEmailVerificationToken(record: EmailVerificationPayload): AuthTokenRecord {
  return {
    id: record.id as EmailVerificationTokenId,
    subject: mapTokenSubject(record),
    tokenHash: record.tokenHash,
    expiresAt: record.expiresAt,
    completedAt: record.verifiedAt,
    createdAt: record.createdAt,
  };
}

function mapTokenSubject(record: PasswordResetPayload | EmailVerificationPayload): AuthSubject {
  if (record.subjectType === "USER") {
    if (record.user === null || record.companyId === null || record.userId === null) {
      throw new Error("User token is missing required subject relation.");
    }
    return {
      type: "user",
      companyId: record.companyId as TenantId,
      userId: record.userId as UserId,
      email: record.user.email as NormalizedEmail,
      name: record.user.name,
      status: record.user.status.toLowerCase() as "invited" | "active" | "disabled",
    };
  }

  if (record.platformUser === null || record.platformUserId === null) {
    throw new Error("Platform token is missing required subject relation.");
  }

  return {
    type: "platform_user",
    platformUserId: record.platformUserId as PlatformUserId,
    email: record.platformUser.email as NormalizedEmail,
    name: record.platformUser.name,
    status: record.platformUser.status.toLowerCase() as "active" | "disabled",
  };
}

function mapSessionSubject(record: SessionPayload): AuthSubject {
  if (record.subjectType === "USER") {
    if (record.user === null || record.companyId === null || record.userId === null) {
      throw new Error("User session is missing required subject relation.");
    }
    return {
      type: "user",
      companyId: record.companyId as TenantId,
      userId: record.userId as UserId,
      email: record.user.email as NormalizedEmail,
      name: record.user.name,
      status: record.user.status.toLowerCase() as "invited" | "active" | "disabled",
    };
  }

  if (record.platformUser === null || record.platformUserId === null) {
    throw new Error("Platform session is missing required subject relation.");
  }

  return {
    type: "platform_user",
    platformUserId: record.platformUserId as PlatformUserId,
    email: record.platformUser.email as NormalizedEmail,
    name: record.platformUser.name,
    status: record.platformUser.status.toLowerCase() as "active" | "disabled",
  };
}

function mapSessionStatusToPrisma(status: AuthSessionStatus): "ACTIVE" | "REVOKED" | "EXPIRED" {
  switch (status) {
    case "active":
      return "ACTIVE";
    case "revoked":
      return "REVOKED";
    case "expired":
      return "EXPIRED";
  }
}
