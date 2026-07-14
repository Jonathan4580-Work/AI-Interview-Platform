import Link from "next/link";
import { CircleDot, FileText, RadioTower, Sparkles } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { MetricCard } from "@/components/recruiting/recruiting-ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireHrWorkspaceContext } from "@/server/hr-workspace/context";
import { listInterviews } from "@/server/hr-workspace/queries";

import { EmptyPanel, StatusBadge, formatDate } from "../_components/hr-ui";

type InterviewList = Awaited<ReturnType<typeof listInterviews>>;

export default async function InterviewsPage() {
  const context = await requireHrWorkspaceContext("interviews:read");
  const interviews = await listInterviews(context);
  const summary = summarizeInterviews(interviews);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Hiring"
        title="Interviews"
        description="Review candidate interview progress, processing status, transcripts, evaluations, and reports."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Active interviews"
          value={summary.active}
          caption="Started or waiting for completion"
          tone="blue"
          icon={<RadioTower aria-hidden="true" className="size-5" />}
        />
        <MetricCard
          label="Completed"
          value={summary.completed}
          caption="Candidate interview submitted"
          tone="green"
          icon={<CircleDot aria-hidden="true" className="size-5" />}
        />
        <MetricCard
          label="Processing"
          value={summary.processing}
          caption="Transcript/evaluation/report underway"
          tone="amber"
          icon={<Sparkles aria-hidden="true" className="size-5" />}
        />
        <MetricCard
          label="Results ready"
          value={summary.resultsReady}
          caption="Reports available for HR review"
          tone="violet"
          icon={<FileText aria-hidden="true" className="size-5" />}
        />
      </div>

      {interviews.length === 0 ? (
        <EmptyPanel
          title="No interviews yet"
          description="Candidate sessions will appear here after a secure invitation link is opened."
        />
      ) : (
        <div className="grid gap-3">
          {interviews.map((interview) => {
            const reportReady = interview.hrReports.some(
              (report) => report.activeVersionId !== null,
            );
            const transcript = interview.transcripts.at(0);
            const evaluation = interview.evaluationVersions.at(0);
            return (
              <Card key={interview.id} className="transition-colors hover:border-primary/40">
                <CardContent className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/interviews/${interview.id}`}
                        className="block truncate text-base font-semibold text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {interview.candidate.fullName}
                      </Link>
                      <StatusBadge value={interview.status} />
                      <StatusBadge value={reportReady ? "Results ready" : "Report pending"} />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {interview.application?.job.title ?? "No job"} · Updated{" "}
                      {formatDate(interview.updatedAt)}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <StatusBadge value={transcript?.status ?? "Transcript pending"} />
                      <StatusBadge value={evaluation?.status ?? "Evaluation pending"} />
                      <StatusBadge
                        value={interview.application?.currentStage?.name ?? "No stage"}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    {reportReady ? (
                      <Button asChild size="sm">
                        <Link href={`/interviews/${interview.id}`}>View Results</Link>
                      </Button>
                    ) : (
                      <Button asChild size="sm" variant="secondary">
                        <Link href={`/interviews/${interview.id}`}>View Progress</Link>
                      </Button>
                    )}
                    {interview.applicationId === null ? null : (
                      <Button asChild size="sm" variant="secondary">
                        <Link
                          href={`/applications/${interview.applicationId}/verification`}
                          aria-label="Open HR verification"
                        >
                          HR review
                        </Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function summarizeInterviews(interviews: InterviewList) {
  const activeStatuses = new Set([
    "NOT_STARTED",
    "READY_CHECK",
    "READY",
    "IN_PROGRESS",
    "INTERRUPTED",
    "UPLOAD_RECOVERY",
  ]);
  return {
    active: interviews.filter((interview) => activeStatuses.has(interview.status)).length,
    completed: interviews.filter((interview) =>
      ["COMPLETED", "PROCESSING"].includes(interview.status),
    ).length,
    processing: interviews.filter(
      (interview) =>
        !interview.hrReports.some((report) => report.activeVersionId !== null) &&
        ["COMPLETED", "PROCESSING"].includes(interview.status),
    ).length,
    resultsReady: interviews.filter((interview) =>
      interview.hrReports.some((report) => report.activeVersionId !== null),
    ).length,
  };
}
