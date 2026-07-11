import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPublicCareerJobDetail } from "@/server/public-careers/queries";

export default async function PublicApplyPlaceholderPage({
  params,
}: {
  readonly params: Promise<{ readonly companySlug: string; readonly jobSlug: string }>;
}) {
  const { companySlug, jobSlug } = await params;
  const job = await getPublicCareerJobDetail(companySlug, jobSlug);
  if (job === null) notFound();

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto grid w-full max-w-3xl gap-5 px-4 py-12 sm:px-6 lg:px-8">
        <Button asChild variant="quiet" className="w-fit">
          <Link href={`/careers/${job.company.slug}/jobs/${job.slug}`}>
            <ArrowLeft aria-hidden="true" />
            Back to job
          </Link>
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Candidate applications coming soon</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-muted-foreground">
            <p>
              This public posting is ready, but candidate accounts, CV upload, and application
              intake are planned for a later phase.
            </p>
            <p>
              If you were invited to complete an interview, use the secure invitation link from the
              hiring team.
            </p>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
