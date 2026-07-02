import { NextResponse } from "next/server";

import { apiSuccess, withApiHandler } from "@/server/api";
import {
  getAuthenticatedContext,
  requirePermissionForContext,
  requireTenantContext,
} from "@/server/auth";
import { getInvitationPreviewAccess } from "@/server/hr-workspace/invitation-preview";

import { parseIdParam } from "../../../_shared";
import { recordEmailApiAudit } from "../../../email/_shared";

export const GET = withApiHandler(async (request, { requestContext }) => {
  const auth = await getAuthenticatedContext(request);
  requirePermissionForContext(auth, "invitations:read");
  const tenant = requireTenantContext(auth, request);
  const invitationId = parseIdParam(extractInvitationId(request));
  const access = await getInvitationPreviewAccess(tenant.companyId, invitationId);
  const mode = request.nextUrl.searchParams.get("mode");

  await recordEmailApiAudit({
    auth,
    tenant,
    request,
    requestContext,
    action: "invitation.candidate_link.accessed",
    resourceType: "candidate_invitation",
    resourceId: invitationId,
    after: {
      deliveryId: access.deliveryId,
      provider: access.provider,
      mode: mode === "redirect" ? "redirect" : "copy",
    },
  });

  if (mode === "redirect") {
    return NextResponse.redirect(access.candidateUrl, {
      headers: {
        "cache-control": "no-store",
        "referrer-policy": "no-referrer",
      },
    });
  }

  return apiSuccess(requestContext, {
    invitationId,
    candidateUrl: access.candidateUrl,
  });
});

function extractInvitationId(request: Request): string {
  const parts = new URL(request.url).pathname.split("/");
  const index = parts.indexOf("invitations");
  return index >= 0 ? (parts[index + 1] ?? "") : "";
}
