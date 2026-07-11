import { cookies } from "next/headers";

import { prisma } from "@/infra/database";
import { hashPassword, verifyPassword } from "@/modules/auth/password";
import { createOpaqueToken, hashToken } from "@/modules/auth/tokens";
import { normalizeEmail } from "@/modules/identity";
import { secureCookieOptions } from "@/server/api/security";

const candidateAccountSessionCookie = "aptly_candidate_account_session";
const candidateAccountSessionDurationSeconds = 60 * 60 * 24 * 14;

export interface CandidateAccountSessionContext {
  readonly accountId: string;
  readonly companyId: string;
  readonly email: string;
  readonly normalizedEmail: string;
  readonly fullName: string;
  readonly phone: string | null;
}

export async function getCandidateAccountSession(): Promise<CandidateAccountSessionContext | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(candidateAccountSessionCookie)?.value;
  if (token === undefined) return null;

  const session = await prisma.candidateAccountSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { account: true },
  });

  if (
    session?.status !== "ACTIVE" ||
    session.revokedAt !== null ||
    session.expiresAt <= new Date() ||
    session.account.status !== "ACTIVE" ||
    session.account.deletedAt !== null
  ) {
    return null;
  }

  await prisma.candidateAccountSession.update({
    where: { id: session.id },
    data: { lastSeenAt: new Date() },
  });

  return {
    accountId: session.account.id,
    companyId: session.account.companyId,
    email: session.account.email,
    normalizedEmail: session.account.normalizedEmail,
    fullName: session.account.fullName,
    phone: session.account.phone,
  };
}

export async function registerCandidateAccount(input: {
  readonly companyId: string;
  readonly fullName: string;
  readonly email: string;
  readonly phone: string | null;
  readonly password: string;
}): Promise<void> {
  const normalizedEmail = normalizeEmail(input.email);
  const passwordHash = hashPassword(input.password);

  const existing = await prisma.candidateAccount.findUnique({
    where: {
      companyId_normalizedEmail: {
        companyId: input.companyId,
        normalizedEmail,
      },
    },
  });
  if (existing !== null) {
    throw new Error("A candidate account already exists for this email. Sign in instead.");
  }

  const account = await prisma.candidateAccount.create({
    data: {
      companyId: input.companyId,
      fullName: input.fullName,
      email: input.email,
      normalizedEmail,
      phone: input.phone,
      passwordHash,
      status: "ACTIVE",
    },
  });

  await issueCandidateAccountSession(account.id, account.companyId);
}

export async function authenticateCandidateAccount(input: {
  readonly companyId: string;
  readonly email: string;
  readonly password: string;
}): Promise<boolean> {
  const normalizedEmail = normalizeEmail(input.email);
  const account = await prisma.candidateAccount.findUnique({
    where: {
      companyId_normalizedEmail: {
        companyId: input.companyId,
        normalizedEmail,
      },
    },
  });

  if (
    account?.status !== "ACTIVE" ||
    account.deletedAt !== null ||
    !verifyPassword(input.password, account.passwordHash)
  ) {
    return false;
  }

  await issueCandidateAccountSession(account.id, account.companyId);
  return true;
}

export async function signOutCandidateAccount(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(candidateAccountSessionCookie)?.value;
  if (token !== undefined) {
    await prisma.candidateAccountSession.updateMany({
      where: { tokenHash: hashToken(token), status: "ACTIVE" },
      data: { status: "REVOKED", revokedAt: new Date() },
    });
  }
  cookieStore.set(candidateAccountSessionCookie, "", {
    ...secureCookieOptions(0),
    maxAge: 0,
  });
}

async function issueCandidateAccountSession(accountId: string, companyId: string): Promise<void> {
  const token = createOpaqueToken(32);
  const expiresAt = new Date(Date.now() + candidateAccountSessionDurationSeconds * 1000);

  await prisma.candidateAccountSession.create({
    data: {
      accountId,
      companyId,
      tokenHash: hashToken(token),
      expiresAt,
      status: "ACTIVE",
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(
    candidateAccountSessionCookie,
    token,
    secureCookieOptions(candidateAccountSessionDurationSeconds),
  );
}
