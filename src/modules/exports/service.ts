import type {
  CreateExportRequestInput,
  ExportArtifact,
  ExportArtifactId,
  ExportArtifactStore,
  ExportDownloadUrlProvider,
  ExportRequest,
  ExportRequestStore,
  ExportRequestType,
} from "./types";

const resourceScopedExportTypes = new Set<ExportRequestType>([
  "candidate_report",
  "candidate_transcript",
  "candidate_comparison",
  "role_summary",
  "role_pipeline_csv",
]);
const EXPORT_DOWNLOAD_TTL_SECONDS = 300;

export class ExportRequestError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ExportRequestError";
  }
}

export class ExportRequestService {
  public constructor(private readonly store: ExportRequestStore) {}

  public create(input: CreateExportRequestInput): Promise<ExportRequest> {
    const resourceType = input.resourceType?.trim() ?? null;
    const resourceId = input.resourceId?.trim() ?? null;

    if (resourceScopedExportTypes.has(input.type)) {
      if (resourceType === null || resourceId === null) {
        throw new ExportRequestError("Resource-scoped exports require resource type and ID.");
      }
    }

    if ((resourceType === null) !== (resourceId === null)) {
      throw new ExportRequestError("Export resource type and ID must be provided together.");
    }

    return this.store.create({
      companyId: input.tenant.companyId,
      requestedByUserId: input.requestedByUserId,
      type: input.type,
      resourceType,
      resourceId,
    });
  }
}

export class ExportArtifactService {
  public constructor(
    private readonly store: ExportArtifactStore,
    private readonly downloadUrlProvider: ExportDownloadUrlProvider,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public createArtifact(input: {
    readonly exportRequest: ExportRequest;
    readonly storageProvider: string;
    readonly bucket: string;
    readonly storageKey: string;
    readonly fileName: string;
    readonly contentType: "text/csv" | "application/json" | "application/pdf";
    readonly sizeBytes: bigint | null;
    readonly checksumSha256: string | null;
    readonly retentionDeleteAt: Date;
    readonly expiresAt: Date;
    readonly metadata?: Record<string, string | number | boolean | null>;
  }): Promise<ExportArtifact> {
    validateStorageKey(input.storageKey);
    validateFileName(input.fileName);

    if (input.expiresAt <= this.now()) {
      throw new ExportRequestError("Export artifact expiry must be in the future.");
    }
    if (input.retentionDeleteAt < input.expiresAt) {
      throw new ExportRequestError("Export artifact retention must outlive the download window.");
    }

    return this.store.createArtifact({
      companyId: input.exportRequest.companyId,
      exportRequestId: input.exportRequest.id,
      storageProvider: input.storageProvider,
      bucket: input.bucket,
      storageKey: input.storageKey,
      fileName: input.fileName,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      checksumSha256: input.checksumSha256,
      retentionDeleteAt: input.retentionDeleteAt,
      expiresAt: input.expiresAt,
      metadata: input.metadata ?? {},
    });
  }

  public async issueDownloadUrl(input: {
    readonly companyId: ExportArtifact["companyId"];
    readonly artifactId: ExportArtifactId;
    readonly actorUserId: string;
    readonly requestId: string | null;
    readonly correlationId: string | null;
  }): Promise<{
    readonly artifact: ExportArtifact;
    readonly downloadUrl: string;
    readonly expiresAt: Date;
  }> {
    const artifact = await this.store.findArtifact({
      companyId: input.companyId,
      artifactId: input.artifactId,
    });
    if (artifact?.status !== "ready") {
      throw new ExportRequestError("Export artifact is not ready for download.");
    }
    if (artifact.expiresAt <= this.now()) {
      throw new ExportRequestError("Export artifact has expired.");
    }
    if (artifact.legalHoldActive) {
      throw new ExportRequestError("Export artifact is blocked by legal hold.");
    }

    const expiresAt = new Date(this.now().getTime() + EXPORT_DOWNLOAD_TTL_SECONDS * 1000);
    const downloadUrl = await this.downloadUrlProvider.createSignedDownloadUrl({
      bucket: artifact.bucket,
      storageKey: artifact.storageKey,
      fileName: artifact.fileName,
      contentType: artifact.contentType,
      expiresInSeconds: EXPORT_DOWNLOAD_TTL_SECONDS,
    });
    await this.store.recordAccess({
      companyId: input.companyId,
      exportRequestId: artifact.exportRequestId,
      exportArtifactId: artifact.id,
      actorUserId: input.actorUserId,
      eventType: "signed_url_issued",
      requestId: input.requestId,
      correlationId: input.correlationId,
      expiresAt,
      metadata: {
        fileName: artifact.fileName,
        contentType: artifact.contentType,
        sizeBytes: artifact.sizeBytes === null ? null : Number(artifact.sizeBytes),
      },
    });

    return { artifact, downloadUrl, expiresAt };
  }
}

function validateStorageKey(value: string): void {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9/_=.@-]{1,512}$/.test(value) || value.includes("..")) {
    throw new ExportRequestError("Export storage key is invalid.");
  }
}

function validateFileName(value: string): void {
  if (!/^[\w .@-]{1,160}$/.test(value) || value.includes("..")) {
    throw new ExportRequestError("Export file name is invalid.");
  }
}
