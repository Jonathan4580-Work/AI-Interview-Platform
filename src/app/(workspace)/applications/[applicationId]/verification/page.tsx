import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock3, RotateCw, XCircle } from "lucide-react";

import { PendingSubmitButton } from "@/components/forms/pending-submit-button";
import { PageHeader } from "@/components/layout/page-header";
import { AIInsightCard, ChipList, SectionCard } from "@/components/recruiting/recruiting-ui";
import { Button } from "@/components/ui/button";
import {
  createAvailabilityRequestToken,
  createAvailabilityRequestUrl,
} from "@/modules/availability/tokens";
import {
  createHrInterviewSlotAction,
  recordHrInterviewOutcomeAction,
  recordHrVerificationAction,
  sendHrInterviewAvailabilityRequestAction,
} from "@/server/hr-workspace/actions";
import { requireHrWorkspaceContext } from "@/server/hr-workspace/context";
import { getApplicationVerificationDetail } from "@/server/hr-workspace/queries";

import { EmptyPanel, StatusBadge, formatDate } from "../../../_components/hr-ui";

type VerificationApplication = NonNullable<
  Awaited<ReturnType<typeof getApplicationVerificationDetail>>
>;
type VerificationAvailabilityRequest = VerificationApplication["availabilityRequests"][number];

