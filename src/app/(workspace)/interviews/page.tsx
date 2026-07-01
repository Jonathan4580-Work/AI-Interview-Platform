import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requireHrWorkspaceContext } from "@/server/hr-workspace/context";
import { listInterviews } from "@/server/hr-workspace/queries";

import { EmptyPanel, StatusBadge, formatDate } from "../_components/hr-ui";

export default async function InterviewsPage() {
  const context = await requireHrWorkspaceContext("interviews:read");
  const interviews = await listInterviews(context);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Hiring"
        title="Interviews"
        description="Review candidate interview progress, processing status, transcripts, evaluations, and reports."
      />
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
              <Link
                key={interview.id}
                href={`/interviews/${interview.id}`}
                className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Card className="transition-colors hover:border-primary/40 hover:bg-muted/40">
                  <CardContent className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-semibold text-foreground">
                        {interview.candidate.fullName}
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {interview.application?.job.title ?? "No job"} · Updated{" "}
                        {formatDate(interview.updatedAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge value={interview.status} />
                      <StatusBadge value={transcript?.status ?? "Transcript pending"} />
                      <StatusBadge value={evaluation?.status ?? "Evaluation pending"} />
                      <StatusBadge value={reportReady ? "Results ready" : "Report pending"} />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
