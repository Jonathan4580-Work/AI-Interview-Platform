import Link from "next/link";
import { BriefcaseBusiness, FileText, Plus, UsersRound } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { MetricCard } from "@/components/recruiting/recruiting-ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireHrWorkspaceContext } from "@/server/hr-workspace/context";
import { listJobs } from "@/server/hr-workspace/queries";

import { EmptyPanel, StatusBadge, formatDate } from "../_components/hr-ui";

type JobList = Awaited<ReturnType<typeof listJobs>>;

export default async function JobsPage() {
  const context = await requireHrWorkspaceContext("jobs:read");
  const jobs = await listJobs(context);
  const jobSummary = summarizeJobs(jobs);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Hiring"
        title="Jobs"
        description="Create roles, publish interview plans, and manage candidate applications."
        actions={
          <Button asChild>
            <Link href="/jobs/new">
              <Plus aria-hidden="true" />
              Create job
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Open jobs"
          value={jobSummary.openJobs}
          caption="Visible hiring roles"
          tone="blue"
          icon={<BriefcaseBusiness aria-hidden="true" className="size-5" />}
        />
        <MetricCard
          label="Applications"
          value={jobSummary.applications}
          caption="Across active job records"
          tone="green"
          icon={<UsersRound aria-hidden="true" className="size-5" />}
        />
        <MetricCard
          label="Published plans"
          value={jobSummary.publishedPlans}
          caption="Ready interview plans"
          tone="violet"
          icon={<FileText aria-hidden="true" className="size-5" />}
        />
        <MetricCard
          label="Needs plan"
          value={jobSummary.needsPlan}
          caption="Jobs without active plans"
          tone="amber"
          icon={<FileText aria-hidden="true" className="size-5" />}
        />
      </div>

      {jobs.length === 0 ? (
        <EmptyPanel
          title="No jobs yet"
          description="Create your first job with a published interview plan to begin inviting candidates."
        />
      ) : (
        <div className="grid gap-3">
          {jobs.map((job) => {
            const activePlans = job.plans.filter(
              (plan) => plan.status === "ACTIVE" && plan.activeVersionId !== null,
            );
            return (
              <Card key={job.id} className="transition-colors hover:border-primary/40">
                <CardContent className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/jobs/${job.id}`}
                        className="truncate text-base font-semibold text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {job.title}
                      </Link>
                      <StatusBadge value={job.status} />
                      <StatusBadge
                        value={activePlans.length > 0 ? "Interview plan ready" : "Plan needed"}
                      />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {job.applications.length} applications · {job.plans.length} interview plans ·
                      Updated {formatDate(job.updatedAt)}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <StatusBadge value={`${String(activePlans.length)} published plans`} />
                      <StatusBadge value={`${String(job.applications.length)} applications`} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <Button asChild size="sm">
                      <Link href={`/jobs/${job.id}`}>Open job</Link>
                    </Button>
                    <Button asChild size="sm" variant="secondary">
                      <Link href={`/jobs/${job.id}/review`}>Review plan</Link>
                    </Button>
                    <Button asChild size="sm" variant="secondary">
                      <Link href={`/jobs/${job.id}/edit`}>Edit</Link>
                    </Button>
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

function summarizeJobs(jobs: JobList) {
  return {
    openJobs: jobs.filter((job) => job.status === "OPEN").length,
    applications: jobs.reduce((total, job) => total + job.applications.length, 0),
    publishedPlans: jobs.reduce(
      (total, job) =>
        total +
        job.plans.filter((plan) => plan.status === "ACTIVE" && plan.activeVersionId !== null)
          .length,
      0,
    ),
    needsPlan: jobs.filter(
      (job) => !job.plans.some((plan) => plan.status === "ACTIVE" && plan.activeVersionId !== null),
    ).length,
  };
}
