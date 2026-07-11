import Link from "next/link";
import { BriefcaseBusiness, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { signOutCandidateAccountAction } from "@/server/public-careers/actions";
import { listCandidateApplications } from "@/server/public-careers/candidate-queries";

export default async function CandidateApplicationsPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly submitted?: string; readonly applyError?: string }>;
}) {
  const query = await searchParams;
  const data = await listCandidateApplications();

  if (data === null) {
    return (
      <main className="min-h-screen bg-background">
        <section className="mx-auto grid w-full max-w-3xl gap-4 px-4 py-12 sm:px-6 lg:px-8">
          <Card>
            <CardHeader>
              <CardTitle>Candidate sign in required</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm text-muted-foreground">
              <p>
                Use a company job posting to create or sign in to your candidate account before
                viewing applications.
              </p>
              <p>Return to the public job posting to continue your application.</p>
            </CardContent>
          </Card>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto grid w-full max-w-5xl gap-5 px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="grid gap-1">
            <p className="text-sm font-medium text-muted-foreground">Candidate dashboard</p>
            <h1 className="text-3xl font-semibold tracking-normal text-foreground">
              My applications
            </h1>
            <p className="break-all text-sm text-muted-foreground">
              Signed in as {data.session.fullName} · {data.session.email}
            </p>
          </div>
          <form action={signOutCandidateAccountAction}>
            <Button type="submit" variant="secondary">
              <LogOut aria-hidden="true" />
              Sign out
            </Button>
          </form>
        </div>

        {query.submitted === "1" ? (
          <p className="rounded-md border border-success/30 bg-success/5 px-3 py-2 text-sm text-success">
            Application submitted. The hiring team can now review your CV.
          </p>
        ) : null}
        {query.applyError === undefined ? null : (
          <p className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
            {query.applyError}
          </p>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BriefcaseBusiness aria-hidden="true" className="size-4" />
              Applications
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {data.applications.length === 0 ? (
              <div className="rounded-md border border-dashed border-border p-5 text-sm text-muted-foreground">
                You have not submitted any applications with this candidate account yet.
              </div>
            ) : (
              data.applications.map((application) => (
                <article key={application.id} className="rounded-lg border border-border p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h2 className="font-medium text-foreground">{application.jobTitle}</h2>
                      <p className="text-sm text-muted-foreground">{application.companyName}</p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Applied {formatDate(application.appliedAt)}
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">{application.nextStep}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-md border border-border bg-muted px-2 py-1 text-xs font-medium text-foreground">
                        {application.status}
                      </span>
                      <Button asChild variant="secondary" size="sm">
                        <Link
                          href={`/careers/${application.companySlug}/jobs/${application.jobSlug}`}
                        >
                          View job
                        </Link>
                      </Button>
                    </div>
                  </div>
                </article>
              ))
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(value);
}
