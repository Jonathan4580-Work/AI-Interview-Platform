import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, Pencil } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  sendInvitationAction,
  setJobStatusAction,
  updateApplicationStageAction,
} from "@/server/hr-workspace/actions";
import { requireHrWorkspaceContext } from "@/server/hr-workspace/context";
import { getJobDetail } from "@/server/hr-workspace/queries";

import { EmptyPanel, Field, NativeSelect, StatusBadge, formatDate } from "../../_components/hr-ui";

export default async function JobDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly jobId: string }>;
}) {
  const context = await requireHrWorkspaceContext("jobs:read");
  const { jobId } = await params;
  const job = await getJobDetail(context, jobId);
  if (job === null) notFound();

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Job"
        title={job.title}
        description={`${String(job.applications.length)} applications · Updated ${formatDate(job.updatedAt)}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <Link href={`/jobs/${job.id}/edit`}>
                <Pencil aria-hidden="true" />
                Edit
              </Link>
            </Button>
            <form action={setJobStatusAction}>
              <input type="hidden" name="jobId" value={job.id} />
              <input
                type="hidden"
                name="status"
                value={job.status === "OPEN" ? "CLOSED" : "OPEN"}
              />
              <Button type="submit" variant="secondary">
                {job.status === "OPEN" ? "Close job" : "Activate job"}
              </Button>
            </form>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_0.7fr]">
        <Card>
          <CardHeader>
            <CardTitle>Role summary</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="flex flex-wrap gap-2">
              <StatusBadge value={job.status} />
              <StatusBadge value={job.employmentType} />
              <StatusBadge value={job.workplaceType} />
              <StatusBadge value={job.seniorityLevel} />
            </div>
            <p className="text-muted-foreground">{readSummary(job.descriptionJson)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Interview plan</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {job.plans.length === 0 ? (
              <EmptyPanel
                title="No plan"
                description="Create an interview plan before inviting candidates."
              />
            ) : (
              job.plans.map((plan) => (
                <div key={plan.id} className="rounded-md border border-border p-3">
                  <p className="font-medium text-foreground">{plan.name}</p>
                  <p className="mt-1 text-muted-foreground">
                    {plan.versions.length} versions · Active version{" "}
                    {plan.activeVersionId === null ? "not set" : "published"}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Candidates and applications</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {job.applications.length === 0 ? (
            <EmptyPanel
              title="No applications"
              description="Add a candidate and attach them to this job to send an invitation."
            />
          ) : (
            job.applications.map((application) => (
              <div key={application.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <Link
                      href={`/candidates/${application.candidate.id}`}
                      className="font-medium text-foreground underline-offset-4 hover:underline"
                    >
                      {application.candidate.fullName}
                    </Link>
                    <p className="mt-1 break-all text-sm text-muted-foreground">
                      {application.candidate.primaryEmail ?? "No email"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <StatusBadge value={application.status} />
                      <StatusBadge value={application.currentStage?.name ?? "No stage"} />
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:min-w-96">
                    <form action={updateApplicationStageAction} className="grid gap-2">
                      <input type="hidden" name="applicationId" value={application.id} />
                      <Field label="Pipeline stage">
                        <NativeSelect
                          name="stageId"
                          defaultValue={application.currentStageId ?? ""}
                        >
                          <option value="">No stage</option>
                          {job.pipeline.stages.map((stage) => (
                            <option key={stage.id} value={stage.id}>
                              {stage.name}
                            </option>
                          ))}
                        </NativeSelect>
                      </Field>
                      <Button type="submit" variant="secondary">
                        Update stage
                      </Button>
                    </form>
                    <form action={sendInvitationAction} className="grid gap-2">
                      <input type="hidden" name="applicationId" value={application.id} />
                      <Field label="Invitation expiry">
                        <NativeSelect name="expiresInHours" defaultValue="72">
                          <option value="72">3 days</option>
                          <option value="24">1 day</option>
                          <option value="168">7 days</option>
                        </NativeSelect>
                      </Field>
                      <Button type="submit" disabled={application.candidate.primaryEmail === null}>
                        <Mail aria-hidden="true" />
                        Send invitation
                      </Button>
                    </form>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 text-sm text-muted-foreground">
                  <p>{application.invitations.length} recent invitations</p>
                  {application.invitations.map((invitation) => (
                    <p key={invitation.id}>
                      <StatusBadge value={invitation.status} /> Expires{" "}
                      {formatDate(invitation.expiresAt)}
                    </p>
                  ))}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function readSummary(value: unknown): string {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return "No summary provided.";
  }
  const summary = (value as { summary?: unknown }).summary;
  return typeof summary === "string" ? summary : "No summary provided.";
}
