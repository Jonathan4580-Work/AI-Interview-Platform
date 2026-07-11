import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, MapPin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPublicCareerJobDetail } from "@/server/public-careers/queries";

import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ readonly companySlug: string; readonly jobSlug: string }>;
}): Promise<Metadata> {
  const { companySlug, jobSlug } = await params;
  const job = await getPublicCareerJobDetail(companySlug, jobSlug);
  if (job === null) return { title: "Job" };
  return {
    title: `${job.title} at ${job.company.name}`,
    description: job.summary,
  };
}

export default async function PublicCareerJobPage({
  params,
}: {
  readonly params: Promise<{ readonly companySlug: string; readonly jobSlug: string }>;
}) {
  const { companySlug, jobSlug } = await params;
  const job = await getPublicCareerJobDetail(companySlug, jobSlug);
  if (job === null) notFound();

  return (
    <main className="min-h-screen bg-background">
      <section className="border-b border-border bg-surface">
        <div className="mx-auto grid w-full max-w-5xl gap-5 px-4 py-10 sm:px-6 lg:px-8">
          <Button asChild variant="quiet" className="w-fit">
            <Link href={`/careers/${job.company.slug}`}>
              <ArrowLeft aria-hidden="true" />
              All roles
            </Link>
          </Button>
          <div className="grid gap-3">
            <p className="text-sm font-medium text-muted-foreground">{job.company.name}</p>
            <h1 className="text-4xl font-semibold tracking-normal text-foreground">{job.title}</h1>
            <div className="flex flex-wrap gap-2">
              {job.location === null ? null : (
                <Badge variant="neutral">
                  <MapPin className="mr-1 size-3" aria-hidden="true" />
                  {job.location}
                </Badge>
              )}
              <Badge variant="neutral">{job.employmentType}</Badge>
              <Badge variant="neutral">{job.workplaceType}</Badge>
              <Badge variant="neutral">{job.seniorityLevel}</Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href={`/careers/${job.company.slug}/jobs/${job.slug}/apply`}>Apply</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-5xl gap-5 px-4 py-8 sm:px-6 lg:px-8">
        <Card>
          <CardHeader>
            <CardTitle>Role summary</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-muted-foreground">
            <p>{job.summary}</p>
            {job.details.length === 0 ? null : <p>{job.details}</p>}
          </CardContent>
        </Card>

        <InfoSection title="Responsibilities" items={job.responsibilities} />
        <InfoSection
          title="Requirements"
          items={mergeUnique(job.requirements, job.requiredSkills)}
        />
        <InfoSection title="Nice-to-have skills" items={job.niceToHaveSkills} />
        <InfoSection
          title="What this interview will assess"
          items={job.competencies.map(
            (competency) => `${competency.name}: ${competency.description}`,
          )}
        />
        <InfoSection title="Interview structure" items={job.interviewStructure} />

        <Card>
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-foreground">Ready to apply?</p>
              <p className="text-sm text-muted-foreground">
                Candidate applications are coming soon.
              </p>
            </div>
            <Button asChild>
              <Link href={`/careers/${job.company.slug}/jobs/${job.slug}/apply`}>Apply</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function InfoSection({
  title,
  items,
}: {
  readonly title: string;
  readonly items: readonly string[];
}) {
  if (items.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-2 text-sm text-muted-foreground">
          {items.map((item) => (
            <li key={item} className="flex gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function mergeUnique(first: readonly string[], second: readonly string[]): readonly string[] {
  return [...new Set([...first, ...second])];
}
