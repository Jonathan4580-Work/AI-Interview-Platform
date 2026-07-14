import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  FileText,
  LogOut,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { PendingSubmitButton } from "@/components/forms/pending-submit-button";
import {
  EmptyState,
  MetricCard,
  PremiumHero,
  SectionCard,
  Timeline,
} from "@/components/recruiting/recruiting-ui";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { signOutCandidateAccountAction } from "@/server/public-careers/actions";
import { listCandidateApplications } from "@/server/public-careers/candidate-queries";

type CandidatePortalData = NonNullable<Awaited<ReturnType<typeof listCandidateApplications>>>;
type CandidateApplication = CandidatePortalData["applications"][number];

export default async function CandidateHomePage() {
  const data = await listCandidateApplications();
  if (data === null) {
    return <CandidateSignedOutState />;
  }

  const pendingAvailability = data.applications.filter(
    (application) => application.availability?.status === "ACTIVE",
  );
  const confirmedAvailability = data.applications.filter(
    (application) => application.availability?.status === "CONFIRMED",
  );
  const completedInterviews = data.applications.filter(
    (application) =>
      application.interview?.status === "COMPLETED" ||
      application.interview?.status === "PROCESSING",
  );
  const nextAction = pickNextAction(data.applications);

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto grid w-full max-w-6xl gap-5 px-4 py-8 sm:px-6 lg:px-8">
        <PremiumHero
          eyebrow="Candidate portal"
          title={`Welcome, ${data.session.fullName}`}
          description="Track your applications, respond to interview requests, and see exactly what needs your attention next."
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
            caption="Submitted roles"
            icon={<BriefcaseBusiness className="size-5" aria-hidden="true" />}
          />
          <MetricCard
            label="Pending actions"
            value={pendingAvailability.length}
            caption="Needs your response"
            tone="amber"
            icon={<CalendarClock className="size-5" aria-hidden="true" />}
          />
          <MetricCard
            label="Confirmed slots"
            value={confirmedAvailability.length}
            caption="Interview timing"
            tone="green"
            icon={<CheckCircle2 className="size-5" aria-hidden="true" />}
          />
          <MetricCard
            label="Interviews completed"
            value={completedInterviews.length}
            caption="Processing or reviewed"
            tone="violet"
            icon={<Sparkles className="size-5" aria-hidden="true" />}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <SectionCard
            title="Next action"
            description="The most important step for your active applications."
            action={
              <Button asChild variant="secondary">
                <Link href="/candidate/applications">View all applications</Link>
              </Button>
            }
          >
            <NextActionCard application={nextAction} />
          </SectionCard>

          <SectionCard
            title="Preparation"
            description="A few simple checks before any browser interview."
          >
            <div className="grid gap-3 text-sm">
              <PreparationItem
                icon={<ShieldCheck aria-hidden="true" />}
                title="Use a quiet space"
                description="Choose somewhere stable where you can speak clearly."
              />
              <PreparationItem
                icon={<CalendarClock aria-hidden="true" />}
                title="Keep camera and microphone ready"
                description="Aptly will ask for explicit permission before any interview recording."
              />
              <PreparationItem
                icon={<FileText aria-hidden="true" />}
                title="Review the role"
                description="Open the job posting before your interview and refresh the key requirements."
              />
              <PreparationItem
                icon={<CheckCircle2 aria-hidden="true" />}
                title="You stay in control"
                description="Applications, availability, and interview steps are shown here with clear next actions."
              />
            </div>
          </SectionCard>
        </div>

        <SectionCard
          title="Recent applications"
          description="A concise view of where each application stands."
        >
          {data.applications.length === 0 ? (
            <EmptyState
              title="No applications yet"
              description="Open a company careers page to apply for your first role."
            />
          ) : (
            <div className="grid gap-3">
              {data.applications.slice(0, 3).map((application) => (
                <CandidateApplicationPreview key={application.id} application={application} />
              ))}
            </div>
          )}
        </SectionCard>
      </section>
    </main>
  );
}

