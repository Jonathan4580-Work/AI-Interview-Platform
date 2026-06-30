import { z } from "zod";

import {
  ExportArtifactService,
  PrismaExportArtifactStore,
  type ExportDownloadUrlProvider,
} from "@/modules/exports";
import { S3CompatibleObjectStorageProvider } from "@/modules/media/s3-storage-provider";
import { apiSuccess, assertCsrf, forbidden, parseJsonBody, withApiHandler } from "@/server/api";
import {
  getAuthenticatedContext,
  requirePermissionForContext,
  requireTenantContext,
} from "@/server/auth";

import { parseIdParam } from "../../../_shared";

const bodySchema = z.object({}).strict();

class ObjectStorageExportDownloadUrlProvider implements ExportDownloadUrlProvider {
  private readonly storage = new S3CompatibleObjectStorageProvider();

  public async createSignedDownloadUrl(
    input: Parameters<ExportDownloadUrlProvider["createSignedDownloadUrl"]>[0],
  ): Promise<string> {
    const signedUrl = await this.storage.createSignedDownloadUrl({
      storageKey: input.storageKey,
      expiresInSeconds: input.expiresInSeconds,
      contentDisposition: `attachment; filename="${input.fileName.replaceAll('"', "")}"`,
    });
    return signedUrl.url;
  }
}

export const POST = withApiHandler(async (request, { requestContext }) => {
  assertCsrf(request);
  const auth = await getAuthenticatedContext(request);
  requirePermissionForContext(auth, "exports:read");
  const tenant = requireTenantContext(auth, request);
  if (auth.kind !== "company") {
    throw forbidden("Company user context is required.");
  }
  const artifactId = parseIdParam(request.nextUrl.pathname.split("/").at(-2) ?? "");
  await parseJsonBody(request, bodySchema);
  const service = new ExportArtifactService(
    new PrismaExportArtifactStore(),
    new ObjectStorageExportDownloadUrlProvider(),
  );
  const issued = await service.issueDownloadUrl({
    companyId: tenant.companyId,
    artifactId: artifactId as never,
    actorUserId: auth.subject.userId,
    requestId: requestContext.requestId,
    correlationId: requestContext.correlationId,
  });

  return apiSuccess(requestContext, {
    artifact: issued.artifact,
    downloadUrl: issued.downloadUrl,
    expiresAt: issued.expiresAt,
  });
});
