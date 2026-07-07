import { BarChart3, FileText, GitCompareArrows } from "lucide-react";
import Link from "next/link";

import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireHrWorkspaceContext } from "@/server/hr-workspace/context";
import { listRecentCandidateReports } from "@/server/hr-workspace/queries";

import { EmptyPanel, StatusBadge, formatDate } from "../_components/hr-ui";

const reportSections = [
  {
    title: "Aggregate reports",
    icon: BarChart3,
    description:
      "Bounded enterprise summaries for pipeline, delivery, completion, processing, and review activity.",
    status: "Enterprise reports",
  },
  {
    title: "Candidate comparison",
    icon: GitCompareArrows,
    description:
      "Side-by-side role context without rankings, recommendations, or automated decisions.",
    status: "Coming soon",
  },
  {
    title: "Compliance reports",
    icon: FileText,
    description: "Access and export activity designed for auditable review workflows.",
    status: "Enterprise reports",
  },
] as const;

export default async function ReportsPage() {
  const context = await requireHrWorkspaceContext("reports:read");
  const recentReports = await listRecentCandidateReports(context);

  return (
    <ContentContainer className="gap-6">
      <PageHeader
        eyebrow="Reporting"
        title="Reports"
        description="Open completed candidate reports and review enterprise reporting surfaces."
      />

      <Card>
        <CardHeader>
          <CardTitle>Recent candidate reports</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {recentReports.length === 0 ? (
            <EmptyPanel
              title="No ready candidate reports"
              description="Completed interview reports will appear here after transcription, evaluation, and report generation finish."
            />
          ) : (
            recentReports.map((report) => {
              const interview = report.interviewSession;
              const evaluation = interview.evaluationVersions.at(0);
              return (
                <div
                  key={report.id}
                  className="grid gap-3 rounded-md border border-border p-3 lg:grid-cols-[1fr_auto] lg:items-center"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">
                      {interview.candidate.fullName}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {interview.application?.job.title ?? "No job"} · Completed{" "}
                      {formatDate(interview.completedAt)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <StatusBadge value={evaluation?.status ?? "Evaluation ready"} />
                      <StatusBadge value={report.status} />
                      {evaluation?.overallConfidence ? (
                        <StatusBadge value={evaluation.overallConfidence} />
                      ) : null}
                    </div>
                  </div>
                  <Button asChild size="sm">
                    <Link href={`/interviews/${interview.id}`}>View report</Link>
                  </Button>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {reportSections.map((section) => {
          const Icon = section.icon;
          return (
            <Card key={section.title}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
                  {section.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <StatusBadge value={section.status} />
                <p className="text-sm text-muted-foreground">{section.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </ContentContainer>
  );
}
