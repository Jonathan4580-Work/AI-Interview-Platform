import Link from "next/link";
import {
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  FileText,
  LogOut,
  Sparkles,
} from "lucide-react";

import { PendingSubmitButton } from "@/components/forms/pending-submit-button";
import {
  EmptyState,
  MetricCard,
  SectionCard,
  Timeline,
} from "@/components/recruiting/recruiting-ui";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
          <div className="flex flex-wrap items-center gap-2">
            <ThemeToggle />
            <form action={signOutCandidateAccountAction}>
              <PendingSubmitButton variant="secondary" pendingLabel="Signing out...">
                <LogOut aria-hidden="true" />
                Sign out
              </PendingSubmitButton>
            </form>
          </div>
        </div>

        {query.submitted === "1" ? (
          <Alert variant="success">
            <AlertTitle>Application submitted</AlertTitle>
            <AlertDescription>The hiring team can now review your CV.</AlertDescription>
          </Alert>
        ) : null}
        {query.applyError === undefined ? null : (
          <Alert variant="warning">
            <AlertTitle>Application already exists</AlertTitle>
            <AlertDescription>{query.applyError}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Applications"
            value={data.applications.length}
            icon={<BriefcaseBusiness className="size-5" aria-hidden="true" />}
          />
          <MetricCard
            label="Pending actions"
            value={
              data.applications.filter(
                (application) => application.availability?.status === "ACTIVE",
              ).length
            }
            tone="amber"
            icon={<CalendarClock className="size-5" aria-hidden="true" />}
          />
          <MetricCard
            label="Confirmed"
            value={
              data.applications.filter(
                (application) => application.availability?.status === "CONFIRMED",
              ).length
            }
            tone="green"
            icon={<CheckCircle2 className="size-5" aria-hidden="true" />}
          />
          <MetricCard
            label="Completed"
            value={
              data.applications.filter(
                (application) =>
                  application.rawStatus === "HIRED" ||
                  application.rawStatus === "REJECTED" ||
                  application.rawStatus === "NOT_SELECTED",
              ).length
            }
            tone="violet"
            icon={<Sparkles className="size-5" aria-hidden="true" />}
          />
        </div>

        <SectionCard
          title="Applications"
          description="Track submitted roles, requested actions, interview progress, and final outcomes."
        >
          <div className="grid gap-3">
            {data.applications.length === 0 ? (
              <EmptyState
                title="No applications yet"
                description="Return to a company job posting to upload your CV and submit your first application."
              />
            ) : (
              data.applications.map((application) => (
                <article
                  key={application.id}
                  className="rounded-2xl border border-border/80 bg-gradient-to-br from-surface to-primary-soft/40 p-5 shadow-xs"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold text-foreground">
                        {application.jobTitle}
                      </h2>
                      <p className="text-sm text-muted-foreground">{application.companyName}</p>
                      <p className="mt-3 inline-flex items-center gap-2 text-sm text-muted-foreground">
                        <FileText className="size-4" aria-hidden="true" />
                        Applied {formatDate(application.appliedAt)}
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">{application.nextStep}</p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        <StatusTile label="Application" value={application.status} />
                        <StatusTile
                          label="Interview"
                          value={application.interview?.status ?? "Not invited"}
                        />
                        <StatusTile
                          label="Results"
                          value={application.interview?.reportStatus ?? "Not ready"}
                        />
                      </div>
                      {application.finalOutcome === null ? null : (
                        <div
                          className={
                            application.finalOutcome.decision === "HIRED"
                              ? "mt-3 rounded-xl border border-success/30 bg-success/10 p-3 text-sm"
                              : "mt-3 rounded-xl border border-border bg-muted/30 p-3 text-sm"
                          }
                        >
                          <p className="font-medium text-foreground">
                            {application.finalOutcome.decision === "HIRED"
                              ? "Offer outcome recorded"
                              : "Application review completed"}
                          </p>
                          <p className="mt-1 text-muted-foreground">
                            {application.finalOutcome.decision === "HIRED"
                              ? "Congratulations. The hiring team has marked your application as hired."
                              : "Thank you for your time. The hiring team has completed this application review."}
                          </p>
                          {application.finalOutcome.onboardingDate === null ? null : (
                            <p className="mt-2 font-medium text-foreground">
                              Target onboarding date: {application.finalOutcome.onboardingDate}
                            </p>
                          )}
                        </div>
                      )}
                      {application.availability === null ? null : (
                        <div className="mt-3 rounded-xl border border-primary/15 bg-primary-soft/60 p-3 text-sm">
                          <p className="flex items-center gap-2 font-medium text-foreground">
                            <CalendarClock className="size-4" aria-hidden="true" />
                            Availability {application.availability.status.toLowerCase()}
                          </p>
                          {application.availability.selectedSlotStartAt === null ? null : (
                            <p className="mt-1 text-muted-foreground">
                              Selected{" "}
                              {formatDateTime(application.availability.selectedSlotStartAt)}
                            </p>
                          )}
                          {application.availability.url === null ? null : (
                            <Button asChild size="sm" className="mt-3">
                              <Link href={application.availability.url}>Choose interview time</Link>
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-md border border-border bg-muted px-2 py-1 text-xs font-medium text-foreground">
                        {application.status}
                      </span>
                      {application.availability?.url === null ||
                      application.availability?.url === undefined ? null : (
                        <Button asChild size="sm">
                          <Link href={application.availability.url}>Choose time</Link>
                        </Button>
                      )}
                      <Button asChild variant="secondary" size="sm">
                        <Link
                          href={`/careers/${application.companySlug}/jobs/${application.jobSlug}`}
                        >
                          View job
                        </Link>
                      </Button>
                    </div>
                  </div>
                  <div className="mt-5">
                    <Timeline
                      current={timelineCurrent(application.status)}
                      steps={[
                        "Applied",
                        "Under HR Review",
                        "Shortlisted",
                        "Availability",
                        "Interview",
                        "Decision",
                      ]}
                    />
                  </div>
                </article>
              ))
            )}
          </div>
        </SectionCard>
      </section>
    </main>
  );
}

function StatusTile({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/70 p-3">
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value.replaceAll("_", " ")}</p>
    </div>
  );
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(value);
}

function timelineCurrent(status: string): string {
  if (status.includes("Hired") || status.includes("Selected")) return "Decision";
  if (status.includes("Completed")) return "Decision";
  if (status.includes("Interview")) return "Interview";
  if (status.includes("Availability")) return "Availability";
  if (status.includes("Shortlisted")) return "Shortlisted";
  if (status.includes("Review")) return "Under HR Review";
  return "Applied";
}

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(value);
}
