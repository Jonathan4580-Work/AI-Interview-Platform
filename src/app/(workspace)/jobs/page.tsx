import Link from "next/link";
import { Plus } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireHrWorkspaceContext } from "@/server/hr-workspace/context";
import { listJobs } from "@/server/hr-workspace/queries";

import { EmptyPanel, StatusBadge, formatDate } from "../_components/hr-ui";

export default async function JobsPage() {
  const context = await requireHrWorkspaceContext("jobs:read");
  const jobs = await listJobs(context);

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
      {jobs.length === 0 ? (
        <EmptyPanel
          title="No jobs yet"
          description="Create your first job with a published interview plan to begin inviting candidates."
        />
      ) : (
        <div className="grid gap-3">
          {jobs.map((job) => (
            <Link
              key={job.id}
              href={`/jobs/${job.id}`}
              className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="transition-colors hover:border-primary/40 hover:bg-muted/40">
                <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-base font-semibold text-foreground">
                        {job.title}
                      </h2>
                      <StatusBadge value={job.status} />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {job.applications.length} applications · {job.plans.length} interview plans ·
                      Updated {formatDate(job.updatedAt)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