function CandidateSignedOutState() {
  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto grid w-full max-w-4xl gap-5 px-4 py-12 sm:px-6 lg:px-8">
        <PremiumHero
          eyebrow="Candidate portal"
          title="Track your Aptly applications"
          description="Sign in from a public job posting to view applications, availability requests, and interview next steps."
          actions={<ThemeToggle className="text-white hover:bg-white/15 hover:text-white" />}
        />
        <Card>
          <CardContent className="grid gap-4 p-6 text-sm text-muted-foreground">
            <p>
              Candidate accounts are created from public job postings. Open the role you applied
              from to sign in or continue your application.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild className="w-fit">
                <Link href="/">
                  Explore Aptly
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild variant="secondary" className="w-fit">
                <Link href="/careers/aptly-demo">View open roles</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function NextActionCard({ application }: { readonly application: CandidateApplication | null }) {
  if (application === null) {
    return (
      <EmptyState
        title="No action needed"
        description="When a hiring team needs your response, it will appear here."
      />
    );
  }
  const action = candidateAction(application);
  return (
    <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary-soft via-surface to-primary-soft/40 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            {application.companyName}
          </p>
          <h2 className="mt-2 text-xl font-semibold text-foreground">{application.jobTitle}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{action.description}</p>
        </div>
        <Button asChild>
          <Link href={action.href}>{action.label}</Link>
        </Button>
      </div>
    </div>
  );
}

function CandidateApplicationPreview({
  application,
}: {
  readonly application: CandidateApplication;
}) {
  const action = candidateAction(application);
  return (
    <article className="rounded-2xl border border-border/80 bg-surface p-5 shadow-xs">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-foreground">{application.jobTitle}</h3>
            <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
              {application.status}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {application.companyName} · Applied {formatDate(application.appliedAt)}
          </p>
          <p className="mt-3 text-sm text-muted-foreground">{application.nextStep}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href={action.href}>{action.label}</Link>
          </Button>
          <Button asChild size="sm" variant="secondary">
            <Link href={`/careers/${application.companySlug}/jobs/${application.jobSlug}`}>
              View role
            </Link>
          </Button>
        </div>
      </div>
      <div className="mt-5">
        <Timeline
          current={timelineCurrent(application)}
          steps={["Applied", "Review", "Shortlisted", "Availability", "Interview", "Decision"]}
        />
      </div>
    </article>
  );
}

function PreparationItem({
  icon,
  title,
  description,
}: {
  readonly icon: ReactNode;
  readonly title: string;
  readonly description: string;
}) {
  return (
    <div className="flex gap-3 rounded-xl border border-border bg-background/70 p-3">
      <span className="mt-0.5 text-primary [&_svg]:size-4">{icon}</span>
      <span>
        <span className="block font-semibold text-foreground">{title}</span>
        <span className="mt-1 block text-muted-foreground">{description}</span>
      </span>
    </div>
  );
}

function pickNextAction(
  applications: readonly CandidateApplication[],
): CandidateApplication | null {
  return (
    applications.find((application) => application.availability?.status === "ACTIVE") ??
    applications.find((application) => application.rawStatus === "INTERVIEW_INVITED") ??
    applications.find((application) => application.rawStatus === "AVAILABILITY_CONFIRMED") ??
    applications.find((application) => application.interview?.reportStatus === "READY") ??
    applications.at(0) ??
    null
  );
}

function candidateAction(application: CandidateApplication): {
  label: string;
  href: string;
  description: string;
} {
  if (application.availability?.url !== null && application.availability?.url !== undefined) {
    return {
      label: "Choose time",
      href: application.availability.url,
      description:
        "The hiring team has requested your availability. Choose a time that works for you.",
    };
  }
  if (application.rawStatus === "INTERVIEW_INVITED") {
    return {
      label: "View applications",
      href: "/candidate/applications",
      description:
        "Your interview invitation has been sent. Follow the secure link from your email to begin.",
    };
  }
  if (application.interview?.reportStatus === "READY") {
    return {
      label: "View status",
      href: "/candidate/applications",
      description:
        "Your interview has been reviewed. The hiring team will contact you with any final next steps.",
    };
  }
  return {
    label: "View status",
    href: "/candidate/applications",
    description: application.nextStep,
  };
}

function timelineCurrent(application: CandidateApplication): string {
  if (
    application.rawStatus === "HIRED" ||
    application.rawStatus === "REJECTED" ||
    application.rawStatus === "NOT_SELECTED"
  ) {
    return "Decision";
  }
  if (
    application.rawStatus === "INTERVIEW_COMPLETED" ||
    application.interview?.status === "COMPLETED" ||
    application.interview?.status === "PROCESSING"
  ) {
    return "Interview";
  }
  if (application.rawStatus === "INTERVIEW" || application.rawStatus === "INTERVIEW_INVITED") {
    return "Interview";
  }
  if (
    application.rawStatus === "AVAILABILITY_REQUESTED" ||
    application.rawStatus === "AVAILABILITY_CONFIRMED"
  ) {
    return "Availability";
  }
  if (application.rawStatus === "SHORTLISTED") return "Shortlisted";
  if (application.rawStatus === "IN_REVIEW") return "Review";
  return "Applied";
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(value);
}
