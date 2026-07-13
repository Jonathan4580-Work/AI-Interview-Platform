import { prisma } from "@/infra/database";

export interface PublicCareerJobSummary {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly location: string | null;
  readonly employmentType: string;
  readonly workplaceType: string;
  readonly seniorityLevel: string;
  readonly summary: string;
  readonly updatedAt: Date;
}

export interface PublicCareersCompany {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
}

export interface PublicCareerJobDetail extends PublicCareerJobSummary {
  readonly company: PublicCareersCompany;
  readonly details: string;
  readonly responsibilities: readonly string[];
  readonly requirements: readonly string[];
  readonly requiredSkills: readonly string[];
  readonly niceToHaveSkills: readonly string[];
  readonly competencies: readonly { readonly name: string; readonly description: string }[];
  readonly interviewStructure: readonly string[];
}

export async function getPublicCareersPage(companySlug: string): Promise<{
  readonly company: PublicCareersCompany;
  readonly jobs: readonly PublicCareerJobSummary[];
} | null> {
  const company = await prisma.company.findUnique({
    where: { slug: companySlug },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      deletedAt: true,
      settings: { select: { brandingJson: true } },
    },
  });
  if (company?.deletedAt !== null || company.status === "ARCHIVED") {
    return null;
  }

  const jobs = await prisma.job.findMany({
    where: publicJobWhere(company.id),
    orderBy: [{ openedAt: "desc" }, { updatedAt: "desc" }],
    include: { intelligenceProfile: true },
    take: 100,
  });

  return {
    company: { id: company.id, name: publicCompanyName(company), slug: company.slug },
    jobs: jobs.map((job) => ({
      id: job.id,
      title: job.title,
      slug: job.slug,
      location: job.intelligenceProfile?.locationText ?? null,
      employmentType: labelEnum(job.employmentType),
      workplaceType: labelEnum(job.workplaceType),
      seniorityLevel: labelEnum(job.seniorityLevel),
      summary: readSummary(job.descriptionJson),
      updatedAt: job.updatedAt,
    })),
  };
}

export async function getPublicCareerJobDetail(
  companySlug: string,
  jobSlug: string,
): Promise<PublicCareerJobDetail | null> {
  const company = await prisma.company.findUnique({
    where: { slug: companySlug },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      deletedAt: true,
      settings: { select: { brandingJson: true } },
    },
  });
  if (company?.deletedAt !== null || company.status === "ARCHIVED") {
    return null;
  }

  const job = await prisma.job.findFirst({
    where: { ...publicJobWhere(company.id), slug: jobSlug },
    include: { intelligenceProfile: true },
  });
  if (job?.intelligenceProfile == null) {
    return null;
  }

  const requirements = readStringList(job.requirementsJson, "items");
  return {
    id: job.id,
    company: { id: company.id, name: publicCompanyName(company), slug: company.slug },
    title: job.title,
    slug: job.slug,
    location: job.intelligenceProfile.locationText,
    employmentType: labelEnum(job.employmentType),
    workplaceType: labelEnum(job.workplaceType),
    seniorityLevel: labelEnum(job.seniorityLevel),
    summary: readSummary(job.descriptionJson),
    details: readDetails(job.descriptionJson),
    responsibilities: readJsonStringArray(job.intelligenceProfile.responsibilitiesJson),
    requirements,
    requiredSkills: readJsonStringArray(job.intelligenceProfile.requiredSkillsJson),
    niceToHaveSkills: readJsonStringArray(job.intelligenceProfile.niceToHaveSkillsJson),
    competencies: readCompetencies(job.intelligenceProfile.competenciesJson),
    interviewStructure: readJsonStringArray(job.intelligenceProfile.interviewStructureJson),
    updatedAt: job.updatedAt,
  };
}

function publicJobWhere(companyId: string) {
  return {
    companyId,
    status: "OPEN" as const,
    deletedAt: null,
    intelligenceProfile: { is: { status: "PUBLISHED" as const } },
  };
}

function readSummary(value: unknown): string {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return "No role summary has been published yet.";
  }
  const summary = (value as { summary?: unknown }).summary;
  return typeof summary === "string" && summary.trim().length > 0
    ? summary
    : "No role summary has been published yet.";
}

function readDetails(value: unknown): string {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return "";
  const details = (value as { details?: unknown }).details;
  return typeof details === "string" ? details : "";
}

function readStringList(value: unknown, key: string): readonly string[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return [];
  const items = (value as Record<string, unknown>)[key];
  return readJsonStringArray(items);
}

function readJsonStringArray(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function readCompetencies(
  value: unknown,
): readonly { readonly name: string; readonly description: string }[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item !== "object" || item === null || Array.isArray(item)) return null;
      const name = (item as { name?: unknown }).name;
      const description = (item as { description?: unknown }).description;
      if (typeof name !== "string" || name.trim().length === 0) return null;
      return {
        name,
        description: typeof description === "string" ? description : "Role-related competency.",
      };
    })
    .filter(
      (item): item is { readonly name: string; readonly description: string } => item !== null,
    );
}

function labelEnum(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function publicCompanyName(company: {
  readonly name: string;
  readonly settings: { readonly brandingJson: unknown } | null;
}): string {
  const branding = company.settings?.brandingJson;
  if (typeof branding !== "object" || branding === null || Array.isArray(branding)) {
    return company.name;
  }
  const displayName = (branding as { displayName?: unknown }).displayName;
  return typeof displayName === "string" && displayName.trim().length > 0
    ? displayName.trim()
    : company.name;
}
