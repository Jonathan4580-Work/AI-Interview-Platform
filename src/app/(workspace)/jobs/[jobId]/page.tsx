import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarPlus, Mail, Pencil } from "lucide-react";

import { PendingSubmitButton } from "@/components/forms/pending-submit-button";
import { PageHeader } from "@/components/layout/page-header";
import { AIInsightCard, ChipList, SectionCard } from "@/components/recruiting/recruiting-ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createAvailabilitySlotAction,
  generatePersonalizedInterviewAction,
  markApplicationNotSelectedAction,
  regeneratePersonalizedInterviewAction,
  returnApplicationToReviewAction,
  sendAvailabilityRequestAction,
  sendInvitationAction,
  shortlistApplicationAction,
  updateApplicationStageAction,
} from "@/server/hr-workspace/actions";
import { requireHrWorkspaceContext } from "@/server/hr-workspace/context";
import { getJobDetail } from "@/server/hr-workspace/queries";
import {
  createAvailabilityRequestToken,
  createAvailabilityRequestUrl,
} from "@/modules/availability/tokens";

import { EmptyPanel, Field, NativeSelect, StatusBadge, formatDate } from "../../_components/hr-ui";
import { JobStatusForm } from "./job-status-form";

type JobDetail = NonNullable<Awaited<ReturnType<typeof getJobDetail>>>;
type JobApplication = JobDetail["applications"][number];
type JobStage = JobDetail["pipeline"]["stages"][number];
type CvScreening = JobApplication["cvScreenings"][number];
type AvailabilitySlot = JobDetail["availabilitySlots"][number];

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

      <AvailabilitySlotsCard jobId={job.id} slots={job.availabilitySlots} />

      <SectionCard
        title="Candidates and applications"
        description="Review public applications, advisory screening, HR decisions, availability, and interview invitations."
      >
        <div className="grid gap-3">
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
        </div>
      </SectionCard>
    </div>
  );
}

