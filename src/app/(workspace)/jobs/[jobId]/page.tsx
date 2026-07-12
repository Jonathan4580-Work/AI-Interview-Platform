import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, Pencil } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { sendInvitationAction, updateApplicationStageAction } from "@/server/hr-workspace/actions";
import { requireHrWorkspaceContext } from "@/server/hr-workspace/context";
import { getJobDetail } from "@/server/hr-workspace/queries";

import { EmptyPanel, Field, NativeSelect, StatusBadge, formatDate } from "../../_components/hr-ui";
import { JobStatusForm } from "./job-status-form";

type JobDetail = NonNullable<Awaited<ReturnType<typeof getJobDetail>>>;
type JobApplication = JobDetail["applications"][number];
type JobStage = JobDetail["pipeline"]["stages"][number];
type CvScreening = JobApplication["cvScreenings"][number];

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
            {job.status === "OPEN" && job.intelligenceProfile?.status === "PUBLISHED" ? (
              <Button asChild variant="secondary">
                <Link href={`/careers/${job.company.slug}/jobs/${job.slug}`}>
                  View public job posting
                </Link>
              </Button>
            ) : null}
            <Button asChild variant="secondary">
              <Link href={`/jobs/${job.id}/review`}>Review JD draft</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href={`/jobs/${job.id}/edit`}>
                <Pencil aria-hidden="true" />
                Edit
              </Link>
            </Button>
            <JobStatusForm jobId={job.id} currentStatus={job.status} />
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

        {job.intelligenceProfile === null ? null : (
          <Card>
            <CardHeader>
              <CardTitle>Job intelligence</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <StatusBadge value={job.intelligenceProfile.status} />
                <StatusBadge value={`${String(job.interviewQuestions.length)} questions`} />
              </div>
              <p className="text-muted-foreground">
                AI-generated draft. Review and publish before sending candidates through this plan.
              </p>
              <Button asChild variant="secondary">
                <Link href={`/jobs/${job.id}/review`}>Open review</Link>
              </Button>
            </CardContent>
          </Card>
        )}

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
              <ApplicationCard
                key={application.id}
                application={application}
                stages={job.pipeline.stages}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ApplicationCard({
  application,
  stages,
}: {
  readonly application: JobApplication;
  readonly stages: readonly JobStage[];
}) {
  const screening = application.cvScreenings.at(0) ?? null;
  const matchScore = screening?.matchScore;
  const recommendation = screening?.recommendation;
  return (
    <div className="rounded-lg border border-border bg-surface p-4 shadow-xs">
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
          {application.candidate.phone === null ? null : (
            <p className="mt-1 break-all text-sm text-muted-foreground">
              {application.candidate.phone}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {application.candidateAccountId === null ? null : (
              <StatusBadge value="Public application" />
            )}
            <StatusBadge value={application.status} />
            <StatusBadge value={application.currentStage?.name ?? "No stage"} />
            <StatusBadge
              value={application.candidate.documents.length > 0 ? "CV uploaded" : "CV not uploaded"}
            />
            <StatusBadge value={screeningLabel(screening)} />
            {matchScore === null || matchScore === undefined ? null : (
              <StatusBadge value={`${String(matchScore)} match score`} />
            )}
            {recommendation === null || recommendation === undefined ? null : (
              <StatusBadge value={recommendation} />
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Applied {formatDate(application.appliedAt)}
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:min-w-96">
          <form action={updateApplicationStageAction} className="grid gap-2">
            <input type="hidden" name="applicationId" value={application.id} />
            <Field label="Pipeline stage">
              <NativeSelect name="stageId" defaultValue={application.currentStageId ?? ""}>
                <option value="">No stage</option>
                {stages.map((stage) => (
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
            <StatusBadge value={invitation.status} /> Expires {formatDate(invitation.expiresAt)}
          </p>
        ))}
      </div>
      <ScreeningDetails screening={screening} />
    </div>
  );
}

function ScreeningDetails({ screening }: { readonly screening: CvScreening | null }) {
  if (screening === null) {
    return (
      <p className="mt-4 rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
        CV screening will start after a public application with CV upload is submitted.
      </p>
    );
  }
  if (screening.screeningStatus === "PENDING") {
    return (
      <p className="mt-4 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
        Screening pending. The local worker will extract CV text and run advisory screening.
      </p>
    );
  }
  if (screening.screeningStatus === "FAILED") {
    return (
      <p className="mt-4 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
        Screening failed:{" "}
        {screening.failureMessageSafe ?? "The screening worker could not complete this CV."}
      </p>
    );
  }
  const isLowQuality =
    screening.extractionQualityScore !== null && screening.extractionQualityScore < 45;
  return (
    <details className="mt-4 rounded-lg border border-border bg-muted/20 p-4">
      <summary className="cursor-pointer text-sm font-medium text-foreground">
        View screening details
      </summary>
      <div className="mt-4 grid gap-4 text-sm">
        <p className="rounded-md border border-info/25 bg-info-soft p-3 text-info">
          AI screening is advisory. HR must review before making decisions.
        </p>
        {isLowQuality ? (
          <p className="rounded-md border border-warning/30 bg-warning/10 p-3 text-warning">
            CV extraction quality is low. Ask candidate to upload a clearer resume. Screening is
            based on limited evidence.
          </p>
        ) : null}
        <DetailBlock
          title="CV extraction quality"
          value={
            screening.extractionQualityScore === null
              ? "Not recorded."
              : `${String(screening.extractionQualityScore)}/100${
                  screening.extractionMetadataRemoved ? " · metadata removed" : ""
                }`
          }
        />
        <DetailBlock title="HR summary" value={screening.hrSummary} />
        <DetailList title="Matched skills" values={jsonStringList(screening.matchedSkillsJson)} />
        <DetailList title="Missing skills" values={jsonStringList(screening.missingSkillsJson)} />
        <DetailBlock title="Experience match" value={screening.experienceMatch} />
        <DetailBlock title="Responsibility match" value={screening.responsibilityMatch} />
        <DetailBlock title="Education/certification match" value={screening.educationMatch} />
        <DetailList title="Concerns" values={jsonStringList(screening.concernsJson)} />
        <DetailList
          title="Suggested interview focus"
          values={jsonStringList(screening.focusAreasJson)}
        />
        <DetailList title="CV evidence excerpts" values={jsonStringList(screening.evidenceJson)} />
        <DetailList title="Limitations" values={jsonStringList(screening.limitationsJson)} />
      </div>
    </details>
  );
}

function DetailBlock({ title, value }: { readonly title: string; readonly value: string | null }) {
  return (
    <div>
      <p className="font-medium text-foreground">{title}</p>
      <p className="mt-1 text-muted-foreground">{value ?? "Not recorded."}</p>
    </div>
  );
}

function DetailList({
  title,
  values,
}: {
  readonly title: string;
  readonly values: readonly string[];
}) {
  return (
    <div>
      <p className="font-medium text-foreground">{title}</p>
      {values.length === 0 ? (
        <p className="mt-1 text-muted-foreground">None recorded.</p>
      ) : (
        <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
          {values.map((value) => (
            <li key={value}>{value}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function screeningLabel(screening: CvScreening | null): string {
  if (screening === null) return "Screening not started";
  if (screening.screeningStatus === "COMPLETE") return "Screening complete";
  if (screening.screeningStatus === "FAILED") return "Screening failed";
  return "Screening pending";
}

function jsonStringList(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function readSummary(value: unknown): string {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return "No summary provided.";
  }
  const summary = (value as { summary?: unknown }).summary;
  return typeof summary === "string" ? summary : "No summary provided.";
}
