import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, Pencil, Plus, RotateCw } from "lucide-react";

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
  const latestResultInterview =
    candidate.interviewSessions.find((interview) => hasCompletedInterview(interview)) ?? null;
  const latestTranscript = latestResultInterview?.transcripts.at(0) ?? null;
  const latestEvaluation = latestResultInterview?.evaluationVersions.at(0) ?? null;
  const latestReport = latestResultInterview?.hrReports.at(0) ?? null;
  const latestReportVersion = latestReport?.activeVersion ?? null;

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
                  {application.invitations[0] ? (
                    <div className="mb-4 rounded-md border border-primary/20 bg-primary/5 p-3">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-foreground">Latest invitation</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {candidateProgressSummary(application.invitations[0], application)}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {candidateProgressBadges(application.invitations[0], application).map(
                            (badge) => (
                              <StatusBadge key={badge} value={badge} />
                            ),
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}
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
                          {application.invitations[0]?.status === "EXPIRED" ||
                          application.invitations[0]?.status === "CANCELLED" ? (
                            <>
                              <RotateCw aria-hidden="true" />
                              Create new invitation
                            </>
                          ) : (
                            "Send invitation"
                          )}
                        </Button>
                      </form>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 text-sm">
                    {application.invitations.map((invitation, index) => {
                      const previewSummary = invitationPreviewSummaries[invitation.id] ?? null;
                      return (
                        <div
                          key={invitation.id}
                          className="flex flex-col gap-2 rounded-md border border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <p className="text-muted-foreground">
                            {index === 0 ? <StatusBadge value="Latest" /> : null}{" "}
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
          <CardTitle>Latest interview result</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {latestResultInterview === null ? (
            <EmptyPanel
              title="No completed interview result"
              description="Transcript, evaluation, and report details will appear here after a candidate completes an interview."
            />
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-4">
                <StatusItem label="Interview status" value={latestResultInterview.status} />
                <StatusItem label="Transcript" value={latestTranscript?.status ?? "Pending"} />
                <StatusItem label="Evaluation" value={latestEvaluation?.status ?? "Pending"} />
                <StatusItem label="Report status" value={latestReport?.status ?? "Pending"} />
              </div>

              <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
                <div className="rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">Transcript</p>
                    <StatusBadge value={latestTranscript?.status ?? "Pending"} />
                  </div>
                  {latestTranscript?.activeVersion?.segments.length ? (
                    <div className="mt-3 grid gap-2">
                      {latestTranscript.activeVersion.segments.map((segment) => (
                        <blockquote
                          key={segment.id}
                          className="border-l-2 border-border pl-3 text-sm text-muted-foreground"
                        >
                          {segment.text}
                        </blockquote>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Transcript segments are still processing.
                    </p>
                  )}
                </div>

                <div className="rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">Evaluation summary</p>
                    <StatusBadge value={latestEvaluation?.status ?? "Pending"} />
                  </div>
                  {latestEvaluation === null ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Evaluation is still processing.
                    </p>
                  ) : (
                    <div className="mt-3 grid gap-3 text-sm">
                      <p className="text-muted-foreground">{latestEvaluation.summary}</p>
                      <div className="flex flex-wrap gap-2">
                        <StatusBadge value={latestEvaluation.overallConfidence} />
                        <StatusBadge value={`Overall ${String(latestEvaluation.overallScore)}`} />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {latestEvaluation === null ? null : (
                <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
                  <div className="rounded-md border border-border p-3">
                    <p className="text-sm font-semibold text-foreground">Scores / competencies</p>
                    <div className="mt-3 grid gap-2">
                      {latestEvaluation.scores.map((score) => (
                        <div
                          key={score.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 p-2 text-sm"
                        >
                          <span className="font-medium text-foreground">{score.label}</span>
                          <span className="text-muted-foreground">
                            {score.score ?? "Incomplete"} / {score.maxScore}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-md border border-border p-3">
                    <p className="text-sm font-semibold text-foreground">Recommendation</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {latestEvaluation.recommendation}
                    </p>
                    <p className="mt-3 text-xs text-muted-foreground">
                      {latestEvaluation.decisionSupportDisclaimer}
                    </p>
                  </div>
                </div>
              )}

              {latestEvaluation === null ? null : (
                <div className="grid gap-4 md:grid-cols-2">
                  <ResultList
                    title="Strengths"
                    items={latestEvaluation.observations
                      .filter((observation) => observation.kind === "STRENGTH")
                      .map((observation) => observation.text)}
                    empty="No strengths have been recorded yet."
                  />
                  <ResultList
                    title="Development areas"
                    items={latestEvaluation.observations
                      .filter((observation) => observation.kind === "DEVELOPMENT_AREA")
                      .map((observation) => observation.text)}
                    empty="No development areas have been recorded yet."
                  />
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/30 p-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Full HR report</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {latestReportVersion === null
                      ? "The report is not ready yet."
                      : "Open the full transcript, evidence, evaluation, and report."}
                  </p>
                </div>
                <Button asChild disabled={latestReportVersion === null}>
                  <Link href={`/interviews/${latestResultInterview.id}`}>View full report</Link>
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

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
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge value={interview.status} />
                  {interviewProcessingBadges(interview).map((badge) => (
                    <StatusBadge key={badge} value={badge} />
                  ))}
                </div>
                <p className="mt-2 text-muted-foreground">
                  Updated {formatDate(interview.updatedAt)}
                </p>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusItem({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="mt-2">
        <StatusBadge value={value} />
      </div>
    </div>
  );
}

function ResultList({
  title,
  items,
  empty,
}: {
  readonly title: string;
  readonly items: readonly string[];
  readonly empty: string;
}) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-2 grid gap-1 text-sm text-muted-foreground">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function candidateProgressSummary(
  invitation: {
    readonly status: string;
    readonly consentRecords: readonly { readonly id: string }[];
    readonly identityVerifications: readonly { readonly id: string }[];
    readonly readinessChecks: readonly { readonly id: string }[];
  },
  application: {
    readonly interviewSessions: readonly {
      readonly status: string;
      readonly transcripts: readonly {
        readonly status: string;
        readonly activeVersionId: string | null;
      }[];
      readonly evaluationVersions: readonly { readonly status: string }[];
      readonly hrReports: readonly { readonly status: string }[];
    }[];
  },
): string {
  const badges = candidateProgressBadges(invitation, application);
  const latest = badges.at(-1) ?? "Invited";
  if (invitation.status === "EXPIRED") {
    return "The latest invitation expired. Create a new invitation when the candidate is ready.";
  }
  if (invitation.status === "CANCELLED") {
    return "The latest invitation was revoked. Create a new invitation to continue.";
  }
  return `Current candidate progress: ${latest}.`;
}

function candidateProgressBadges(
  invitation: {
    readonly status: string;
    readonly consentRecords: readonly { readonly id: string }[];
    readonly identityVerifications: readonly { readonly id: string }[];
    readonly readinessChecks: readonly { readonly id: string }[];
  },
  application: {
    readonly interviewSessions: readonly {
      readonly status: string;
      readonly transcripts: readonly {
        readonly status: string;
        readonly activeVersionId: string | null;
      }[];
      readonly evaluationVersions: readonly { readonly status: string }[];
      readonly hrReports: readonly { readonly status: string }[];
    }[];
  },
): string[] {
  const badges = ["Invited"];
  if (invitation.status === "OPENED" || invitation.status === "ACCEPTED") {
    badges.push("Opened");
  }
  if (invitation.consentRecords.length > 0) {
    badges.push("Consent completed");
  }
  if (invitation.identityVerifications.length > 0) {
    badges.push("Identity completed");
  }
  if (invitation.readinessChecks.length > 0) {
    badges.push("Readiness completed");
  }
  if (
    application.interviewSessions.some((interview) =>
      ["IN_PROGRESS", "INTERRUPTED", "UPLOAD_RECOVERY"].includes(interview.status),
    )
  ) {
    badges.push("Interview in progress");
  }
  if (
    application.interviewSessions.some((interview) =>
      ["COMPLETED", "PROCESSING"].includes(interview.status),
    )
  ) {
    badges.push("Interview completed");
  }
  if (
    application.interviewSessions.some((interview) =>
      interviewProcessingBadges(interview).includes("Transcript ready"),
    )
  ) {
    badges.push("Transcript ready");
  } else if (application.interviewSessions.some((interview) => hasCompletedInterview(interview))) {
    badges.push("Transcript pending");
  }
  if (
    application.interviewSessions.some((interview) =>
      interviewProcessingBadges(interview).includes("Evaluation ready"),
    )
  ) {
    badges.push("Evaluation ready");
  } else if (application.interviewSessions.some((interview) => hasCompletedInterview(interview))) {
    badges.push("Evaluation pending");
  }
  if (
    application.interviewSessions.some((interview) =>
      interview.hrReports.some((report) => report.status === "READY"),
    )
  ) {
    badges.push("Report ready");
  } else if (application.interviewSessions.some((interview) => hasCompletedInterview(interview))) {
    badges.push("Report pending");
  }
  if (invitation.status === "EXPIRED") {
    badges.push("Expired");
  }
  if (invitation.status === "CANCELLED") {
    badges.push("Revoked");
  }
  return badges;
}

function hasCompletedInterview(interview: { readonly status: string }): boolean {
  return ["COMPLETED", "PROCESSING"].includes(interview.status);
}

function interviewProcessingBadges(interview: {
  readonly status: string;
  readonly transcripts: readonly {
    readonly status: string;
    readonly activeVersionId: string | null;
  }[];
  readonly evaluationVersions: readonly { readonly status: string }[];
  readonly hrReports: readonly { readonly status: string }[];
}): string[] {
  if (!hasCompletedInterview(interview)) {
    return [];
  }
  return [
    interview.transcripts.some(
      (transcript) => transcript.status === "READY" && transcript.activeVersionId !== null,
    )
      ? "Transcript ready"
      : "Transcript pending",
    interview.evaluationVersions.some((evaluation) => evaluation.status === "READY")
      ? "Evaluation ready"
      : "Evaluation pending",
    interview.hrReports.some((report) => report.status === "READY")
      ? "Report ready"
      : "Report pending",
  ];
}
