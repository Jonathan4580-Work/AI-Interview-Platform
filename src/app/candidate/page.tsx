import Link from "next/link";
import { BriefcaseBusiness, CalendarClock, CheckCircle2, LogOut, Sparkles } from "lucide-react";

import { PendingSubmitButton } from "@/components/forms/pending-submit-button";
import { MetricCard, PremiumHero, SectionCard } from "@/components/recruiting/recruiting-ui";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { signOutCandidateAccountAction } from "@/server/public-careers/actions";
import { listCandidateApplications } from "@/server/public-careers/candidate-queries";

export default async function CandidateHomePage() {
  const data = await listCandidateApplications();
  if (data === null) {
    return (
      <main className="min-h-screen bg-background">
        <section className="mx-auto grid w-full max-w-4xl gap-5 px-4 py-12 sm:px-6 lg:px-8">
          <PremiumHero
            eyebrow="Candidate portal"
            title="Track applications with Aptly"
            description="Sign in from a public job posting to view your applications, availability requests, and interview next steps."
            actions={<ThemeToggle className="text-white hover:bg-white/15 hover:text-white" />}
          />
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              Open the job posting you applied from to sign in or create your candidate account.
            </CardContent>
          </Card>
        </section>
      </main>
    );
  }

  const pendingAvailability = data.applications.filter(
    (application) => application.availability?.status === "ACTIVE",
  );
  const confirmedAvailability = data.applications.filter(
    (application) => application.availability?.status === "CONFIRMED",
  );

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto grid w-full max-w-6xl gap-5 px-4 py-8 sm:px-6 lg:px-8">
        <PremiumHero
          eyebrow="Candidate portal"
          title={`Welcome, ${data.session.fullName}`}
          description="Review application progress, respond to availability requests, and prepare for upcoming interviews."
          actions={
            <>
              <ThemeToggle className="text-white hover:bg-white/15 hover:text-white" />
              <form action={signOutCandidateAccountAction}>
                <PendingSubmitButton variant="secondary" pendingLabel="Signing out...">
                  <LogOut aria-hidden="true" />
                  Sign out
                </PendingSubmitButton>
              </form>
            </>
          }
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Applications"
            value={data.applications.length}
            icon={<BriefcaseBusiness className="size-5" aria-hidden="true" />}
          />
          <MetricCard
            label="Pending actions"
            value={pendingAvailability.length}
            tone="amber"
            icon={<CalendarClock className="size-5" aria-hidden="true" />}
          />
          <MetricCard
            label="Confirmed slots"
            value={confirmedAvailability.length}
            tone="green"
            icon={<CheckCircle2 className="size-5" aria-hidden="true" />}
          />
          <MetricCard
            label="Next steps"
            value="Ready"
            tone="violet"
            icon={<Sparkles className="size-5" aria-hidden="true" />}
          />
        </div>

        <SectionCard
          title="My applications"
          description="Your active roles and any requested actions from hiring teams."
          action={
            <Button asChild variant="secondary">
              <Link href="/candidate/applications">View all</Link>
            </Button>
          }
        >
          <div className="grid gap-3">
            {data.applications.slice(0, 3).map((application) => (
              <article
                key={application.id}
                className="rounded-2xl border border-border/80 bg-surface/80 p-4 shadow-xs"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-foreground">{application.jobTitle}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {application.companyName} · {application.status}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">{application.nextStep}</p>
                  </div>
                  {application.availability?.url === null ||
                  application.availability?.url === undefined ? (
                    <Button asChild variant="secondary" size="sm">
                      <Link
                        href={`/careers/${application.companySlug}/jobs/${application.jobSlug}`}
                      >
                        View job
                      </Link>
                    </Button>
                  ) : (
                    <Button asChild size="sm">
                      <Link href={application.availability.url}>Choose time</Link>
                    </Button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </SectionCard>
      </section>
    </main>
  );
}
