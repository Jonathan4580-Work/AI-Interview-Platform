import { createHash, randomUUID } from "node:crypto";
import { extname } from "node:path";

export const acceptedCvMimeTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export const acceptedCvExtensions = new Set([".pdf", ".docx"]);

export function normalizeCandidateStatus(status: string): string {
  switch (status) {
    case "NEW":
      return "Submitted";
    case "IN_REVIEW":
      return "Under HR Review";
    case "SHORTLISTED":
      return "Shortlisted";
    case "AVAILABILITY_REQUESTED":
      return "Availability Requested";
    case "AVAILABILITY_CONFIRMED":
      return "Availability Confirmed";
    case "INTERVIEW_INVITED":
    case "INTERVIEW":
      return "Interview Invited";
    case "INTERVIEW_COMPLETED":
      return "Interview Completed";
    case "HIRED":
      return "Hired";
    case "NOT_SELECTED":
    case "REJECTED":
      return "Not Selected";
    default:
      return status
        .toLowerCase()
        .split("_")
        .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
        .join(" ");
  }
}

export function validateCvFile(input: {
  readonly fileName: string;
  readonly contentType: string;
  readonly sizeBytes: number;
}): { readonly ok: true } | { readonly ok: false; readonly message: string } {
  const extension = extname(input.fileName).toLowerCase();
  if (!acceptedCvExtensions.has(extension) || !acceptedCvMimeTypes.has(input.contentType)) {
    return { ok: false, message: "Upload a PDF or DOCX CV." };
  }
  if (input.sizeBytes <= 0) {
    return { ok: false, message: "Upload a non-empty CV file." };
  }
  if (input.sizeBytes > 10 * 1024 * 1024) {
    return { ok: false, message: "CV files must be 10 MB or smaller." };
  }
  return { ok: true };
}

export function createCandidateCvStorageKey(input: {
  readonly companyId: string;
  readonly candidateId: string;
  readonly fileName: string;
}): string {
  const extension = extname(input.fileName).toLowerCase();
  return `candidate-documents/${input.companyId}/${input.candidateId}/${randomUUID()}${extension}`;
}

export function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
