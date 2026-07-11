"use server";

import { redirect } from "next/navigation";

import { prisma } from "@/infra/database";
import { PasswordPolicyError } from "@/modules/auth/password";
import { normalizeEmail } from "@/modules/identity";
import { LocalFilesystemStorageProvider } from "@/modules/media/local-storage-provider";

import {
  authenticateCandidateAccount,
  getCandidateAccountSession,
  registerCandidateAccount,
  signOutCandidateAccount,
} from "./candidate-auth";
import { createCandidateCvStorageKey, sha256, validateCvFile } from "./candidate-application";
import { getPublicCareerJobDetail } from "./queries";

function value(formData: FormData, key: string): string {
  const input = formData.get(key);
  return typeof input === "string" ? input.trim() : "";
}

function returnTo(formData: FormData): string {
  const next = value(formData, "returnTo");
  return next.startsWith("/") ? next : "/candidate/applications";
}

function redirectWithError(path: string, key: "authError" | "applyError", message: string): never {
  const separator = path.includes("?") ? "&" : "?";
  redirect(`${path}${separator}${key}=${encodeURIComponent(message)}`);
}

export async function registerCandidateAccountAction(formData: FormData): Promise<void> {
  const path = returnTo(formData);
  const companyId = value(formData, "companyId");
  const fullName = value(formData, "fullName");
  const email = value(formData, "email");
  const phone = value(formData, "phone");
  const password = value(formData, "password");
  const confirmPassword = value(formData, "confirmPassword");

  if (fullName.length < 2) redirectWithError(path, "authError", "Enter your full name.");
  if (email.length === 0) redirectWithError(path, "authError", "Enter your email address.");
  if (password !== confirmPassword) {
    redirectWithError(path, "authError", "Passwords do not match.");
  }

  try {
    await registerCandidateAccount({
      companyId,
      fullName,
      email,
      phone: phone.length === 0 ? null : phone,
      password,
    });
  } catch (error) {
    const message =
      error instanceof PasswordPolicyError || error instanceof Error
        ? error.message
        : "Registration failed.";
    redirectWithError(path, "authError", message);
  }

  redirect(path);
}

export async function loginCandidateAccountAction(formData: FormData): Promise<void> {
  const path = returnTo(formData);
  const companyId = value(formData, "companyId");
  const ok = await authenticateCandidateAccount({
    companyId,
    email: value(formData, "email"),
    password: value(formData, "password"),
  });

  if (!ok) redirectWithError(path, "authError", "Email or password is incorrect.");
  redirect(path);
}

export async function signOutCandidateAccountAction(): Promise<void> {
  await signOutCandidateAccount();
  redirect("/candidate/applications");
}

