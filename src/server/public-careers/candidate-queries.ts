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
        include: {
          transcripts: { select: { id: true, status: true }, take: 1 },
          evaluationVersions: { select: { id: true, status: true }, take: 1 },
          hrReports: { select: { id: true, status: true }, take: 1 },
        },
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
      const latestInterview = application.interviewSessions.at(0);
      const finalOutcome = readFinalOutcome(application.metadataJson, application.status);
      return {
        id: application.id,
        jobTitle: application.job.title,
        jobSlug: application.job.slug,
        companyName: application.job.company.name,
        companySlug: application.job.company.slug,
        appliedAt: application.appliedAt,
        rawStatus: application.status,
        status: normalizeCandidateStatus(application.status),
        nextStep: candidateNextStep(application.status),
        finalOutcome,
        interview:
          latestInterview === undefined
            ? null
            : {
                status: latestInterview.status,
                updatedAt: latestInterview.updatedAt,
                transcriptStatus: latestInterview.transcripts.at(0)?.status ?? null,
                evaluationStatus: latestInterview.evaluationVersions.at(0)?.status ?? null,
                reportStatus: latestInterview.hrReports.at(0)?.status ?? null,
              },
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

function readFinalOutcome(
  value: unknown,
  status: string,
): {
  readonly decision: "HIRED" | "REJECTED";
  readonly onboardingDate: string | null;
  readonly recordedAt: string | null;
} | null {
  if (status !== "HIRED" && status !== "REJECTED") {
    return null;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { decision: status, onboardingDate: null, recordedAt: null };
  }
  const metadata = value as Record<string, unknown>;
  const outcome = metadata.hrInterviewOutcome;
  if (typeof outcome !== "object" || outcome === null || Array.isArray(outcome)) {
    return { decision: status, onboardingDate: null, recordedAt: null };
  }
  const record = outcome as Record<string, unknown>;
  return {
    decision: status,
    onboardingDate:
      typeof record.onboardingDate === "string" && record.onboardingDate.length > 0
        ? record.onboardingDate
        : null,
    recordedAt: typeof record.recordedAt === "string" ? record.recordedAt : null,
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
    case "HIRED":
      return "Congratulations. The hiring team will contact you with next steps.";
    default:
      return "The hiring team will share the next step when it is ready.";
  }
}
