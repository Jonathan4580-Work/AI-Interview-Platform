import { z } from "zod";

import type {
  CandidateComparisonRepository,
  CandidateComparisonRequest,
  CandidateComparisonResult,
} from "./comparison-types";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;
const MAX_CANDIDATE_FILTERS = 25;
const safeIdSchema = z.string().trim().min(1).max(128);

export class CandidateComparisonDomainError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "CandidateComparisonDomainError";
  }
}

export class CandidateComparisonService {
  public constructor(private readonly repository: CandidateComparisonRepository) {}

  public async compare(input: CandidateComparisonRequest): Promise<CandidateComparisonResult> {
    const jobId = parseSafeId(input.jobId, "job ID");
    const candidateIds = normalizeCandidateIds(input.candidateIds);
    const limit = clampLimit(input.limit);
    const rows = await this.repository.listComparableCandidates({
      tenant: input.tenant,
      jobId,
      candidateIds,
      limit,
    });

    return {
      schemaVersion: "candidate-comparison-v1",
      companyId: input.tenant.companyId,
      jobId,
      rows: [...rows].sort((left, right) =>
        left.candidateName.localeCompare(right.candidateName, "en", { sensitivity: "base" }),
      ),
      sort: "candidate_name_asc",
      limitations: [
        "Comparison is side-by-side decision support only and is not a ranking.",
        "No candidate is labeled as best, recommended, or automatically advanced.",
        "Monitoring warnings remain separate context and do not affect competency or overall scores.",
      ],
    };
  }
}

function parseSafeId(value: string, label: string): string {
  const parsed = safeIdSchema.safeParse(value);
  if (!parsed.success) {
    throw new CandidateComparisonDomainError(`Invalid comparison ${label}.`);
  }
  return parsed.data;
}

function normalizeCandidateIds(
  candidateIds: readonly string[] | undefined,
): readonly string[] | null {
  if (candidateIds === undefined) {
    return null;
  }
  if (candidateIds.length > MAX_CANDIDATE_FILTERS) {
    throw new CandidateComparisonDomainError(
      "Candidate comparison filter count exceeds the maximum.",
    );
  }
  const unique = [...new Set(candidateIds.map((id) => parseSafeId(id, "candidate ID")))];
  return unique.length === 0 ? null : unique;
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) {
    return DEFAULT_LIMIT;
  }
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_LIMIT);
}