export async function submitPublicApplicationAction(formData: FormData): Promise<void> {
  const companySlug = value(formData, "companySlug");
  const jobSlug = value(formData, "jobSlug");
  const path = `/careers/${companySlug}/jobs/${jobSlug}/apply`;
  const session = await getCandidateAccountSession();
  const job = await getPublicCareerJobDetail(companySlug, jobSlug);

  if (job === null) redirectWithError(path, "applyError", "This job is no longer available.");
  if (session?.companyId !== job.company.id) {
    redirectWithError(path, "applyError", "Sign in as a candidate to apply.");
  }

  const fullName = value(formData, "fullName");
  const email = value(formData, "email");
  const phone = value(formData, "phone");
  const coverNote = value(formData, "coverNote");
  const consent = formData.get("consent");
  const cv = formData.get("cv");

  if (fullName.length < 2) redirectWithError(path, "applyError", "Enter your full name.");
  if (email.length === 0) redirectWithError(path, "applyError", "Enter your email address.");
  if (consent !== "on") redirectWithError(path, "applyError", "Consent is required to apply.");
  if (!(cv instanceof File)) redirectWithError(path, "applyError", "Upload your CV.");

  const bytes = new Uint8Array(await cv.arrayBuffer());
  const validation = validateCvFile({
    fileName: cv.name,
    contentType: cv.type,
    sizeBytes: bytes.byteLength,
  });
  if (!validation.ok) redirectWithError(path, "applyError", validation.message);

  const normalizedEmail = normalizeEmail(email);
  const result = await prisma.$transaction(async (tx) => {
    const candidate = await tx.candidate.upsert({
      where: {
        companyId_normalizedEmail: {
          companyId: job.company.id,
          normalizedEmail,
        },
      },
      create: {
        companyId: job.company.id,
        fullName,
        primaryEmail: email,
        normalizedEmail,
        phone: phone.length === 0 ? null : phone,
        sourceType: "APPLICATION",
        sourceLabel: "Public careers",
        status: "ACTIVE",
        profileJson: {
          source: "public_careers",
          candidateAccountId: session.accountId,
        },
      },
      update: {
        fullName,
        primaryEmail: email,
        phone: phone.length === 0 ? null : phone,
        deletedAt: null,
      },
    });

    const existingApplication = await tx.candidateApplication.findUnique({
      where: {
        companyId_candidateId_jobId: {
          companyId: job.company.id,
          candidateId: candidate.id,
          jobId: job.id,
        },
      },
    });

    if (existingApplication !== null && existingApplication.deletedAt === null) {
      await tx.candidateApplication.update({
        where: { companyId_id: { companyId: job.company.id, id: existingApplication.id } },
        data: { candidateAccountId: session.accountId },
      });
      return { candidateId: candidate.id, applicationId: existingApplication.id, duplicate: true };
    }

    if (existingApplication !== null) {
      const restored = await tx.candidateApplication.update({
        where: { companyId_id: { companyId: job.company.id, id: existingApplication.id } },
        data: {
          candidateAccountId: session.accountId,
          status: "NEW",
          appliedAt: new Date(),
          rejectedAt: null,
          hiredAt: null,
          deletedAt: null,
          metadataJson: {
            source: "public_careers",
            consentAcceptedAt: new Date().toISOString(),
            coverNote: coverNote.length === 0 ? null : coverNote,
            screeningStatus: "not_started",
          },
        },
      });
      return { candidateId: candidate.id, applicationId: restored.id, duplicate: false };
    }

    const application = await tx.candidateApplication.create({
      data: {
        companyId: job.company.id,
        candidateAccountId: session.accountId,
        candidateId: candidate.id,
        jobId: job.id,
        status: "NEW",
        metadataJson: {
          source: "public_careers",
          consentAcceptedAt: new Date().toISOString(),
          coverNote: coverNote.length === 0 ? null : coverNote,
          screeningStatus: "not_started",
        },
      },
    });

    return { candidateId: candidate.id, applicationId: application.id, duplicate: false };
  });

  if (result.duplicate) {
    redirectWithError(
      "/candidate/applications",
      "applyError",
      "You already have an active application for this role.",
    );
  }

  const storageKey = createCandidateCvStorageKey({
    companyId: job.company.id,
    candidateId: result.candidateId,
    fileName: cv.name,
  });
  const checksumSha256 = sha256(bytes);
  await new LocalFilesystemStorageProvider().writeObject(storageKey, bytes);

  await prisma.candidateDocument.create({
    data: {
      companyId: job.company.id,
      candidateId: result.candidateId,
      type: "RESUME",
      status: "ACTIVE",
      fileName: cv.name,
      contentType: cv.type,
      storageKey,
      sizeBytes: bytes.byteLength,
      checksumSha256,
    },
  });

  await prisma.candidateApplication.update({
    where: { companyId_id: { companyId: job.company.id, id: result.applicationId } },
    data: {
      metadataJson: {
        source: "public_careers",
        consentAcceptedAt: new Date().toISOString(),
        coverNote: coverNote.length === 0 ? null : coverNote,
        screeningStatus: "not_started",
        cvUploaded: true,
      },
    },
  });

  redirect("/candidate/applications?submitted=1");
}
