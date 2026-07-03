import type { Prisma } from "@prisma/client";

import { prisma } from "@/infra/database";

import { compareSearchResults, isAfterSearchCursor } from "./cursor";
import type {
  SearchCategory,
  SearchCursor,
  SearchMatchField,
  SearchResult,
  SearchScope,
  WorkspaceSearchProvider,
} from "./types";

const SCAN_MULTIPLIER = 4;
const MAX_SCAN_PER_CATEGORY = 100;

export class PrismaWorkspaceSearchProvider implements WorkspaceSearchProvider {
  public async search(input: {
    readonly scope: SearchScope;
    readonly query: string;
    readonly categories: readonly SearchCategory[];
    readonly limit: number;
    readonly cursor: SearchCursor | null;
  }): Promise<readonly SearchResult[]> {
    const take = Math.min(
      Math.max(input.limit * SCAN_MULTIPLIER, input.limit),
      MAX_SCAN_PER_CATEGORY,
    );
    const results: SearchResult[] = [];

    if (input.categories.includes("candidate")) {
      results.push(...(await searchCandidates(input.scope, input.query, take)));
    }
    if (input.categories.includes("job")) {
      results.push(...(await searchJobs(input.scope, input.query, take)));
    }
    if (input.categories.includes("application")) {
      results.push(...(await searchApplications(input.scope, input.query, take)));
    }
    if (input.categories.includes("invitation")) {
      results.push(...(await searchInvitations(input.scope, input.query, take)));
    }
    if (input.categories.includes("interview")) {
      results.push(...(await searchInterviews(input.scope, input.query, take)));
    }
    if (input.categories.includes("report")) {
      results.push(...(await searchReports(input.scope, input.query, take)));
    }

    return results
      .sort(compareSearchResults)
      .filter((result) => isAfterSearchCursor(result, input.cursor))
      .slice(0, input.limit);
  }
}

function contains(query: string): Prisma.StringFilter {
  return { contains: query };
}

function score(query: string, values: readonly (string | null | undefined)[]): number {
  const normalizedQuery = query.toLocaleLowerCase();
  let best = 0;

  for (const value of values) {
    const normalizedValue = value?.toLocaleLowerCase();
    if (normalizedValue === undefined) {
      continue;
    }
    if (normalizedValue === normalizedQuery) {
      best = Math.max(best, 300);
    } else if (normalizedValue.startsWith(normalizedQuery)) {
      best = Math.max(best, 200);
    } else if (normalizedValue.includes(normalizedQuery)) {
      best = Math.max(best, 100);
    }
  }

  return best;
}

async function searchCandidates(
  scope: SearchScope,
  query: string,
  take: number,
): Promise<SearchResult[]> {
  const records = await prisma.candidate.findMany({
    where: {
      companyId: scope.tenant.companyId,
      deletedAt: null,
      OR: [{ fullName: contains(query) }, { primaryEmail: contains(query) }],
    },
    select: {
      id: true,
      fullName: true,
      primaryEmail: true,
      status: true,
      updatedAt: true,
    },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    take,
  });

  return records.map((record) => ({
    id: record.id,
    category: "candidate",
    title: record.fullName,
    subtitle: record.primaryEmail,
    href: searchHref(record.id),
    score: score(query, [record.fullName, record.primaryEmail]),
    matchedFields: matchedFields(query, [
      ["candidate_name", record.fullName],
      ["candidate_email", record.primaryEmail],
    ]),
    updatedAt: record.updatedAt,
    metadata: { status: record.status },
  }));
}

async function searchJobs(
  scope: SearchScope,
  query: string,
  take: number,
): Promise<SearchResult[]> {
  const records = await prisma.job.findMany({
    where: {
      companyId: scope.tenant.companyId,
      deletedAt: null,
      OR: [{ title: contains(query) }, { slug: contains(query) }],
    },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      updatedAt: true,
    },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    take,
  });

  return records.map((record) => ({
    id: record.id,
    category: "job",
    title: record.title,
    subtitle: record.slug,
    href: searchHref(record.id),
    score: score(query, [record.title, record.slug]),
    matchedFields: matchedFields(query, [
      ["job_title", record.title],
      ["job_slug", record.slug],
    ]),
    updatedAt: record.updatedAt,
    metadata: { status: record.status, jobId: record.id },
  }));
}

