import type { IntegrationProvider, IntegrationSyncCheckpoint } from "./types";

export interface AtsExternalRecord {
  readonly externalId: string;
  readonly resourceType: "job" | "candidate" | "application" | "stage" | "user";
  readonly updatedAt: Date;
  readonly safeFields: Readonly<Record<string, unknown>>;
}

export interface AtsSyncPage {
  readonly records: readonly AtsExternalRecord[];
  readonly nextCursor: Readonly<Record<string, unknown>> | null;
  readonly rateLimitedUntil: Date | null;
}

export interface AtsProviderAdapter {
  readonly provider: IntegrationProvider;
  fetchPage(checkpoint: IntegrationSyncCheckpoint): Promise<AtsSyncPage>;
}

export class DevelopmentAtsAdapter implements AtsProviderAdapter {
  public readonly provider = "development_ats";

  public constructor(private readonly records: readonly AtsExternalRecord[] = []) {}

  public fetchPage(checkpoint: IntegrationSyncCheckpoint): Promise<AtsSyncPage> {
    const pageSize = 2;
    const start = checkpoint.pageNumber * pageSize;
    const records = this.records.slice(start, start + pageSize);
    return Promise.resolve({
      records,
      nextCursor:
        start + pageSize >= this.records.length
          ? null
          : {
              pageNumber: checkpoint.pageNumber + 1,
            },
      rateLimitedUntil: null,
    });
  }
}
