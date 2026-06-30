import { z } from "zod";

import { CandidatePortalService } from "@/modules/candidate-portal";
import { apiSuccess, parseJsonBody, withApiHandler } from "@/server/api";
import { getAuthenticatedContext, requireTenantContext } from "@/server/auth";

import { parseIdParam, requireTenantMutationPermission } from "../../../_shared";
import { emailActorFromAuth } from "../../../email/_shared";

const activationSchema = z.object({
  expiresInHours: z.number().int().min(1).max(336).nullable().optional(),
  idempotencyKey: z.string().trim().min(1).max(160).nullable().optional(),
});

export const POST = withApiHandler(async (request, context) => {
  const tenant = await requireTenantMutationPermission(request, "invitations:manage");
  const auth = await getAuthenticatedContext(request);
  requireTenantContext(auth, request);
  const body = await parseJsonBody(request, activationSchema);
  const result = await new CandidatePortalService().activateInvitation({
    tenant,
    actor: emailActorFromAuth(auth),
    request: {
      requestId: context.requestContext.requestId,
      correlationId: context.requestContext.correlationId,
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
    },
    invitationId: parseIdParam(contextParams(request, "invitationId")),
    expiresInHours: body.expiresInHours ?? null,
    idempotencyKey: body.idempotencyKey ?? null,
  });
  return apiSuccess(context.requestContext, result);
});

function contextParams(request: Request, key: string): string {
  const pathname = new URL(request.url).pathname;
  const parts = pathname.split("/");
  const index = parts.indexOf("invitations");
  const value = index >= 0 ? parts[index + 1] : undefined;
  if (key !== "invitationId" || value === undefined) {
    return "";
  }
  return value;
}
