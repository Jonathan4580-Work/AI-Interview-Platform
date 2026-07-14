import Link from "next/link";
import type { ReactNode } from "react";
import {
  BriefcaseBusiness,
  CalendarCheck,
  FileSearch,
  Search,
  Sparkles,
  UserRound,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { requireHrWorkspaceContext } from "@/server/hr-workspace/context";
import { listApplicationsInbox } from "@/server/hr-workspace/queries";

import {
  EmptyPanel,
  Field,
  NativeSelect,
  StatusBadge,
  TextField,
  formatDate,
  normalizeLabel,
} from "../_components/hr-ui";

type ApplicationInboxItem = Awaited<ReturnType<typeof listApplicationsInbox>>[number];

const statusOptions = [
  "ALL",
  "NEW",
  "IN_REVIEW",
  "SHORTLISTED",
  "AVAILABILITY_REQUESTED",
  "AVAILABILITY_CONFIRMED",
  "INTERVIEW_INVITED",
  "INTERVIEW_COMPLETED",
  "INTERVIEW",
  "OFFER",
  "HIRED",
  "REJECTED",
  "NOT_SELECTED",
] as const;

type StatusFilter = (typeof statusOptions)[number];

export default async function ApplicationsPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly q?: string; readonly status?: string }>;
}) {
  const context = await requireHrWorkspaceContext("applications:read");
  const { q, status } = await searchParams;
  const safeStatus = parseStatusFilter(status);
  const applications = await listApplicationsInbox(context, {
    q: q ?? null,
    status: safeStatus === "ALL" ? null : safeStatus,
  });
  const counts = summarizeApplications(applications);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Hiring"
        title="Applications"
        description="A single HR queue for public applications, CV screening, availability, interviews, and final decisions."
        actions={
          <Button asChild>
            <Link href="/jobs">
              <BriefcaseBusiness aria-hidden="true" />
              View jobs
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <InboxMetric label="Total" value={applications.length} icon={<FileSearch />} />
        <InboxMetric label="New" value={counts.newCount} icon={<UserRound />} />
        <InboxMetric label="Screened" value={counts.screenedCount} icon={<Sparkles />} />
        <InboxMetric
          label="Availability"
          value={counts.availabilityCount}
          icon={<CalendarCheck />}
        />
        <InboxMetric label="Reports ready" value={counts.reportReadyCount} icon={<Sparkles />} />
      </div>

      <form
        action="/applications"
        className="grid gap-3 rounded-2xl border border-border bg-surface p-4 shadow-xs lg:grid-cols-[1fr_260px_auto] lg:items-end"
      >
        <Field label="Search applications">
          <TextField name="q" defaultValue={q ?? ""} placeholder="Candidate, email, or job title" />
        </Field>
        <Field label="Status">
          <NativeSelect name="status" defaultValue={safeStatus}>
            {statusOptions.map((option) => (
              <option key={option} value={option}>
                {statusLabel(option)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Button type="submit" variant="secondary">
          <Search aria-hidden="true" />
          Filter
        </Button>
      </form>

      {applications.length === 0 ? (
        <EmptyPanel
          title="No applications found"
          description="Submitted candidate applications will appear here with screening, interview, and report status."
        />
      ) : (
        <div className="grid gap-3">
          {applications.map((application) => (
            <ApplicationInboxCard key={application.id} application={application} />
          ))}
        </div>
      )}
    </div>
  );
}

function ApplicationInboxCard({ application }: { readonly application: ApplicationInboxItem }) {
  const screening = application.cvScreenings.at(0) ?? null;
  const availability = application.availabilityRequests.at(0) ?? null;
  const invitation = application.invitations.at(0) ?? null;
  const interview = application.interviewSessions.at(0) ?? null;
  const transcript = interview?.transcripts.at(0) ?? null;
  const evaluation = interview?.evaluationVersions.at(0) ?? null;
  const report = interview?.hrReports.at(0) ?? null;
  const personalizedPlan = application.personalizedInterviewPlans.at(0) ?? null;

  return (
    <article className="rounded-2xl border border-border bg-surface p-5 shadow-xs transition-colors hover:border-primary/35">
      <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/applications/${application.id}`}
              className="text-base font-semibold text-foreground underline-offset-4 hover:underline"
            >
              {application.candidate.fullName}
            </Link>
            <StatusBadge value={application.status} />
            <StatusBadge value={application.currentStage?.name ?? "Stage not assigned"} />
          </div>
          <p className="mt-1 break-all text-sm text-muted-foreground">
            {application.candidate.primaryEmail ?? "No email"} · {application.job.title} · Applied{" "}
            {formatDate(application.appliedAt)}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <StatusBadge
              value={application.candidate.documents.length > 0 ? "CV uploaded" : "No CV"}
            />
            <StatusBadge value={screeningLabel(screening)} />
            <StatusBadge value={personalizedPlan?.status ?? "No personalized plan"} />
            <StatusBadge value={availability?.status ?? "Availability not requested"} />
            <StatusBadge value={invitation?.status ?? "Invitation not sent"} />
            <StatusBadge value={interview?.status ?? "Interview not started"} />
            <StatusBadge value={transcript?.status ?? "Transcript pending"} />
            <StatusBadge value={evaluation?.status ?? "Evaluation pending"} />
            <StatusBadge value={report?.status ?? "Report pending"} />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Signal label="AI match" value={matchLabel(screening)} />
            <Signal
              label="Recommendation"
              value={normalizeLabel(screening?.recommendation ?? "Not ready")}
            />
            <Signal label="Next step" value={nextStepLabel(application.status, report?.status)} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 xl:justify-end">
          <Button asChild size="sm">
            <Link href={`/applications/${application.id}`}>Open application</Link>
          </Button>
          <Button asChild size="sm" variant="secondary">
            <Link href={`/applications/${application.id}/verification`}>HR review</Link>
          </Button>
          <Button asChild size="sm" variant="secondary">
            <Link href={`/candidates/${application.candidateId}`}>Candidate</Link>
          </Button>
          <Button asChild size="sm" variant="secondary">
            <Link href={`/jobs/${application.jobId}`}>Job</Link>
          </Button>
          {interview === null ? null : (
            <Button asChild size="sm" variant="secondary">
              <Link href={`/interviews/${interview.id}`}>Results</Link>
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

function InboxMetric({
  label,
  value,
  icon,
}: {
  readonly label: string;
  readonly value: number;
  readonly icon: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-xs">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span className="text-primary [&_svg]:size-4">{icon}</span>
      </div>
      <p className="mt-3 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function Signal({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/70 p-3 text-sm">
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold text-foreground">{value}</p>
    </div>
  );
}

function summarizeApplications(applications: readonly ApplicationInboxItem[]) {
  return {
    newCount: applications.filter((application) => application.status === "NEW").length,
    screenedCount: applications.filter((application) =>
      application.cvScreenings.some((screening) => screening.screeningStatus === "COMPLETE"),
    ).length,
    availabilityCount: applications.filter((application) =>
      ["AVAILABILITY_REQUESTED", "AVAILABILITY_CONFIRMED"].includes(application.status),
    ).length,
    reportReadyCount: applications.filter((application) =>
      application.interviewSessions.some((interview) =>
        interview.hrReports.some((report) => report.status === "READY"),
      ),
    ).length,
  };
}

function parseStatusFilter(status: string | undefined): StatusFilter {
  const matched = statusOptions.find((option) => option === status);
  if (matched !== undefined) {
    return matched;
  }
  return "ALL";
}

function statusLabel(status: string): string {
  if (status === "ALL") return "All statuses";
  return status
    .toLowerCase()
    .split("_")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function screeningLabel(screening: ApplicationInboxItem["cvScreenings"][number] | null): string {
  if (screening === null) return "Screening not started";
  if (screening.screeningStatus === "COMPLETE") return "Screening complete";
  if (screening.screeningStatus === "FAILED") return "Screening failed";
  return "Screening pending";
}

function matchLabel(screening: ApplicationInboxItem["cvScreenings"][number] | null): string {
  if (screening?.matchScore === null || screening?.matchScore === undefined) {
    return "Not scored";
  }
  return `${String(screening.matchScore)}/100`;
}

function nextStepLabel(status: string, reportStatus: string | undefined): string {
  if (reportStatus === "READY") return "Review report";
  if (status === "NEW" || status === "IN_REVIEW") return "Review screening";
  if (status === "SHORTLISTED") return "Request availability";
  if (status === "AVAILABILITY_CONFIRMED") return "Send interview";
  if (status === "INTERVIEW" || status === "INTERVIEW_COMPLETED") return "Record HR outcome";
  if (status === "HIRED") return "Handoff recorded";
  if (status === "REJECTED" || status === "NOT_SELECTED") return "Decision recorded";
  return "Track progress";
}
