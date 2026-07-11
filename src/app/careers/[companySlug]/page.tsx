import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, BriefcaseBusiness, MapPin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getPublicCareersPage } from "@/server/public-careers/queries";

import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ readonly companySlug: string }>;
}): Promise<Metadata> {
  const { companySlug } = await params;
  const data = await getPublicCareersPage(companySlug);
  if (data === null) return { title: "Careers" };
  return {
    title: `${data.company.name} Careers`,
    description: `Open roles at ${data.company.name}.`,
  };
}

export default async function PublicCareersPage({
  params,
}: {
  readonly params: Promise<{ readonly companySlug: string }>;
}) {
  const { companySlug } = await params;
  const data = await getPublicCareersPage(companySlug);
  if (data === null) notFound();

  return (
    <main className="min-h-screen bg-background">
      <section className="border-b border-border bg-surface">
        <div className="mx-auto grid w-full max-w-6xl gap-5 px-4 py-14 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="neutral">{data.jobs.length} open roles</Badge>
            <span className="text-sm font-medium text-muted-foreground">Careers at</span>
          </div>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-normal text-foreground sm:text-5xl">
            {data.company.name}
          </h1>
          <p className="max-w-2xl text-base text-muted-foreground">
            Explore open roles, review the expectations, and apply with a CV when a role feels
            right.
          </p>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-foreground">Open roles</h2>
          <Badge variant="neutral">{data.jobs.length} open</Badge>
        </div>

        {data.jobs.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              There are no published openings right now.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {data.jobs.map((job) => (
              <Card key={job.id} className="transition-shadow hover:shadow-sm">
                <CardContent className="grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-center">
                  <div className="min-w-0">
                    <Link
                      href={`/careers/${data.company.slug}/jobs/${job.slug}`}
                      className="text-lg font-semibold text-foreground underline-offset-4 hover:underline"
                    >
                      {job.title}
                    </Link>
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{job.summary}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-sm text-muted-foreground">
                      {job.location === null ? null : (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-4" aria-hidden="true" />
                          {job.location}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <BriefcaseBusiness className="size-4" aria-hidden="true" />
                        {job.employmentType}
                      </span>
                      <Badge variant="neutral">{job.workplaceType}</Badge>
                      <Badge variant="neutral">{job.seniorityLevel}</Badge>
                    </div>
                  </div>
                  <Button asChild>
                    <Link href={`/careers/${data.company.slug}/jobs/${job.slug}`}>
                      View job
                      <ArrowRight aria-hidden="true" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
