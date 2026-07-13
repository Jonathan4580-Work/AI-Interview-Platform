import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarClock,
  FileText,
  MessageSquareText,
  UserRound,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { AIInsightCard, ChipList, SectionCard } from "@/components/recruiting/recruiting-ui";
import { Button } from "@/components/ui/button";
import { requireHrWorkspaceContext } from "@/server/hr-workspace/context";
import { getApplicationVerificationDetail } from "@/server/hr-workspace/queries";

import { EmptyPanel, StatusBadge, formatDate } from "../../_components/hr-ui";

type ApplicationDetail = NonNullable<Awaited<ReturnType<typeof getApplicationVerificationDetail>>>;
type Screening = ApplicationDetail["cvScreenings"][number];

export default async function ApplicationCommandCenterPage({
  params,
}: {
  readonly params: Promise<{ readonly applicationId: string }>;
}) {
  const context = await requireHrWorkspaceContext("applications:read");
  const { applicationId } = await params;
  const application = await getApplicationVerificationDetail(context, applicationId);
  if (application === null) notFound();

  const screening = application.cvScreenings.at(0) ?? null;
  const personalizedPlan = application.personalizedInterviewPlans.at(0) ?? null;
  const latestInvitation = application.invitations.at(0) ?? null;
  const latestInterview = application.interviewSessions.at(0) ?? null;
  const transcript = latestInterview?.transcripts.at(0) ?? null;
  const evaluation = latestInterview?.evaluationVersions.at(0) ?? null;
  const report = latestInterview?.hrReports.at(0) ?? null;
  const latestAvailability = application.availabilityRequests.at(0) ?? null;
  const finalOutcome = readFinalOutcome(application.metadataJson, application.status);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Application"
        title={`${application.candidate.fullName} for ${application.job.title}`}
        description="One place to follow the candidate from application through screening, interview, and final handoff."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <Link href={`/jobs/${application.jobId}`}>
                <ArrowLeft aria-hidden="true" />
                Job
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href={`/candidates/${application.candidateId}`}>Candidate</Link>
            </Button>
            <Button asChild>
              <Link href={`/applications/${application.id}/verification`}>Open HR review</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard title="Application summary" description="Candidate, job, and current state.">
          <div className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-2">
              <SummaryBlock
                icon={<UserRound aria-hidden="true" />}
                label="Candidate"
                value={application.candidate.fullName}
                detail={application.candidate.primaryEmail ?? "No email on file"}
              />
              <SummaryBlock
                icon={<BriefcaseBusiness aria-hidden="true" />}
                label="Job"
                value={application.job.title}
                detail={`Applied ${formatDate(application.appliedAt)}`}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge value={application.status} />
              <StatusBadge value={application.currentStage?.name ?? "No stage"} />
              <StatusBadge
                value={application.candidate.documents.length > 0 ? "CV uploaded" : "No CV"}
              />
              <StatusBadge value={screeningStatus(screening)} />
              <StatusBadge value={personalizedPlan?.status ?? "No personalized plan"} />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Next action" description="Recommended operational step for HR.">
          <NextAction
            applicationStatus={application.status}
            hasScreening={screening !== null}
            screeningStatus={screening?.screeningStatus ?? null}
            availabilityStatus={latestAvailability?.status ?? null}
            invitationStatus={latestInvitation?.status ?? null}
            interviewStatus={latestInterview?.status ?? null}
            reportReady={report?.status === "READY" && report.activeVersion !== null}
            applicationId={application.id}
            interviewId={latestInterview?.id ?? null}
          />
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        <PipelineMetric label="CV screening" value={screeningStatus(screening)} />
        <PipelineMetric
          label="Availability"
          value={latestAvailability?.status ?? "Not requested"}
        />
        <PipelineMetric label="Invitation" value={latestInvitation?.status ?? "Not sent"} />
        <PipelineMetric label="Interview" value={latestInterview?.status ?? "Not started"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_0.85fr]">
        <ScreeningSnapshot screening={screening} />
        <SectionCard
          title="Interview and report"
          description="Processing state for completed interviews."
        >
          {latestInterview === null ? (
            <EmptyPanel
              title="No interview yet"
              description="Interview evidence appears after the candidate opens the secure invitation and completes the interview."
            />
          ) : (
            <div className="grid gap-3 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <PipelineMetric label="Interview" value={latestInterview.status} compact />
                <PipelineMetric
                  label="Transcript"
                  value={transcript?.status ?? "Pending"}
                  compact
                />
                <PipelineMetric
                  label="Evaluation"
                  value={evaluation?.status ?? "Pending"}
                  compact
                />
                <PipelineMetric label="Report" value={report?.status ?? "Pending"} compact />
              </div>
              {evaluation === null ? (
                <p className="text-muted-foreground">Evaluation is still processing.</p>
              ) : (
                <AIInsightCard title="Evaluation snapshot">
                  <p className="text-sm text-muted-foreground">{evaluation.summary}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <StatusBadge value={`Overall ${String(evaluation.overallScore ?? "n/a")}`} />
                    <StatusBadge value={evaluation.overallConfidence} />
                  </div>
                </AIInsightCard>
              )}
              <Button asChild>
                <Link href={`/interviews/${latestInterview.id}`}>View interview results</Link>
              </Button>
            </div>
          )}
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.85fr_1fr]">
        <SectionCard title="Decision and handoff" description="Human-owned final status.">
          {finalOutcome === null ? (
            <EmptyPanel
              title="No final decision"
              description="Record final HR interview outcomes from the HR review page."
            />
          ) : (
            <div className="rounded-xl border border-border bg-surface p-4 text-sm">
              <div className="flex flex-wrap gap-2">
                <StatusBadge value={finalOutcome.decision} />
                {finalOutcome.onboardingDate === null ? null : (
                  <StatusBadge value={`Onboarding ${finalOutcome.onboardingDate}`} />
                )}
              </div>
              <p className="mt-3 text-muted-foreground">
                Final outcome recorded by HR. AI screening, interview evaluation, and monitoring
                warnings remain decision-support context only.
              </p>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Decision history" description="Append-only HR trail.">
          {application.decisionHistory.length === 0 ? (
            <EmptyPanel
              title="No decisions yet"
              description="HR decisions and notes appear here."
            />
          ) : (
            <div className="grid gap-2">
              {application.decisionHistory.slice(0, 5).map((decision) => (
                <div key={decision.id} className="rounded-xl border border-border p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <StatusBadge value={decision.decision} />
                    <span className="text-muted-foreground">{formatDate(decision.createdAt)}</span>
                  </div>
                  <p className="mt-2 text-muted-foreground">
                    {decision.note ?? "No note recorded."}
                  </p>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function SummaryBlock({
  icon,
  label,
  value,
  detail,
}: {
  readonly icon: ReactNode;
  readonly label: string;
  readonly value: string;
  readonly detail: string;
}) {
  return (
    <div className="flex gap-3 rounded-xl border border-border bg-background/70 p-4">
      <div className="mt-0.5 text-primary">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
        <p className="mt-1 truncate font-semibold text-foreground">{value}</p>
        <p className="mt-1 break-all text-sm text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

function PipelineMetric({
  label,
  value,
  compact = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly compact?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-xs">
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <div className={compact ? "mt-2" : "mt-4"}>
        <StatusBadge value={value} />
      </div>
    </div>
  );
}

function NextAction({
  applicationStatus,
  hasScreening,
  screeningStatus,
  availabilityStatus,
  invitationStatus,
  interviewStatus,
  reportReady,
  applicationId,
  interviewId,
}: {
  readonly applicationStatus: string;
  readonly hasScreening: boolean;
  readonly screeningStatus: string | null;
  readonly availabilityStatus: string | null;
  readonly invitationStatus: string | null;
  readonly interviewStatus: string | null;
  readonly reportReady: boolean;
  readonly applicationId: string;
  readonly interviewId: string | null;
}) {
  const item = nextActionText({
    applicationStatus,
    hasScreening,
    screeningStatus,
    availabilityStatus,
    invitationStatus,
    interviewStatus,
    reportReady,
  });
  return (
    <div className="grid gap-4">
      <div className="flex gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div className="text-primary">{item.icon}</div>
        <div>
          <p className="font-semibold text-foreground">{item.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href={`/applications/${applicationId}/verification`}>{item.cta}</Link>
        </Button>
        {interviewId === null ? null : (
          <Button asChild variant="secondary">
            <Link href={`/interviews/${interviewId}`}>View report</Link>
          </Button>
        )}
      </div>
    </div>
  );
}

function nextActionText(input: {
  readonly applicationStatus: string;
  readonly hasScreening: boolean;
  readonly screeningStatus: string | null;
  readonly availabilityStatus: string | null;
  readonly invitationStatus: string | null;
  readonly interviewStatus: string | null;
  readonly reportReady: boolean;
}): {
  readonly title: string;
  readonly description: string;
  readonly cta: string;
  readonly icon: ReactNode;
} {
  if (input.reportReady) {
    return {
      title: "Review completed results",
      description: "Transcript, evaluation, evidence, and report are ready for HR review.",
      cta: "Open HR review",
      icon: <FileText aria-hidden="true" />,
    };
  }
  if (input.interviewStatus === "COMPLETED" || input.interviewStatus === "PROCESSING") {
    return {
      title: "Processing interview evidence",
      description: "The worker is preparing transcript, evaluation, and report artifacts.",
      cta: "Check HR review",
      icon: <MessageSquareText aria-hidden="true" />,
    };
  }
  if (input.invitationStatus !== null) {
    return {
      title: "Candidate invitation active",
      description: "Track whether the candidate opens the secure link and completes the interview.",
      cta: "Manage invitation",
      icon: <MessageSquareText aria-hidden="true" />,
    };
  }
  if (input.availabilityStatus === "CONFIRMED") {
    return {
      title: "Generate and send interview",
      description: "Availability is confirmed. Review the personalized plan and send the invite.",
      cta: "Prepare invite",
      icon: <CalendarClock aria-hidden="true" />,
    };
  }
  if (input.applicationStatus === "SHORTLISTED") {
    return {
      title: "Request availability",
      description: "Candidate is shortlisted. Send available interview slots to keep momentum.",
      cta: "Request availability",
      icon: <CalendarClock aria-hidden="true" />,
    };
  }
  if (input.hasScreening && input.screeningStatus === "COMPLETE") {
    return {
      title: "Review screening evidence",
      description: "AI CV screening is ready. HR should review evidence before shortlisting.",
      cta: "Open HR review",
      icon: <FileText aria-hidden="true" />,
    };
  }
  return {
    title: "Wait for screening",
    description: "The application is captured. Screening and HR review actions appear here.",
    cta: "Open HR review",
    icon: <FileText aria-hidden="true" />,
  };
}

function ScreeningSnapshot({ screening }: { readonly screening: Screening | null }) {
  if (screening === null) {
    return (
      <SectionCard title="AI CV screening" description="Advisory screening summary.">
        <EmptyPanel
          title="Screening not started"
          description="Screening appears after a candidate uploads a resume."
        />
      </SectionCard>
    );
  }
  const lowQuality =
    screening.extractionQualityScore !== null && screening.extractionQualityScore < 45;
  return (
    <SectionCard title="AI CV screening" description="Decision support only.">
      <AIInsightCard title="Screening snapshot">
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Match" value={`${String(screening.matchScore ?? "n/a")}/100`} />
          <Metric label="Recommendation" value={screening.recommendation ?? "Not recorded"} />
          <Metric label="Confidence" value={screening.confidence ?? "Not recorded"} />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {screening.hrSummary ?? "No HR summary recorded."}
        </p>
      </AIInsightCard>
      {lowQuality ? (
        <p className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
          CV extraction quality is low. Ask the candidate to upload DOCX or a selectable text PDF.
        </p>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <ChipBlock title="Matched skills" values={jsonStringList(screening.matchedSkillsJson)} />
        <ChipBlock title="Missing skills" values={jsonStringList(screening.missingSkillsJson)} />
      </div>
    </SectionCard>
  );
}

function Metric({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/70 p-3">
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function ChipBlock({
  title,
  values,
}: {
  readonly title: string;
  readonly values: readonly string[];
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <div className="mt-2">
        <ChipList values={values} />
      </div>
    </div>
  );
}

function screeningStatus(screening: Screening | null): string {
  if (screening === null) return "Screening not started";
  if (screening.screeningStatus === "COMPLETE") return "Screening complete";
  if (screening.screeningStatus === "FAILED") return "Screening failed";
  return "Screening pending";
}

function readFinalOutcome(
  value: unknown,
  status: string,
): {
  readonly decision: "HIRED" | "REJECTED";
  readonly onboardingDate: string | null;
} | null {
  if (status !== "HIRED" && status !== "REJECTED" && status !== "NOT_SELECTED") {
    return null;
  }
  const decision = status === "HIRED" ? "HIRED" : "REJECTED";
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { decision, onboardingDate: null };
  }
  const outcome = (value as Record<string, unknown>).hrInterviewOutcome;
  if (typeof outcome !== "object" || outcome === null || Array.isArray(outcome)) {
    return { decision, onboardingDate: null };
  }
  const onboardingDate = (outcome as Record<string, unknown>).onboardingDate;
  return {
    decision,
    onboardingDate:
      typeof onboardingDate === "string" && onboardingDate.length > 0 ? onboardingDate : null,
  };
}

function jsonStringList(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}
