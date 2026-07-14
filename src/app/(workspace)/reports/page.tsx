import { BarChart3, FileText, GitCompareArrows, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";

import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { MetricCard, SectionCard } from "@/components/recruiting/recruiting-ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireHrWorkspaceContext } from "@/server/hr-workspace/context";
import { getReportsOverviewData, listRecentCandidateReports } from "@/server/hr-workspace/queries";

import { EmptyPanel, StatusBadge, formatDate } from "../_components/hr-ui";

const reportSections = [
  {
    title: "Aggregate reports",
    icon: BarChart3,
    description:
      "Bounded enterprise summaries for pipeline, delivery, completion, processing, and review activity.",
    status: "Enterprise module",
  },
  {
    title: "Candidate comparison",
    icon: GitCompareArrows,
    description: "Side-by-side role context remains non-ranking and human-reviewed when enabled.",
    status: "Controlled view",
  },
  {
    title: "Compliance reports",
    icon: FileText,
    description: "Access and export activity designed for auditable review workflows.",
    status: "Enterprise module",
  },
] as const;

export default async function ReportsPage() {
  const context = await requireHrWorkspaceContext("reports:read");
  const [overview, recentReports] = await Promise.all([
    getReportsOverviewData(context),
    listRecentCandidateReports(context),
  ]);

  return (
    <ContentContainer className="gap-6">
      <PageHeader
        eyebrow="Reporting"
        title="Hiring reports"
        description="Review completed interview reports, evaluation readiness, and human decision activity."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Ready reports"
          value={overview.readyReports}
          caption="Completed HR reports available now"
          tone="blue"
          icon={<FileText aria-hidden="true" className="size-5" />}
        />
        <MetricCard
          label="Needs HR review"
          value={overview.unreviewedEvaluations}
          caption="Ready evaluations not yet reviewed"
          tone="amber"
          icon={<ShieldCheck aria-hidden="true" className="size-5" />}
        />
        <MetricCard
          label="Processing queue"
          value={overview.completedWithoutReport}
          caption="Completed interviews awaiting reports"
          tone="violet"
          icon={<Sparkles aria-hidden="true" className="size-5" />}
        />
        <MetricCard
          label="Human decisions"
          value={overview.humanDecisions}
          caption="Recorded HR-owned decision events"
          tone="green"
          icon={<BarChart3 aria-hidden="true" className="size-5" />}
        />
      </div>

      <SectionCard
        title="Recent candidate reports"
        description="Candidate-level reports generated from completed interviews. AI output is decision support only."
      >
        <div className="grid gap-3">
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
                  className="grid gap-4 rounded-2xl border border-border bg-surface/80 p-4 shadow-xs lg:grid-cols-[1fr_auto] lg:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold text-foreground">
                        {interview.candidate.fullName}
                      </p>
                      <StatusBadge value={report.status} />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {interview.application?.job.title ?? "No job"} · Completed{" "}
                      {formatDate(interview.completedAt)}
                    </p>
                    <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
                      {report.activeVersion?.executiveSummary ??
                        "Report summary will appear when the active report version is ready."}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <StatusBadge value={evaluation?.status ?? "Evaluation ready"} />
                      {evaluation?.overallScore === null ||
                      evaluation?.overallScore === undefined ? null : (
                        <StatusBadge value={`Score ${String(evaluation.overallScore)}`} />
                      )}
                      {evaluation?.overallConfidence ? (
                        <StatusBadge value={evaluation.overallConfidence} />
                      ) : null}
                      {evaluation?.reviewStatus ? (
                        <StatusBadge value={evaluation.reviewStatus} />
                      ) : null}
                    </div>
                    {evaluation?.recommendation === null ||
                    evaluation?.recommendation === undefined ? null : (
                      <p className="mt-2 text-sm font-medium text-foreground">
                        {evaluation.recommendation}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <Button asChild size="sm">
                      <Link href={`/interviews/${interview.id}`}>View report</Link>
                    </Button>
                    {interview.application === null ? null : (
                      <Button asChild size="sm" variant="secondary">
                        <Link href={`/applications/${interview.application.id}/verification`}>
                          HR review
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-3">
        {reportSections.map((section) => {
          const Icon = section.icon;
          return (
            <Card key={section.title} className="bg-muted/20">
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
