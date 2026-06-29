import type {
  CreateExportRequestInput,
  ExportRequest,
  ExportRequestStore,
  ExportRequestType,
} from "./types";

const resourceScopedExportTypes = new Set<ExportRequestType>([
  "candidate_report",
  "role_summary",
]);

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