export default async function ApplicationVerificationPage({
  params,
}: {
  readonly params: Promise<{ readonly applicationId: string }>;
}) {
  const context = await requireHrWorkspaceContext("applications:read");
  const { applicationId } = await params;
  const application = await getApplicationVerificationDetail(context, applicationId);
  if (application === null) notFound();

  const screening = application.cvScreenings.at(0) ?? null;
  const personalizedPlan = application.personalizedInterviewPlans.at(0) ?? null;
  const latestInterview = application.interviewSessions.at(0) ?? null;
  const transcript = latestInterview?.transcripts.at(0) ?? null;
  const evaluation = latestInterview?.evaluationVersions.at(0) ?? null;
  const report = latestInterview?.hrReports.at(0) ?? null;
  const reportVersion = report?.activeVersion ?? null;
  const hrRequests = application.availabilityRequests.filter(
    (request) => request.purpose === "HR_INTERVIEW",
  );
  const latestHrRequest = hrRequests.at(0) ?? null;
  const hrInterviewOutcome = readHrInterviewOutcome(application.metadataJson);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="HR verification"
        title={`${application.candidate.fullName} - ${application.job.title}`}
        description="Review the AI-supported evidence and record a human-owned next step."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <Link href={`/jobs/${application.jobId}`}>
                <ArrowLeft aria-hidden="true" />
                Back to job
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href={`/candidates/${application.candidateId}`}>Candidate profile</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[0.75fr_1.25fr]">
        <SectionCard title="Application packet" description="Tenant-scoped candidate context.">
          <div className="grid gap-4 text-sm">
            <div>
              <p className="font-semibold text-foreground">{application.candidate.fullName}</p>
              <p className="mt-1 break-all text-muted-foreground">
                {application.candidate.primaryEmail ?? "No email on file"}
              </p>
              {application.candidate.phone === null ? null : (
                <p className="mt-1 text-muted-foreground">{application.candidate.phone}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge value={application.status} />
              <StatusBadge value={application.currentStage?.name ?? "No stage"} />
              <StatusBadge
                value={application.candidate.documents.length > 0 ? "CV uploaded" : "No CV"}
              />
              <StatusBadge value={personalizedPlan?.status ?? "No personalized plan"} />
            </div>
            <p className="text-muted-foreground">Applied {formatDate(application.appliedAt)}</p>
          </div>
        </SectionCard>

        <SectionCard
          title="Human verification decision"
          description="AI output is decision support. HR owns the next step and must record a reason."
        >
          <form action={recordHrVerificationAction} className="grid gap-4">
            <input type="hidden" name="applicationId" value={application.id} />
            <label className="grid gap-2 text-sm font-medium text-foreground">
              Verification note
              <textarea
                required
                name="verificationNote"
                minLength={5}
                maxLength={2000}
                placeholder="Summarize why HR is approving, holding, rejecting, or requesting another AI interview."
                className="min-h-28 rounded-xl border border-input bg-surface px-3 py-2 text-sm text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <PendingSubmitButton name="decision" value="HR_VERIFIED" pendingLabel="Recording...">
                <CheckCircle2 aria-hidden="true" />
                Approve HR interview
              </PendingSubmitButton>
              <PendingSubmitButton
                name="decision"
                value="REQUEST_ANOTHER_AI_INTERVIEW"
                variant="secondary"
                pendingLabel="Recording..."
              >
                <RotateCw aria-hidden="true" />
                Request another AI interview
              </PendingSubmitButton>
              <PendingSubmitButton
                name="decision"
                value="HOLD"
                variant="secondary"
                pendingLabel="Recording..."
              >
                <Clock3 aria-hidden="true" />
                Put on hold
              </PendingSubmitButton>
              <PendingSubmitButton
                name="decision"
                value="HR_REJECTED"
                variant="secondary"
                pendingLabel="Recording..."
              >
                <XCircle aria-hidden="true" />
                Reject after review
              </PendingSubmitButton>
            </div>
          </form>
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_0.85fr]">
        <ScreeningPanel screening={screening} />
        <InterviewEvidencePanel
          interviewId={latestInterview?.id ?? null}
          interviewStatus={latestInterview?.status ?? null}
          transcriptStatus={transcript?.status ?? null}
          evaluationStatus={evaluation?.status ?? null}
          reportStatus={report?.status ?? null}
          reportReady={reportVersion !== null}
        />
      </div>

      <SectionCard
        title="HR interview scheduling"
        description="Create manual HR interview slots and send a secure candidate booking link."
      >
        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <form
            action={createHrInterviewSlotAction}
            className="grid gap-3 rounded-xl border border-border bg-surface p-4 md:grid-cols-2"
          >
            <input type="hidden" name="applicationId" value={application.id} />
            <label className="grid gap-1.5 text-sm font-medium text-foreground">
              Date
              <input
                required
                name="slotDate"
                type="date"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-foreground">
              Start
              <input
                required
                name="startTime"
                type="time"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-foreground">
              End
              <input
                required
                name="endTime"
                type="time"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-foreground">
              Meeting link or location
              <input
                name="locationNote"
                placeholder="Google Meet, Zoom, office room, or phone"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              />
            </label>
            <PendingSubmitButton pendingLabel="Adding slot..." className="md:col-span-2">
              Add HR interview slot
            </PendingSubmitButton>
          </form>

          <div className="grid gap-3">
            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">Available HR slots</p>
                <StatusBadge value={`${String(application.job.availabilitySlots.length)} slots`} />
              </div>
              {application.job.availabilitySlots.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Add at least one HR interview slot before sending the candidate booking link.
                </p>
              ) : (
                <div className="mt-3 grid gap-2">
                  {application.job.availabilitySlots.map((slot) => (
                    <div key={slot.id} className="rounded-lg border border-border p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-foreground">
                          {formatDate(slot.startAt)} - {formatDate(slot.endAt)}
                        </span>
                        <StatusBadge value={slot.status} />
                      </div>
                      <p className="mt-1 text-muted-foreground">
                        {slot.locationNote ?? "Online HR interview"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form action={sendHrInterviewAvailabilityRequestAction} className="grid gap-3">
              <input type="hidden" name="applicationId" value={application.id} />
              <PendingSubmitButton
                pendingLabel="Sending booking link..."
                disabled={
                  application.status !== "INTERVIEW" ||
                  application.job.availabilitySlots.length === 0
                }
              >
                Send HR interview booking link
              </PendingSubmitButton>
            </form>

            {latestHrRequest === null ? null : (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-foreground">Latest HR interview request</p>
                  <StatusBadge value={latestHrRequest.status} />
                </div>
                {latestHrRequest.selectedSlot === null ? (
                  <p className="mt-2 break-all text-muted-foreground">
                    Candidate link: {availabilityRequestUrl(latestHrRequest)}
                  </p>
                ) : (
                  <p className="mt-2 text-muted-foreground">
                    Confirmed for {formatDate(latestHrRequest.selectedSlot.startAt)}.
                  </p>
                )}
                <Button asChild size="sm" variant="secondary" className="mt-3">
                  <a
                    href={availabilityRequestUrl(latestHrRequest)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open candidate booking
                  </a>
                </Button>
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="HR interview result"
        description="Record the human-owned outcome after the live HR interview."
      >
        <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-xl border border-border bg-surface p-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-foreground">Current result</p>
              <StatusBadge value={application.status} />
            </div>
            {hrInterviewOutcome === null ? (
              <p className="mt-3 text-muted-foreground">
                No HR interview result has been recorded yet. Confirm the HR interview first, then
                record the outcome here.
              </p>
            ) : (
              <div className="mt-3 grid gap-2 text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">Decision:</span>{" "}
                  {hrInterviewOutcome.decision}
                </p>
                <p>
                  <span className="font-medium text-foreground">Score:</span>{" "}
                  {hrInterviewOutcome.score === null
                    ? "Not scored"
                    : `${String(hrInterviewOutcome.score)} / 5`}
                </p>
                {hrInterviewOutcome.onboardingDate === null ? null : (
                  <p>
                    <span className="font-medium text-foreground">Onboarding target:</span>{" "}
                    {hrInterviewOutcome.onboardingDate}
                  </p>
                )}
                <p>
                  <span className="font-medium text-foreground">Recorded:</span>{" "}
                  {hrInterviewOutcome.recordedAt}
                </p>
              </div>
            )}
          </div>

          <form
            action={recordHrInterviewOutcomeAction}
            className="grid gap-3 rounded-xl border border-border bg-surface p-4"
          >
            <input type="hidden" name="applicationId" value={application.id} />
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-medium text-foreground">
                Interview score
                <select
                  name="interviewScore"
                  defaultValue={hrInterviewOutcome?.score?.toString() ?? ""}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">No score</option>
                  <option value="1">1 - Not aligned</option>
                  <option value="2">2 - Some concerns</option>
                  <option value="3">3 - Meets bar</option>
                  <option value="4">4 - Strong</option>
                  <option value="5">5 - Exceptional</option>
                </select>
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-foreground">
                Onboarding target date
                <input
                  name="onboardingDate"
                  type="date"
                  defaultValue={hrInterviewOutcome?.onboardingDate ?? ""}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                />
              </label>
            </div>
            <label className="grid gap-1.5 text-sm font-medium text-foreground">
              Feedback / reason
              <textarea
                required
                name="outcomeNote"
                minLength={5}
                maxLength={2000}
                placeholder="Summarize the HR interview outcome, strengths, risks, or rejection reason. This is HR-owned and separate from AI scoring."
                className="min-h-28 rounded-xl border border-input bg-background px-3 py-2 text-sm"
              />
            </label>
            <div className="grid gap-2 sm:grid-cols-3">
              <PendingSubmitButton
                name="outcome"
                value="HIRE"
                pendingLabel="Recording..."
                disabled={application.status !== "INTERVIEW" && application.status !== "HIRED"}
              >
                Hire candidate
              </PendingSubmitButton>
              <PendingSubmitButton
                name="outcome"
                value="REJECT"
                variant="secondary"
                pendingLabel="Recording..."
                disabled={application.status !== "INTERVIEW" && application.status !== "REJECTED"}
              >
                Not selected
              </PendingSubmitButton>
              <PendingSubmitButton
                name="outcome"
                value="HOLD"
                variant="secondary"
                pendingLabel="Recording..."
                disabled={application.status !== "INTERVIEW"}
              >
                Keep in interview
              </PendingSubmitButton>
            </div>
            <p className="text-xs text-muted-foreground">
              This updates the application status only from a human HR action. AI scores and
              monitoring warnings do not make hiring decisions.
            </p>
          </form>
        </div>
      </SectionCard>

      <SectionCard
        title="Transcript and evaluation"
        description="Evidence should support, not replace, HR judgement."
      >
        {latestInterview === null ? (
          <EmptyPanel
            title="No AI interview yet"
            description="Interview evidence appears after the candidate completes the AI interview."
          />
        ) : (
          <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">Transcript preview</p>
                <StatusBadge value={transcript?.status ?? "Pending"} />
              </div>
              {transcript?.activeVersion?.segments.length ? (
                <div className="mt-3 grid gap-2">
                  {transcript.activeVersion.segments.map((segment) => (
                    <blockquote
                      key={segment.id}
                      className="border-l-2 border-border pl-3 text-sm text-muted-foreground"
                    >
                      {segment.text}
                    </blockquote>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  Transcript segments are pending.
                </p>
              )}
            </div>

            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">Evaluation summary</p>
                <StatusBadge value={evaluation?.status ?? "Pending"} />
              </div>
              {evaluation === null ? (
                <p className="mt-3 text-sm text-muted-foreground">Evaluation is pending.</p>
              ) : (
                <div className="mt-3 grid gap-3 text-sm">
                  <p className="text-muted-foreground">{evaluation.summary}</p>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge value={`Overall ${String(evaluation.overallScore ?? "n/a")}`} />
                    <StatusBadge value={evaluation.overallConfidence} />
                  </div>
                  {evaluation.recommendation === null ? null : (
                    <p className="font-medium text-foreground">{evaluation.recommendation}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {evaluation.decisionSupportDisclaimer}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </SectionCard>

      {evaluation === null ? null : (
        <div className="grid gap-4 xl:grid-cols-[1fr_0.85fr]">
          <SectionCard title="Competency evidence" description="Evidence-linked score summary.">
            <div className="grid gap-3">
              {evaluation.scores.map((score) => (
                <div key={score.id} className="rounded-xl border border-border bg-surface p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-foreground">{score.label}</p>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge
                        value={`${String(score.score ?? "Incomplete")} / ${String(score.maxScore)}`}
                      />
                      <StatusBadge value={score.confidence} />
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{score.rationale}</p>
                  {score.evidenceCitations.length === 0 ? null : (
                    <div className="mt-3 grid gap-2">
                      {score.evidenceCitations.slice(0, 2).map((citation) => (
                        <blockquote
                          key={citation.id}
                          className="border-l-2 border-border pl-3 text-sm text-muted-foreground"
                        >
                          {citation.claim}
                        </blockquote>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Strengths and concerns" description="Context for HR review.">
            <ResultList
              title="Strengths"
              items={evaluation.observations
                .filter((observation) => observation.kind === "STRENGTH")
                .map((observation) => observation.text)}
              empty="No strengths recorded."
            />
            <ResultList
              title="Development areas"
              items={evaluation.observations
                .filter((observation) => observation.kind === "DEVELOPMENT_AREA")
                .map((observation) => observation.text)}
              empty="No development areas recorded."
            />
            <ResultList
              title="Limitations"
              items={evaluation.limitations.map((limitation) => limitation.message)}
              empty="No limitations recorded."
            />
          </SectionCard>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[0.85fr_1fr]">
        <SectionCard
          title="Monitoring warnings"
          description="Separate contextual information. These do not change scores or status automatically."
        >
          {latestInterview?.monitoringEvents.length ? (
            <div className="grid gap-2">
              {latestInterview.monitoringEvents.map((event) => (
                <div key={event.id} className="rounded-lg border border-border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">
                      {event.type.replaceAll("_", " ")}
                    </span>
                    <StatusBadge value={event.severity} />
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    {String(event.occurrenceCount)} occurrences - {formatDate(event.occurredAt)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyPanel
              title="No monitoring warnings"
              description="Any monitoring context will appear here neutrally."
            />
          )}
        </SectionCard>

        <SectionCard title="Decision history" description="Append-only HR decision trail.">
          {application.decisionHistory.length === 0 ? (
            <EmptyPanel
              title="No HR decisions yet"
              description="Verification decisions and notes will appear here."
            />
          ) : (
            <div className="grid gap-2">
              {application.decisionHistory.map((decision) => (
                <div key={decision.id} className="rounded-lg border border-border p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <StatusBadge value={decision.decision} />
                    <span className="text-muted-foreground">{formatDate(decision.createdAt)}</span>
                  </div>
                  <p className="mt-2 text-muted-foreground">
                    {decision.note ?? "No note recorded."}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    By {decision.createdBy?.name ?? decision.createdBy?.email ?? "System"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function ScreeningPanel({
  screening,
}: {
  readonly screening:
    | NonNullable<
        Awaited<ReturnType<typeof getApplicationVerificationDetail>>
      >["cvScreenings"][number]
    | null;
}) {
  if (screening === null) {
    return (
      <SectionCard title="AI CV screening" description="Resume screening status.">
        <EmptyPanel
          title="Screening not started"
          description="CV screening appears after a candidate uploads a resume."
        />
      </SectionCard>
    );
  }
  const lowQuality =
    screening.extractionQualityScore !== null && screening.extractionQualityScore < 45;
  return (
    <SectionCard title="AI CV screening" description="Advisory only. HR owns the decision.">
      <AIInsightCard title="Screening summary">
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Match score" value={`${String(screening.matchScore ?? "n/a")}/100`} />
          <Metric label="Recommendation" value={screening.recommendation ?? "Not recorded"} />
          <Metric label="Confidence" value={screening.confidence ?? "Not recorded"} />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {screening.hrSummary ?? "No HR summary recorded."}
        </p>
      </AIInsightCard>
      {lowQuality ? (
        <p className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
          CV extraction quality is low. Ask the candidate to upload DOCX or a selectable text PDF
          before relying on screening evidence.
        </p>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <ChipBlock title="Matched skills" values={jsonStringList(screening.matchedSkillsJson)} />
        <ChipBlock title="Missing skills" values={jsonStringList(screening.missingSkillsJson)} />
        <ChipBlock title="Concerns" values={jsonStringList(screening.concernsJson)} />
        <ChipBlock title="Interview focus" values={jsonStringList(screening.focusAreasJson)} />
      </div>
    </SectionCard>
  );
}

function InterviewEvidencePanel({
  interviewId,
  interviewStatus,
  transcriptStatus,
  evaluationStatus,
  reportStatus,
  reportReady,
}: {
  readonly interviewId: string | null;
  readonly interviewStatus: string | null;
  readonly transcriptStatus: string | null;
  readonly evaluationStatus: string | null;
  readonly reportStatus: string | null;
  readonly reportReady: boolean;
}) {
  return (
    <SectionCard
      title="AI interview evidence"
      description="Interview completion and processing readiness."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Metric label="Interview" value={interviewStatus ?? "Not started"} />
        <Metric label="Transcript" value={transcriptStatus ?? "Pending"} />
        <Metric label="Evaluation" value={evaluationStatus ?? "Pending"} />
        <Metric label="Report" value={reportStatus ?? "Pending"} />
      </div>
      <div className="mt-4">
        {interviewId === null ? (
          <Button disabled>View full report</Button>
        ) : (
          <Button asChild disabled={!reportReady}>
            <Link href={`/interviews/${interviewId}`}>View full report</Link>
          </Button>
        )}
      </div>
    </SectionCard>
  );
}

function Metric({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/70 p-3">
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function ChipBlock({
  title,
  values,
}: {
  readonly title: string;
  readonly values: readonly string[];
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <div className="mt-2">
        <ChipList values={values} />
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
    <div className="rounded-xl border border-border bg-surface p-4">
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

function jsonStringList(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function readHrInterviewOutcome(value: unknown): {
  readonly decision: string;
  readonly score: number | null;
  readonly onboardingDate: string | null;
  readonly recordedAt: string;
} | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const metadata = value as Record<string, unknown>;
  const outcome = metadata.hrInterviewOutcome;
  if (typeof outcome !== "object" || outcome === null || Array.isArray(outcome)) {
    return null;
  }
  const record = outcome as Record<string, unknown>;
  const decision = typeof record.decision === "string" ? record.decision : null;
  const score =
    typeof record.score === "number" && Number.isFinite(record.score) ? record.score : null;
  const onboardingDate =
    typeof record.onboardingDate === "string" && record.onboardingDate.length > 0
      ? record.onboardingDate
      : null;
  const recordedAt = typeof record.recordedAt === "string" ? record.recordedAt : null;
  if (decision === null || recordedAt === null) {
    return null;
  }
  return { decision, score, onboardingDate, recordedAt };
}

function availabilityRequestUrl(request: VerificationAvailabilityRequest): string {
  return createAvailabilityRequestUrl(
    createAvailabilityRequestToken({
      requestId: request.id,
      companyId: request.companyId,
      applicationId: request.applicationId,
      tokenSalt: request.tokenSalt,
    }),
  );
}
