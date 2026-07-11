import { prisma } from "../src/infra/database";

async function main(): Promise<void> {
  const applicationId = process.argv.at(2)?.trim();
  if (applicationId === undefined || applicationId.length === 0) {
    throw new Error("Usage: npm.cmd run local:application-diagnostic -- <applicationId>");
  }

  const application = await prisma.candidateApplication.findFirst({
    where: { id: applicationId },
    include: {
      company: { select: { name: true, slug: true } },
      job: { select: { title: true, slug: true, status: true } },
      candidate: {
        select: {
          fullName: true,
          primaryEmail: true,
          phone: true,
          documents: {
            where: { status: "ACTIVE", deletedAt: null },
            select: { id: true, type: true, fileName: true, contentType: true, sizeBytes: true },
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
  });

  if (application === null) {
    console.log(`Application ${applicationId} was not found.`);
    return;
  }

  console.log(`Application: ${application.id}`);
  console.log(`Company: ${application.company.name} (${application.company.slug})`);
  console.log(`Job: ${application.job.title} (${application.job.status})`);
  console.log(`Candidate: ${application.candidate.fullName}`);
  console.log(`Email: ${application.candidate.primaryEmail ?? "missing"}`);
  console.log(`Phone: ${application.candidate.phone ?? "missing"}`);
  console.log(`Status: ${application.status}`);
  console.log(`Applied at: ${application.appliedAt.toISOString()}`);
  console.log(`CV documents: ${String(application.candidate.documents.length)}`);
  for (const document of application.candidate.documents) {
    console.log(
      `- ${document.id} ${document.type} ${document.fileName} ${document.contentType} ${String(
        document.sizeBytes,
      )} bytes`,
    );
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Application diagnostic failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
