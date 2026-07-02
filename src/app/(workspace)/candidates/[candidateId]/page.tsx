import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, Pencil, Plus } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createApplicationAction,
  revokeInvitationAction,
  sendInvitationAction,
  updateApplicationStageAction,
} from "@/server/hr-workspace/actions";
import { requireHrWorkspaceContext } from "@/server/hr-workspace/context";
import { listInvitationPreviewSummaries } from "@/server/hr-workspace/invitation-preview";
import { getCandidateDetail, listApplicationChoices } from "@/server/hr-workspace/queries";

import { EmptyPanel, Field, NativeSelect, StatusBadge, formatDate } from "../../_components/hr-ui";
import { InvitationAccessActions } from "./invitation-access-actions";

export default async function CandidateDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly candidateId: string }>;
}) {
  const context = await requireHrWorkspaceContext("candidates:read");
  const { candidateId } = await params;
  const [candidate, choices] = await Promise.all([
    getCandidateDetail(context, candidateId),
    listApplicationChoices(context),
  ]);
  if (candidate === null) notFound();
  const invitationPreviewSummaries = await listInvitationPreviewSummaries(
    context.tenant.companyId,
    candidate.applications.flatMap((application) =>
      application.invitations.map((invitation) => invitation.id),
    ),
  );

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Candidate"
        title={candidate.fullName}
        description={candidate.primaryEmail ?? "No email on file"}
        actions={
          <Button asChild variant="secondary">
            <Link href={`/candidates/${candidate.id}/edit`}>
              <Pencil aria-hidden="true" />
              Edit
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Applications</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {candidate.applications.length === 0 ? (
              <EmptyPanel
                title="No applications"
                description="Attach this candidate to an open job to send an interview invitation."
              />
            ) : (
              candidate.applications.map((application) => (
                <div key={application.id} className="rounded-lg border border-border p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <Link
                        href={`/jobs/${application.job.id}`}
                        className="font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        {application.job.title}
                      </Link>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <StatusBadge value={application.status} />
                        <StatusBadge value={application.currentStage?.name ?? "No stage"} />
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:min-w-96">
                      <form action={updateApplicationStageAction} className="grid gap-2">
                        <input type="hidden" name="applicationId" value={application.id} />
                        <Field label="Stage">
                          <NativeSelect
                            name="stageId"
                            defaultValue={application.currentStageId ?? ""}
                          >
                            <option value="">No stage</option>
                            {choices.jobs
                              .find((job) => job.id === application.jobId)
                              ?.pipeline.stages.map((stage) => (
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
                        <Button type="submit" disabled={candidate.primaryEmail === null}>
                          <Mail aria-hidden="true" />
                          Send invitation
                        </Button>
                      </form>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 text-sm">
                    {application.invitations.map((invitation) => {
                      const previewSummary = invitationPreviewSummaries[invitation.id] ?? null;
                      return (
                        <div
                          key={invitation.id}
                          className="flex flex-col gap-2 rounded-md border border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <p className="text-muted-foreground">
                            <StatusBadge value={invitation.status} /> Expires{" "}
                            {formatDate(invitation.expiresAt)}
                            {previewSummary === null ? null : (
                              <> - {previewSummary.deliveryLabel}</>
                            )}
                          </p>
                          <div className="flex flex-col gap-2 sm:items-end">
                            <InvitationAccessActions
                              invitationId={invitation.id}
                              summary={previewSummary}
                            />
                            {invitation.status === "CANCELLED" ||
                            invitation.status === "ACCEPTED" ||
                            invitation.status === "EXPIRED" ? null : (
                              <form action={revokeInvitationAction}>
                                <input type="hidden" name="invitationId" value={invitation.id} />
                                <Button type="submit" variant="secondary" size="sm">
                                  Revoke invitation
                                </Button>
                              </form>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Attach to job</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createApplicationAction} className="grid gap-4">
              <input type="hidden" name="candidateId" value={candidate.id} />
              <Field label="Job">
                <NativeSelect name="jobId" required>
                  {choices.jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.title}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Initial stage">
                <NativeSelect name="stageId">
                  <option value="">No stage</option>
                  {choices.jobs.flatMap((job) =>
                    job.pipeline.stages.map((stage) => (
                      <option key={`${job.id}:${stage.id}`} value={stage.id}>
                        {job.title} · {stage.name}
                      </option>
                    )),
                  )}
                </NativeSelect>
              </Field>
              <Button type="submit" disabled={choices.jobs.length === 0}>
                <Plus aria-hidden="true" />
                Create application
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Interview history</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {candidate.interviewSessions.length === 0 ? (
            <EmptyPanel title="No interviews" description="Interview sessions will appear here." />
          ) : (
            candidate.interviewSessions.map((interview) => (
              <Link
                key={interview.id}
                href={`/interviews/${interview.id}`}
                className="rounded-md border border-border p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <StatusBadge value={interview.status} /> Updated {formatDate(interview.updatedAt)}
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
