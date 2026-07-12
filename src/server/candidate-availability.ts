"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/infra/database";
import {
  parseAvailabilityRequestToken,
  verifyAvailabilityRequestToken,
} from "@/modules/availability/tokens";

export async function getCandidateAvailabilityRequest(token: string) {
  const parsed = parseAvailabilityRequestToken(token);
  if (parsed === null) return null;
  const request = await prisma.applicationAvailabilityRequest.findUnique({
    where: { id: parsed.requestId },
    include: {
      company: { select: { name: true, slug: true } },
      job: true,
      application: true,
      candidate: true,
      selectedSlot: true,
    },
  });
  if (request === null) return null;
  const ok = verifyAvailabilityRequestToken({
    token,
    expectedHash: request.tokenHash,
    request: {
      requestId: request.id,
      companyId: request.companyId,
      applicationId: request.applicationId,
      tokenSalt: request.tokenSalt,
    },
  });
  if (!ok) return null;

  const now = new Date();
  const slots = await prisma.interviewAvailabilitySlot.findMany({
    where: {
      companyId: request.companyId,
      jobId: request.jobId,
      status: "OPEN",
      startAt: { gt: now },
    },
    orderBy: { startAt: "asc" },
    take: 20,
  });

  return { request, slots };
}

export async function confirmCandidateAvailabilityAction(formData: FormData): Promise<void> {
  const token = value(formData, "requestToken");
  const slotId = value(formData, "slotId");
  const data = await getCandidateAvailabilityRequest(token);
  if (data === null) {
    redirect("/candidate/availability/unavailable");
  }
  const { request } = data;
  if (request.status !== "ACTIVE" || request.expiresAt <= new Date()) {
    redirect(`/candidate/availability/${encodeURIComponent(token)}?error=expired`);
  }
  if (slotId.length === 0) {
    redirect(`/candidate/availability/${encodeURIComponent(token)}?error=slot`);
  }

  await prisma.$transaction(async (tx) => {
    const slot = await tx.interviewAvailabilitySlot.findUnique({
      where: { companyId_id: { companyId: request.companyId, id: slotId } },
    });
    if (slot?.jobId !== request.jobId || slot.status !== "OPEN" || slot.startAt <= new Date()) {
      throw new Error("This availability slot is no longer available.");
    }
    await tx.interviewAvailabilitySlot.update({
      where: { companyId_id: { companyId: request.companyId, id: slot.id } },
      data: {
        status: "SELECTED",
        selectedApplicationId: request.applicationId,
        selectedAt: new Date(),
      },
    });
    await tx.applicationAvailabilityRequest.update({
      where: { companyId_id: { companyId: request.companyId, id: request.id } },
      data: {
        status: "CONFIRMED",
        confirmedAt: new Date(),
        selectedSlotId: slot.id,
      },
    });
    await tx.candidateApplication.update({
      where: { companyId_id: { companyId: request.companyId, id: request.applicationId } },
      data: { status: "AVAILABILITY_CONFIRMED" },
    });
  });

  revalidatePath("/candidate/applications");
  redirect(`/candidate/availability/${encodeURIComponent(token)}?confirmed=1`);
}

function value(formData: FormData, key: string): string {
  const input = formData.get(key);
  return typeof input === "string" ? input.trim() : "";
}
