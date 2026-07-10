import { env } from "@/config";
import { prisma } from "@/infra/database";

const jobId = process.argv[2];

if (env.APP_ENV !== "development") {
  throw new Error("local:jd-diagnostic may only run with APP_ENV=development.");
}
if (typeof jobId !== "string" || jobId.length === 0) {
  throw new Error("Usage: npm.cmd run local:jd-diagnostic -- <jobId>");
}

const job = await prisma.job.findFirst({
  where: { id: jobId },
  include: {
    company: { select: { id: true, name: true, slug: true } },
    descriptionAssets: { orderBy: { createdAt: "desc" }, take: 1 },
    intelligenceProfile: true,
    interviewQuestions: { orderBy: { sequence: "asc" } },
  },
});

if (job === null) {
  console.log(JSON.stringify({ found: false, jobId }, null, 2));
  await prisma.$disconnect();
  process.exit(0);
}

const workflows = await prisma.processingWorkflow.findMany({
  where: { companyId: job.companyId, subjectType: "job", subjectId: job.id },
  include: { steps: { orderBy: { sequence: "asc" } } },
  orderBy: { createdAt: "desc" },
  take: 5,
});

const asset = job.descriptionAssets.length > 0 ? job.descriptionAssets[0] : null;
console.log(
  JSON.stringify(
    {
      found: true,
      company: job.company,
      job: {
        id: job.id,
        title: job.title,
        status: job.status,
        updatedAt: job.updatedAt,
      },
      source: asset
        ? {
            sourceType: asset.sourceType,
            status: asset.status,
            fileName: asset.fileName,
            textLength: asset.extractedText.length,
            preview: asset.extractedText.slice(0, 500),
          }
        : null,
      profile: job.intelligenceProfile
        ? {
            status: job.intelligenceProfile.status,
            title: job.intelligenceProfile.title,
            analyzedAt: job.intelligenceProfile.analyzedAt,
            editedAt: job.intelligenceProfile.editedAt,
            publishedAt: job.intelligenceProfile.publishedAt,
            failureMessage: job.intelligenceProfile.failureMessage,
          }
        : null,
      questionCount: job.interviewQuestions.length,
      questions: job.interviewQuestions.map((question) => ({
        sequence: question.sequence,
        competencyName: question.competencyName,
        questionType: question.questionType,
        difficulty: question.difficulty,
        questionText: question.questionText,
      })),
      workflows: workflows.map((workflow) => ({
        id: workflow.id,
        status: workflow.status,
        currentStepKey: workflow.currentStepKey,
        failureCode: workflow.failureCode,
        failureMessage: workflow.failureMessage,
        steps: workflow.steps.map((step) => ({
          stepKey: step.stepKey,
          status: step.status,
          attemptCount: step.attemptCount,
          failureCode: step.failureCode,
          failureMessage: step.failureMessage,
        })),
      })),
    },
    null,
    2,
  ),
);

await prisma.$disconnect();
