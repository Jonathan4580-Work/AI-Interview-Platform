import { prisma } from "@/infra/database";
import {
  createAvailabilityRequestToken,
  createAvailabilityRequestUrl,
} from "@/modules/availability/tokens";

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
      availabilityRequests: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { selectedSlot: true },
      },
    },
    orderBy: { appliedAt: "desc" },
    take: 100,
  });

  return {
    session,
    applications: applications.map((application) => {
      const availabilityRequest = application.availabilityRequests.at(0);
      return {
        id: application.id,
        jobTitle: application.job.title,
        jobSlug: application.job.slug,
        companyName: application.job.company.name,
        companySlug: application.job.company.slug,
        appliedAt: application.appliedAt,
        status: normalizeCandidateStatus(application.status),
        nextStep: candidateNextStep(application.status),
        availability:
          availabilityRequest === undefined
            ? null
            : {
                status: availabilityRequest.status,
                selectedSlotStartAt: availabilityRequest.selectedSlot?.startAt ?? null,
                selectedSlotEndAt: availabilityRequest.selectedSlot?.endAt ?? null,
                url:
                  availabilityRequest.status === "ACTIVE"
                    ? createAvailabilityRequestUrl(
                        createAvailabilityRequestToken({
                          requestId: availabilityRequest.id,
                          companyId: availabilityRequest.companyId,
                          applicationId: availabilityRequest.applicationId,
                          tokenSalt: availabilityRequest.tokenSalt,
                        }),
                      )
                    : null,
              },
      };
    }),
  };
}

function candidateNextStep(status: string): string {
  switch (status) {
    case "NEW":
      return "Your application has been submitted for HR review.";
    case "SHORTLISTED":
      return "The hiring team has shortlisted your application.";
    case "AVAILABILITY_REQUESTED":
      return "Choose an interview time to continue.";
    case "AVAILABILITY_CONFIRMED":
      return "Your availability is confirmed. The hiring team will send interview instructions next.";
    case "NOT_SELECTED":
    case "REJECTED":
      return "The hiring team has completed its review for this role.";
    default:
      return "The hiring team will share the next step when it is ready.";
  }
}
