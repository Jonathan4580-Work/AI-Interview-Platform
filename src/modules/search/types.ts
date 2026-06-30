import type { PermissionSet } from "@/modules/access-control";
import type { TenantContext } from "@/modules/tenant";

export const searchCategories = [
  "candidate",
  "job",
  "application",
  "invitation",
  "interview",
  "report",
] as const;

export type SearchCategory = (typeof searchCategories)[number];

export type SearchMatchField =
  | "candidate_name"
  | "candidate_email"
  | "job_title"
  | "job_slug"
  | "application_status"
  | "invitation_email"
  | "invitation_status"
  | "interview_status"
  | "report_status";

export interface SearchScope {
  readonly tenant: TenantContext;
  readonly permissionSet: PermissionSet;
}

export interface SearchQuery {
  readonly query: string;
  readonly categories?: readonly SearchCategory[];
  readonly cursor?: string | null;
  readonly limit?: number;
}

export interface SearchCursor {
  readonly score: number;
  readonly category: SearchCategory;
  readonly updatedAt: string;
  readonly id: string;
}

export interface SearchResultMetadata {
  readonly status?: string;
  readonly candidateId?: string;
  readonly jobId?: string;
  readonly applicationId?: string;
  readonly interviewSessionId?: string;
}

export interface SearchResult {
  readonly id: string;
  readonly category: SearchCategory;
  readonly title: string;
  readonly subtitle: string | null;
  readonly href: string;
  readonly score: number;
  readonly matchedFields: readonly SearchMatchField[];
  readonly updatedAt: Date;
  readonly metadata: SearchResultMetadata;
}

export interface SearchResultPage {
  readonly results: readonly SearchResult[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
  readonly searchedCategories: readonly SearchCategory[];
}

export interface WorkspaceSearchProvider {
  search(input: {
    readonly scope: SearchScope;
    readonly query: string;
    readonly categories: readonly SearchCategory[];
    readonly limit: number;
    readonly cursor: SearchCursor | null;
  }): Promise<readonly SearchResult[]>;
}
