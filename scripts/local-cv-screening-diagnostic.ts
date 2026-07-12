import { env } from "../src/config";
import { prisma } from "../src/infra/database";

async function main(): Promise<void> {
  const applicationId = process.argv.at(2)?.trim();
  if (applicationId === undefined || applicationId.length === 0) {
    throw new Error("Usage: npm.cmd run local:cv-screening-diagnostic -- <applicationId>");
  }

  const application = await prisma.candidateApplication.findFirst({
    where: { id: applicationId },
    include: {
      job: { include: { intelligenceProfile: true } },
      candidate: {
        include: {
          documents: {
            where: { type: "RESUME", status: "ACTIVE", deletedAt: null },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
      cvScreenings: { orderBy: { updatedAt: "desc" }, take: 1 },
    },
  });

  if (application === null) {
    console.log(`Application not found: ${applicationId}`);
    return;
  }

  const document = application.candidate.documents.at(0) ?? null;
  const screening = application.cvScreenings.at(0) ?? null;
  const extractedText = screening?.extractedText ?? "";
  const matchScore = screening?.matchScore;
  const recommendation = screening?.recommendation;
  const failureCode = screening?.failureCode;
  const failureMessageSafe = screening?.failureMessageSafe;

  console.log(`Application ID: ${application.id}`);
  console.log(`Job ID: ${application.jobId}`);
  console.log(`Candidate account ID: ${application.candidateAccountId ?? "none"}`);
  console.log(`CV document exists: ${String(document !== null)}`);
  console.log(`CV filename: ${document?.fileName ?? "none"}`);
  console.log(`CV MIME type: ${document?.contentType ?? "none"}`);
  console.log(`JD intelligence exists: ${String(application.job.intelligenceProfile !== null)}`);
  console.log(`Model: ${env.OPENAI_MODEL}`);
  console.log(`PDF extraction method used: ${screening?.extractionMethod ?? "not_ready"}`);
  console.log(
    `Raw extracted length: ${
      screening?.extractionRawLength === null || screening?.extractionRawLength === undefined
        ? "not_ready"
        : String(screening.extractionRawLength)
    }`,
  );
  console.log(
    `Cleaned extracted length: ${
      screening?.extractionCleanedLength === null ||
      screening?.extractionCleanedLength === undefined
        ? "not_ready"
        : String(screening.extractionCleanedLength)
    }`,
  );
  console.log(`Extracted text length: ${String(extractedText.length)}`);
  console.log(
    `Extraction quality score: ${
      screening?.extractionQualityScore === null || screening?.extractionQualityScore === undefined
        ? "not_ready"
        : String(screening.extractionQualityScore)
    }`,
  );
  console.log(`Metadata removed: ${String(screening?.extractionMetadataRemoved ?? false)}`);
  console.log(
    `Screening status: ${screening === null ? "not_started" : screening.screeningStatus}`,
  );
  console.log(
    `Extraction status: ${screening === null ? "not_started" : screening.extractionStatus}`,
  );
  console.log(
    `Match score: ${matchScore === null || matchScore === undefined ? "not_ready" : String(matchScore)}`,
  );
  console.log(`Recommendation: ${recommendation ?? "not_ready"}`);
  console.log(`Failure code: ${failureCode ?? "none"}`);
  console.log(`Safe OpenAI error: ${failureMessageSafe ?? "none"}`);
  console.log(`Extracted CV text preview: ${preview(extractedText)}`);
}

function preview(value: string): string {
  const trimmed = value.replace(/\s+/gu, " ").trim();
  return trimmed.length === 0 ? "empty" : trimmed.slice(0, 500);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "CV screening diagnostic failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