async function searchApplications(
  scope: SearchScope,
  query: string,
  take: number,
): Promise<SearchResult[]> {
  const records = await prisma.candidateApplication.findMany({
    where: {
      companyId: scope.tenant.companyId,
      deletedAt: null,
      OR: [{ candidate: { fullName: contains(query) } }, { job: { title: contains(query) } }],
    },
    select: {
      id: true,
      status: true,
      updatedAt: true,
      candidateId: true,
      jobId: true,
      candidate: { select: { fullName: true } },
      job: { select: { title: true } },
    },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    take,
  });

  return records.map((record) => ({
    id: record.id,
    category: "application",
    title: `${record.candidate.fullName} for ${record.job.title}`,
    subtitle: record.status,
    href: searchHref(record.id),
    score: score(query, [record.candidate.fullName, record.job.title, record.status]),
    matchedFields: matchedFields(query, [["application_status", record.status]]),
    updatedAt: record.updatedAt,
    metadata: {
      status: record.status,
      candidateId: record.candidateId,
      jobId: record.jobId,
      applicationId: record.id,
    },
  }));
}

async function searchInvitations(
  scope: SearchScope,
  query: string,
  take: number,
): Promise<SearchResult[]> {
  const records = await prisma.candidateInvitation.findMany({
    where: {
      companyId: scope.tenant.companyId,
      OR: [{ email: contains(query) }, { candidate: { fullName: contains(query) } }],
    },
    select: {
      id: true,
      email: true,
      status: true,
      updatedAt: true,
      candidateId: true,
      applicationId: true,
      jobId: true,
      candidate: { select: { fullName: true } },
    },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    take,
  });

  return records.map((record) => ({
    id: record.id,
    category: "invitation",
    title: record.candidate.fullName,
    subtitle: record.email,
    href: searchHref(record.id),
    score: score(query, [record.candidate.fullName, record.email, record.status]),
    matchedFields: matchedFields(query, [
      ["invitation_email", record.email],
      ["invitation_status", record.status],
    ]),
    updatedAt: record.updatedAt,
    metadata: {
      status: record.status,
      candidateId: record.candidateId,
      jobId: record.jobId,
      applicationId: record.applicationId ?? undefined,
    },
  }));
}

async function searchInterviews(
  scope: SearchScope,
  query: string,
  take: number,
): Promise<SearchResult[]> {
  const records = await prisma.interviewSession.findMany({
    where: {
      companyId: scope.tenant.companyId,
      candidate: { fullName: contains(query) },
    },
    select: {
      id: true,
      status: true,
      updatedAt: true,
      candidateId: true,
      applicationId: true,
      candidate: { select: { fullName: true } },
    },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    take,
  });

  return records.map((record) => ({
    id: record.id,
    category: "interview",
    title: record.candidate.fullName,
    subtitle: record.status,
    href: searchHref(record.id),
    score: score(query, [record.candidate.fullName, record.status]),
    matchedFields: matchedFields(query, [["interview_status", record.status]]),
    updatedAt: record.updatedAt,
    metadata: {
      status: record.status,
      candidateId: record.candidateId,
      applicationId: record.applicationId ?? undefined,
      interviewSessionId: record.id,
    },
  }));
}

async function searchReports(
  scope: SearchScope,
  query: string,
  take: number,
): Promise<SearchResult[]> {
  const records = await prisma.hrReport.findMany({
    where: {
      companyId: scope.tenant.companyId,
      interviewSession: { candidate: { fullName: contains(query) } },
    },
    select: {
      id: true,
      status: true,
      updatedAt: true,
      interviewSessionId: true,
      interviewSession: {
        select: {
          candidateId: true,
          applicationId: true,
          candidate: { select: { fullName: true } },
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    take,
  });

  return records.map((record) => ({
    id: record.id,
    category: "report",
    title: record.interviewSession.candidate.fullName,
    subtitle: record.status,
    href: "/reports",
    score: score(query, [record.interviewSession.candidate.fullName, record.status]),
    matchedFields: matchedFields(query, [["report_status", record.status]]),
    updatedAt: record.updatedAt,
    metadata: {
      status: record.status,
      candidateId: record.interviewSession.candidateId,
      applicationId: record.interviewSession.applicationId ?? undefined,
      interviewSessionId: record.interviewSessionId,
    },
  }));
}

function searchHref(recordId: string): string {
  return `/search?query=${encodeURIComponent(recordId)}`;
}

function matchedFields(
  query: string,
  candidates: readonly (readonly [SearchMatchField, string | null | undefined])[],
): SearchMatchField[] {
  const normalizedQuery = query.toLocaleLowerCase();
  return candidates
    .filter(([, value]) => value?.toLocaleLowerCase().includes(normalizedQuery) === true)
    .map(([field]) => field);
}
