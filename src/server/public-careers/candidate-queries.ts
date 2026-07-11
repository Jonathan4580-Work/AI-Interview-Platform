import { prisma } from "@/infra/database";

import { getCandidateAccountSession } from "./candidate-auth";
import { normalizeCandidateStatus } from "./candidate-application";

export async function listCandidateApplications() {
  const session = await getCandidateAccountSession();
  if (session === null) return null;

  const applications = await prisma.candidateApplication.findMany({
    where: {
      companyId: session.companyId,
      candidateAccountId: session.accountId,
      deletedAt: null,
    },
    include: {
      job: {
        include: {
          company: { select: { name: true, slug: true } },
        },
      },
      candidate: { select: { fullName: true, primaryEmail: true, phone: true } },
      interviewSessions: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        include: { hrReports: { select: { id: true, status: true }, take: 1 } },
      },
    },
    orderBy: { appliedAt: "desc" },
    take: 100,
  });

  return {
    session,
    applications: applications.map((application) => ({
      id: application.id,
      jobTitle: application.job.title,
      jobSlug: application.job.slug,
      companyName: application.job.company.name,
      companySlug: application.job.company.slug,
      appliedAt: application.appliedAt,
      status: normalizeCandidateStatus(application.status),
      nextStep:
        application.status === "NEW"
          ? "Your application has been submitted for HR review."
          : "The hiring team will share the next step when it is ready.",
    })),
  };
}
