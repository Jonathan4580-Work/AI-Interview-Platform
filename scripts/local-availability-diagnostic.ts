import { prisma } from "../src/infra/database";
import {
  createAvailabilityRequestToken,
  createAvailabilityRequestUrl,
} from "../src/modules/availability/tokens";

async function main(): Promise<void> {
  const applicationId = process.argv.slice(2).join(" ").trim();
  if (applicationId.length === 0) {
    throw new Error("Usage: npm run local:availability-diagnostic -- <applicationId>");
  }

  const application = await prisma.candidateApplication.findFirst({
    where: { id: applicationId },
    include: {
      candidate: true,
      job: { include: { availabilitySlots: { orderBy: { startAt: "asc" } } } },
      decisionHistory: { orderBy: { createdAt: "desc" }, take: 5 },
      availabilityRequests: {
        orderBy: { createdAt: "desc" },
        include: { selectedSlot: true },
      },
      invitations: { orderBy: { createdAt: "desc" }, take: 3 },
    },
  });

  if (application === null) {
    console.log(JSON.stringify({ found: false, applicationId }, null, 2));
    return;
  }

  console.log(
    JSON.stringify(
      {
        found: true,
        applicationId: application.id,
        jobTitle: application.job.title,
        candidate: {
          name: application.candidate.fullName,
          email: application.candidate.primaryEmail,
        },
        status: application.status,
        latestDecision: application.decisionHistory[0]?.decision ?? null,
        availableSlots: application.job.availabilitySlots.map((slot) => ({
          id: slot.id,
          status: slot.status,
          startAt: slot.startAt,
          endAt: slot.endAt,
          selectedApplicationId: slot.selectedApplicationId,
        })),
        availabilityRequests: application.availabilityRequests.map((request) => ({
          id: request.id,
          status: request.status,
          expiresAt: request.expiresAt,
          selectedSlotId: request.selectedSlotId,
          selectedSlotStartAt: request.selectedSlot?.startAt ?? null,
          emailStatus: request.emailStatus,
          candidateUrl:
            request.status === "ACTIVE"
              ? createAvailabilityRequestUrl(
                  createAvailabilityRequestToken({
                    requestId: request.id,
                    companyId: request.companyId,
                    applicationId: request.applicationId,
                    tokenSalt: request.tokenSalt,
                  }),
                )
              : null,
        })),
        interviewInvitations: application.invitations.map((invitation) => ({
          id: invitation.id,
          status: invitation.status,
          expiresAt: invitation.expiresAt,
        })),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Availability diagnostic failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
