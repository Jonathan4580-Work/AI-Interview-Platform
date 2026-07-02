import { prisma } from "@/infra/database";
import { getDefaultEmailTemplate } from "@/modules/email/default-templates";
import { renderEmailTemplate } from "@/modules/email/template-renderer";
import { forbidden, notFound } from "@/server/api";

import type {
  EmailDelivery,
  EmailProvider,
  EmailDeliveryStatus,
  CandidateInvitation,
} from "@prisma/client";

const ACTIVE_INVITATION_STATUSES = new Set(["SENT", "OPENED"]);

export interface InvitationPreviewSummary {
  readonly invitationId: string;
  readonly provider: EmailProvider | null;
  readonly deliveryStatus: EmailDeliveryStatus | null;
  readonly deliveryLabel: string;
  readonly previewAvailable: boolean;
  readonly linkAvailable: boolean;
}

export interface InvitationPreviewAccess {
  readonly invitationId: string;
  readonly deliveryId: string;
  readonly provider: EmailProvider;
  readonly deliveryStatus: EmailDeliveryStatus;
  readonly candidateUrl: string;
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

type InvitationDelivery = Pick<
  EmailDelivery,
  | "id"
  | "provider"
  | "status"
  | "subject"
  | "metadataJson"
  | "createdAt"
  | "idempotencyKey"
  | "recipientEmail"
>;

export async function listInvitationPreviewSummaries(
  companyId: string,
  invitationIds: readonly string[],
): Promise<Partial<Record<string, InvitationPreviewSummary>>> {
  const uniqueInvitationIds = [...new Set(invitationIds)].filter((id) => id.length > 0);
  if (uniqueInvitationIds.length === 0) {
    return {};
  }

  const [invitations, deliveries] = await Promise.all([
    prisma.candidateInvitation.findMany({
      where: { companyId, id: { in: uniqueInvitationIds } },
      select: {
        id: true,
        companyId: true,
        email: true,
        status: true,
        expiresAt: true,
        tokenConsumedAt: true,
        tokenRevokedAt: true,
      },
    }),
    prisma.emailDelivery.findMany({
      where: {
        companyId,
        templateKey: "INTERVIEW_INVITATION",
        OR: uniqueInvitationIds.map((invitationId) => ({
          idempotencyKey: { contains: invitationId },
        })),
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        provider: true,
        status: true,
        subject: true,
        metadataJson: true,
        createdAt: true,
        idempotencyKey: true,
        recipientEmail: true,
      },
    }),
  ]);

  const deliveryByInvitationId = mapDeliveriesToInvitations(uniqueInvitationIds, deliveries);
  const now = new Date();
  return Object.fromEntries(
    invitations.map((invitation) => {
      const delivery = deliveryByInvitationId.get(invitation.id) ?? null;
      return [
        invitation.id,
        {
          invitationId: invitation.id,
          provider: delivery?.provider ?? null,
          deliveryStatus: delivery?.status ?? null,
          deliveryLabel: getInvitationDeliveryLabel(
            delivery?.provider ?? null,
            delivery?.status ?? null,
          ),
          previewAvailable:
            delivery?.provider === "PREVIEW" && isInvitationLinkUsable(invitation, now),
          linkAvailable: delivery !== null && isInvitationLinkUsable(invitation, now),
        },
      ];
    }),
  );
}

export async function getInvitationPreviewAccess(
  companyId: string,
  invitationId: string,
): Promise<InvitationPreviewAccess> {
  const invitation = await prisma.candidateInvitation.findUnique({
    where: { companyId_id: { companyId, id: invitationId } },
    select: {
      id: true,
      companyId: true,
      email: true,
      status: true,
      expiresAt: true,
      tokenConsumedAt: true,
      tokenRevokedAt: true,
    },
  });
  if (invitation === null) {
    throw notFound("Invitation was not found.");
  }
  if (!isInvitationLinkUsable(invitation, new Date())) {
    throw forbidden("Invitation is not active.");
  }

  const delivery = await findInvitationDelivery(companyId, invitationId, invitation.email);
  if (delivery === null) {
    throw notFound("Invitation delivery was not found.");
  }

  const variables = readTemplateVariables(delivery.metadataJson);
  const candidateUrl = readCandidateUrl(variables);
  const rendered = renderEmailTemplate(getDefaultEmailTemplate("interview_invitation"), variables);
  return {
    invitationId,
    deliveryId: delivery.id,
    provider: delivery.provider,
    deliveryStatus: delivery.status,
    candidateUrl,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  };
}

export function getInvitationDeliveryLabel(
  provider: EmailProvider | null,
  status: EmailDeliveryStatus | null,
): string {
  if (provider === "PREVIEW") {
    return "Preview generated";
  }
  if (status === null) {
    return "No delivery recorded";
  }
  return `Email ${status.toLowerCase().replace(/_/g, " ")}`;
}

export function isInvitationLinkUsable(
  invitation: Pick<
    CandidateInvitation,
    "status" | "expiresAt" | "tokenConsumedAt" | "tokenRevokedAt"
  >,
  now: Date,
): boolean {
  return (
    ACTIVE_INVITATION_STATUSES.has(invitation.status) &&
    invitation.expiresAt.getTime() > now.getTime() &&
    invitation.tokenConsumedAt === null &&
    invitation.tokenRevokedAt === null
  );
}

function mapDeliveriesToInvitations(
  invitationIds: readonly string[],
  deliveries: readonly InvitationDelivery[],
): Map<string, InvitationDelivery> {
  const mapped = new Map<string, InvitationDelivery>();
  for (const invitationId of invitationIds) {
    const delivery = deliveries.find(
      (candidate) => candidate.idempotencyKey?.includes(invitationId) === true,
    );
    if (delivery !== undefined) {
      mapped.set(invitationId, delivery);
    }
  }
  return mapped;
}

async function findInvitationDelivery(
  companyId: string,
  invitationId: string,
  invitationEmail: string,
): Promise<InvitationDelivery | null> {
  const deliveries = await prisma.emailDelivery.findMany({
    where: {
      companyId,
      templateKey: "INTERVIEW_INVITATION",
      normalizedRecipientEmail: invitationEmail.trim().toLowerCase(),
      idempotencyKey: { contains: invitationId },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      provider: true,
      status: true,
      subject: true,
      metadataJson: true,
      createdAt: true,
      idempotencyKey: true,
      recipientEmail: true,
    },
  });
  return deliveries[0] ?? null;
}

function readTemplateVariables(metadata: unknown): Record<string, string> {
  if (metadata === null || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw notFound("Invitation preview metadata was not found.");
  }
  const templateVariables = (metadata as Record<string, unknown>).templateVariables;
  if (
    templateVariables === null ||
    typeof templateVariables !== "object" ||
    Array.isArray(templateVariables)
  ) {
    throw notFound("Invitation preview metadata was not found.");
  }

  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(templateVariables)) {
    if (typeof value === "string" || typeof value === "number") {
      normalized[key] = String(value);
    }
  }
  return normalized;
}

function readCandidateUrl(variables: Partial<Record<string, string>>): string {
  const actionUrl = variables.actionUrl;
  if (actionUrl === undefined) {
    throw notFound("Invitation link was not found.");
  }
  const parsed = new URL(actionUrl);
  if (!parsed.pathname.startsWith("/candidate/entry")) {
    throw forbidden("Invitation link is invalid.");
  }
  return parsed.toString();
}
