import { describe, expect, it } from "vitest";

import {
  encodeCsvRow,
  ExportArtifactService,
  ExportRequestError,
  type ExportAccessLog,
  type ExportArtifact,
  type ExportArtifactId,
  type ExportArtifactStore,
  type ExportDownloadUrlProvider,
  type ExportRequest,
  type ExportRequestId,
} from "@/modules/exports";
import { toTenantId } from "@/modules/tenant";

const now = new Date("2026-01-01T00:00:00.000Z");
const tenantId = toTenantId("company001");

describe("export workflow foundations", () => {
  it("protects CSV cells from spreadsheet formula injection", () => {
    expect(encodeCsvRow(["=cmd", "+SUM(A1:A2)", "-10", "@hidden", "plain"])).toBe(
      "'=cmd,'+SUM(A1:A2),'-10,'@hidden,plain",
    );
  });

  it("creates export artifacts with bounded file metadata", async () => {
    const store = new InMemoryExportArtifactStore();
    const service = new ExportArtifactService(store, new StaticDownloadUrlProvider(), () => now);

    const artifact = await service.createArtifact({
      exportRequest: exportRequest(),
      storageProvider: "s3",
      bucket: "exports",
      storageKey: "company001/exports/request_1/report.csv",
      fileName: "report.csv",
      contentType: "text/csv",
      sizeBytes: 42n,
      checksumSha256: "abc123",
      expiresAt: new Date("2026-01-02T00:00:00.000Z"),
      retentionDeleteAt: new Date("2026-02-01T00:00:00.000Z"),
    });

    expect(artifact.status).toBe("ready");
    expect(artifact.storageKey).toBe("company001/exports/request_1/report.csv");
  });

  it("issues short-lived signed download URLs without persisting the URL", async () => {
    const store = new InMemoryExportArtifactStore([
      exportArtifact({ status: "ready", expiresAt: new Date("2026-01-02T00:00:00.000Z") }),
    ]);
    const service = new ExportArtifactService(store, new StaticDownloadUrlProvider(), () => now);

    const issued = await service.issueDownloadUrl({
      companyId: tenantId,
      artifactId: "artifact_1" as ExportArtifactId,
      actorUserId: "user_1",
      requestId: "request_id",
      correlationId: "correlation_id",
    });

    expect(issued.downloadUrl).toBe("https://storage.example/download?signature=redacted");
    expect(store.accessLogs).toHaveLength(1);
    expect(JSON.stringify(store.accessLogs[0])).not.toContain("storage.example");
    expect(store.accessLogs[0]?.eventType).toBe("signed_url_issued");
  });

  it("rejects expired or legally held artifacts", async () => {
    const expiredService = new ExportArtifactService(
      new InMemoryExportArtifactStore([
        exportArtifact({ status: "ready", expiresAt: new Date("2025-12-31T00:00:00.000Z") }),
      ]),
      new StaticDownloadUrlProvider(),
      () => now,
    );
    await expect(
      expiredService.issueDownloadUrl({
        companyId: tenantId,
        artifactId: "artifact_1" as ExportArtifactId,
        actorUserId: "user_1",
        requestId: null,
        correlationId: null,
      }),
    ).rejects.toThrow(ExportRequestError);

    const heldService = new ExportArtifactService(
      new InMemoryExportArtifactStore([
        exportArtifact({
          status: "ready",
          legalHoldActive: true,
          expiresAt: new Date("2026-01-02T00:00:00.000Z"),
        }),
      ]),
      new StaticDownloadUrlProvider(),
      () => now,
    );
    await expect(
      heldService.issueDownloadUrl({
        companyId: tenantId,
        artifactId: "artifact_1" as ExportArtifactId,
        actorUserId: "user_1",
        requestId: null,
        correlationId: null,
      }),
    ).rejects.toThrow(ExportRequestError);
  });
});

class StaticDownloadUrlProvider implements ExportDownloadUrlProvider {
  public createSignedDownloadUrl(): Promise<string> {
    return Promise.resolve("https://storage.example/download?signature=redacted");
  }
}

class InMemoryExportArtifactStore implements ExportArtifactStore {
  public readonly artifacts: ExportArtifact[];
  public readonly accessLogs: ExportAccessLog[] = [];

  public constructor(artifacts: readonly ExportArtifact[] = []) {
    this.artifacts = [...artifacts];
  }

  public createArtifact(
    input: Parameters<ExportArtifactStore["createArtifact"]>[0],
  ): Promise<ExportArtifact> {
    const artifact = exportArtifact({
      id: `artifact_${String(this.artifacts.length + 1)}` as ExportArtifactId,
      exportRequestId: input.exportRequestId,
      status: "ready",
      storageProvider: input.storageProvider,
      bucket: input.bucket,
      storageKey: input.storageKey,
      fileName: input.fileName,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      checksumSha256: input.checksumSha256,
      expiresAt: input.expiresAt,
      retentionDeleteAt: input.retentionDeleteAt,
      metadata: input.metadata,
    });
    this.artifacts.push(artifact);
    return Promise.resolve(artifact);
  }

  public findArtifact(
    input: Parameters<ExportArtifactStore["findArtifact"]>[0],
  ): Promise<ExportArtifact | null> {
    return Promise.resolve(
      this.artifacts.find(
        (artifact) => artifact.companyId === input.companyId && artifact.id === input.artifactId,
      ) ?? null,
    );
  }

  public recordAccess(
    input: Parameters<ExportArtifactStore["recordAccess"]>[0],
  ): Promise<ExportAccessLog> {
    const log: ExportAccessLog = {
      id: `access_${String(this.accessLogs.length + 1)}`,
      companyId: input.companyId,
      exportRequestId: input.exportRequestId,
      exportArtifactId: input.exportArtifactId,
      actorUserId: input.actorUserId,
      eventType: input.eventType,
      requestId: input.requestId,
      correlationId: input.correlationId,
      issuedAt: now,
      expiresAt: input.expiresAt,
      metadata: input.metadata,
    };
    this.accessLogs.push(log);
    return Promise.resolve(log);
  }
}

function exportRequest(): ExportRequest {
  return {
    id: "export_request_1" as ExportRequestId,
    companyId: tenantId,
    requestedByUserId: "user_1" as ExportRequest["requestedByUserId"],
    type: "candidate_report",
    status: "requested",
    resourceType: "candidate",
    resourceId: "candidate_1",
    storageKey: null,
    expiresAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

function exportArtifact(overrides: Partial<ExportArtifact> = {}): ExportArtifact {
  return {
    id: (overrides.id ?? "artifact_1") as ExportArtifactId,
    companyId: tenantId,
    exportRequestId: (overrides.exportRequestId ?? "export_request_1") as ExportRequestId,
    status: overrides.status ?? "ready",
    storageProvider: overrides.storageProvider ?? "s3",
    bucket: overrides.bucket ?? "exports",
    storageKey: overrides.storageKey ?? "company001/exports/request_1/report.csv",
    fileName: overrides.fileName ?? "report.csv",
    contentType: overrides.contentType ?? "text/csv",
    sizeBytes: overrides.sizeBytes ?? 42n,
    checksumSha256: overrides.checksumSha256 ?? "abc123",
    retentionDeleteAt: overrides.retentionDeleteAt ?? new Date("2026-02-01T00:00:00.000Z"),
    expiresAt: overrides.expiresAt ?? new Date("2026-01-02T00:00:00.000Z"),
    legalHoldId: overrides.legalHoldId ?? null,
    legalHoldActive: overrides.legalHoldActive ?? false,
    metadata: overrides.metadata ?? {},
    createdAt: now,
    updatedAt: now,
  };
}
