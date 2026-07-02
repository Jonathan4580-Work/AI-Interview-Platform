import { NextResponse } from "next/server";

import { getInvitationPreviewAccess } from "@/server/hr-workspace/invitation-preview";
import { withApiHandler } from "@/server/api";
import {
  getAuthenticatedContext,
  requirePermissionForContext,
  requireTenantContext,
} from "@/server/auth";

import { recordEmailApiAudit } from "../../../email/_shared";
import { parseIdParam } from "../../../_shared";

export const GET = withApiHandler(async (request, { requestContext }) => {
  const auth = await getAuthenticatedContext(request);
  requirePermissionForContext(auth, "invitations:read");
  const tenant = requireTenantContext(auth, request);
  const invitationId = parseIdParam(extractInvitationId(request));
  const preview = await getInvitationPreviewAccess(tenant.companyId, invitationId);

  await recordEmailApiAudit({
    auth,
    tenant,
    request,
    requestContext,
    action: "invitation.email_preview.viewed",
    resourceType: "candidate_invitation",
    resourceId: invitationId,
    after: {
      deliveryId: preview.deliveryId,
      provider: preview.provider,
      deliveryStatus: preview.deliveryStatus,
    },
  });

  return new NextResponse(preview.html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
      "x-robots-tag": "noindex, nofollow",
    },
  });
});

function extractInvitationId(request: Request): string {
  const parts = new URL(request.url).pathname.split("/");
  const index = parts.indexOf("invitations");
  return index >= 0 ? (parts[index + 1] ?? "") : "";
}