function AvailabilitySlotsCard({
  jobId,
  slots,
}: {
  readonly jobId: string;
  readonly slots: readonly AvailabilitySlot[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarPlus aria-hidden="true" className="size-4" />
          Availability slots
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <form
          action={createAvailabilitySlotAction}
          className="grid gap-3 rounded-lg border border-border bg-muted/20 p-4 md:grid-cols-[1fr_1fr_1fr_1.5fr_auto]"
        >
          <input type="hidden" name="jobId" value={jobId} />
          <Field label="Date">
            <input
              required
              name="slotDate"
              type="date"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            />
          </Field>
          <Field label="Start">
            <input
              required
              name="startTime"
              type="time"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            />
          </Field>
          <Field label="End">
            <input
              required
              name="endTime"
              type="time"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            />
          </Field>
          <Field label="Meeting note">
            <input
              name="locationNote"
              placeholder="Online interview"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            />
          </Field>
          <PendingSubmitButton pendingLabel="Adding..." className="self-end">
            Add slot
          </PendingSubmitButton>
        </form>
        {slots.length === 0 ? (
          <EmptyPanel
            title="No availability slots"
            description="Create one or more slots before requesting candidate availability."
          />
        ) : (
          <div className="grid gap-2">
            {slots.map((slot) => (
              <div
                key={slot.id}
                className="flex flex-col gap-2 rounded-md border border-border p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-foreground">
                    {formatDateTime(slot.startAt)} - {formatTime(slot.endAt)}
                  </p>
                  <p className="text-muted-foreground">{slot.locationNote ?? "Online interview"}</p>
                </div>
                <StatusBadge value={slot.status} />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
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
  const activeAvailability = application.availabilityRequests.find(
    (request) => request.status === "ACTIVE",
  );
  const confirmedAvailability = application.availabilityRequests.find(
    (request) => request.status === "CONFIRMED",
  );
  const personalizedPlan = application.personalizedInterviewPlans.at(0) ?? null;
  const personalizedReady =
    personalizedPlan?.status === "READY" &&
    personalizedPlan.personalizedInterviewPlanVersionId !== null;
  const finalOutcome = readFinalOutcome(application.metadataJson, application.status);
  return (
    <div className="rounded-2xl border border-border/80 bg-gradient-to-br from-surface to-primary-soft/30 p-5 shadow-sm">
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
              <StatusBadge value={`AI: ${recommendation}`} />
            )}
            <StatusBadge value={personalizedPlanLabel(personalizedPlan?.status ?? null)} />
          </div>
          <div className="mt-3 grid gap-1 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">AI Recommendation:</span>{" "}
              {recommendation ?? "Not available"}
            </p>
            <p>
              <span className="font-medium text-foreground">HR Decision:</span>{" "}
              {decisionLabel(application.status)}
            </p>
            <p>
              <span className="font-medium text-foreground">Application Status:</span>{" "}
              {applicationStatusLabel(application.status)}
            </p>
          </div>
          {finalOutcome === null ? null : (
            <div
              className={
                finalOutcome.decision === "HIRED"
                  ? "mt-3 rounded-md border border-success/30 bg-success/10 p-3 text-sm text-success"
                  : "mt-3 rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground"
              }
            >
              <p className="font-medium text-foreground">
                {finalOutcome.decision === "HIRED" ? "Candidate hired" : "Candidate not selected"}
              </p>
              <p className="mt-1">
                {finalOutcome.decision === "HIRED"
                  ? "Final HR outcome is recorded. Keep onboarding details outside AI scoring and review history."
                  : "Final HR outcome is recorded. Candidate-facing messaging remains neutral and does not expose internal notes."}
              </p>
              {finalOutcome.onboardingDate === null ? null : (
                <p className="mt-2 font-medium text-foreground">
                  Target onboarding date: {finalOutcome.onboardingDate}
                </p>
              )}
              {finalOutcome.recordedAt === null ? null : (
                <p className="mt-2 text-xs">Recorded {finalOutcome.recordedAt}</p>
              )}
            </div>
          )}
          {activeAvailability === undefined ? null : (
            <div className="mt-3 rounded-md border border-info/25 bg-info-soft p-3 text-sm text-info">
              <p className="font-medium">Availability request sent</p>
              <p className="mt-1 break-all">
                Candidate link: {availabilityRequestUrl(activeAvailability)}
              </p>
              <Button asChild size="sm" variant="secondary" className="mt-2">
                <a href={availabilityRequestUrl(activeAvailability)} target="_blank">
                  Open candidate availability
                </a>
              </Button>
            </div>
          )}
          {confirmedAvailability?.selectedSlot === null ||
          confirmedAvailability?.selectedSlot === undefined ? null : (
            <div className="mt-3 rounded-md border border-success/25 bg-success/10 p-3 text-sm text-success">
              <p className="font-medium">Availability confirmed</p>
              <p className="mt-1">
                {formatDateTime(confirmedAvailability.selectedSlot.startAt)} -{" "}
                {formatTime(confirmedAvailability.selectedSlot.endAt)}
              </p>
            </div>
          )}
          <div className="mt-3 rounded-md border border-border bg-background/70 p-3 text-sm">
            <p className="font-medium text-foreground">Personalized interview</p>
            <p className="mt-1 text-muted-foreground">
              {personalizedPlanDescription(personalizedPlan?.status ?? null)}
            </p>
            {personalizedPlan?.failureMessageSafe === null ||
            personalizedPlan?.failureMessageSafe === undefined ? null : (
              <p className="mt-2 text-warning">{personalizedPlan.failureMessageSafe}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <form action={generatePersonalizedInterviewAction}>
                <input type="hidden" name="applicationId" value={application.id} />
                <PendingSubmitButton
                  size="sm"
                  pendingLabel="Generating..."
                  disabled={application.status !== "AVAILABILITY_CONFIRMED"}
                >
                  Generate personalized interview
                </PendingSubmitButton>
              </form>
              {personalizedPlan === null ? null : (
                <form action={regeneratePersonalizedInterviewAction}>
                  <input type="hidden" name="applicationId" value={application.id} />
                  <PendingSubmitButton
                    size="sm"
                    variant="secondary"
                    pendingLabel="Regenerating..."
                    disabled={application.status !== "AVAILABILITY_CONFIRMED"}
                  >
                    Regenerate
                  </PendingSubmitButton>
                </form>
              )}
              {personalizedPlan === null ? null : (
                <Button asChild size="sm" variant="secondary">
                  <Link
                    href={`/jobs/${application.jobId}/applications/${application.id}/interview-plan`}
                  >
                    View questions
                  </Link>
                </Button>
              )}
              <Button asChild size="sm" variant="secondary">
                <Link href={`/applications/${application.id}`}>Open application</Link>
              </Button>
              <Button asChild size="sm" variant="secondary">
                <Link href={`/applications/${application.id}/verification`}>HR verification</Link>
              </Button>
            </div>
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
          <div className="grid gap-2">
            <form action={shortlistApplicationAction} className="grid gap-2">
              <input type="hidden" name="applicationId" value={application.id} />
              <textarea
                name="decisionNote"
                placeholder="Optional HR note"
                className="min-h-16 rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <PendingSubmitButton
                variant="secondary"
                pendingLabel="Shortlisting..."
                disabled={application.status === "SHORTLISTED"}
              >
                Shortlist
              </PendingSubmitButton>
            </form>
            <form action={markApplicationNotSelectedAction}>
              <input type="hidden" name="applicationId" value={application.id} />
              <PendingSubmitButton
                variant="secondary"
                pendingLabel="Updating..."
                disabled={application.status === "NOT_SELECTED"}
              >
                Mark as not selected
              </PendingSubmitButton>
            </form>
            <form action={returnApplicationToReviewAction}>
              <input type="hidden" name="applicationId" value={application.id} />
              <PendingSubmitButton variant="secondary" pendingLabel="Updating...">
                Return to review
              </PendingSubmitButton>
            </form>
            <form action={sendAvailabilityRequestAction}>
              <input type="hidden" name="applicationId" value={application.id} />
              <PendingSubmitButton
                pendingLabel="Sending request..."
                disabled={application.status !== "SHORTLISTED"}
              >
                Send availability request
              </PendingSubmitButton>
            </form>
          </div>
          <form action={sendInvitationAction} className="grid gap-2">
            <input type="hidden" name="applicationId" value={application.id} />
            <Field label="Invitation expiry">
              <NativeSelect name="expiresInHours" defaultValue="72">
                <option value="72">3 days</option>
                <option value="24">1 day</option>
                <option value="168">7 days</option>
              </NativeSelect>
            </Field>
            <Button
              type="submit"
              disabled={
                application.candidate.primaryEmail === null ||
                application.status !== "AVAILABILITY_CONFIRMED" ||
                !personalizedReady
              }
            >
              <Mail aria-hidden="true" />
              Send interview invite
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

function availabilityRequestUrl(request: JobApplication["availabilityRequests"][number]): string {
  return createAvailabilityRequestUrl(
    createAvailabilityRequestToken({
      requestId: request.id,
      companyId: request.companyId,
      applicationId: request.applicationId,
      tokenSalt: request.tokenSalt,
    }),
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
    <details className="mt-5 rounded-2xl border border-primary/15 bg-surface/90 p-4 shadow-xs">
      <summary className="cursor-pointer text-sm font-semibold text-foreground">
        AI screening result
      </summary>
      <div className="mt-4 grid gap-4 text-sm">
        <AIInsightCard title="Advisory screening">
          <div className="grid gap-4 md:grid-cols-3">
            <DetailBlock
              title="Match score"
              value={
                screening.matchScore === null ? "Not scored" : `${String(screening.matchScore)}/100`
              }
            />
            <DetailBlock title="Recommendation" value={screening.recommendation} />
            <DetailBlock title="Confidence" value={screening.confidence} />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            AI screening supports HR review. It does not make hiring decisions.
          </p>
        </AIInsightCard>
        {isLowQuality ? (
          <p className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-warning">
            PDF text could not be extracted clearly. Ask candidate to upload DOCX or a selectable
            text PDF. Screening is based on limited evidence.
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
      <div className="mt-2">
        <ChipList values={values} />
      </div>
    </div>
  );
}

function screeningLabel(screening: CvScreening | null): string {
  if (screening === null) return "Screening not started";
  if (screening.screeningStatus === "COMPLETE") return "Screening complete";
  if (screening.screeningStatus === "FAILED") return "Screening failed";
  return "Screening pending";
}

function personalizedPlanLabel(status: string | null): string {
  if (status === "READY") return "Personalized interview ready";
  if (status === "PENDING") return "Personalized interview generating";
  if (status === "FAILED") return "Personalized interview failed";
  return "Personalized interview not generated";
}

function personalizedPlanDescription(status: string | null): string {
  if (status === "READY")
    return "Review the candidate-specific questions before sending an invite.";
  if (status === "PENDING") return "Question generation is in progress.";
  if (status === "FAILED") return "Generation failed. You can retry safely.";
  return "Generate candidate-specific questions after availability is confirmed.";
}

function decisionLabel(status: string): string {
  switch (status) {
    case "HIRED":
      return "Hired";
    case "SHORTLISTED":
      return "Shortlisted";
    case "NOT_SELECTED":
    case "REJECTED":
      return "Not selected";
    case "AVAILABILITY_REQUESTED":
      return "Availability requested";
    case "AVAILABILITY_CONFIRMED":
      return "Availability confirmed";
    default:
      return "Under review";
  }
}

function readFinalOutcome(
  value: unknown,
  status: string,
): {
  readonly decision: "HIRED" | "REJECTED";
  readonly onboardingDate: string | null;
  readonly recordedAt: string | null;
} | null {
  if (status !== "HIRED" && status !== "REJECTED" && status !== "NOT_SELECTED") {
    return null;
  }
  const decision = status === "HIRED" ? "HIRED" : "REJECTED";
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { decision, onboardingDate: null, recordedAt: null };
  }
  const outcome = (value as Record<string, unknown>).hrInterviewOutcome;
  if (typeof outcome !== "object" || outcome === null || Array.isArray(outcome)) {
    return { decision, onboardingDate: null, recordedAt: null };
  }
  const record = outcome as Record<string, unknown>;
  return {
    decision,
    onboardingDate:
      typeof record.onboardingDate === "string" && record.onboardingDate.length > 0
        ? record.onboardingDate
        : null,
    recordedAt: typeof record.recordedAt === "string" ? record.recordedAt : null,
  };
}

function applicationStatusLabel(status: string): string {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function formatTime(value: Date): string {
  return new Intl.DateTimeFormat("en", { timeStyle: "short" }).format(value);
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
