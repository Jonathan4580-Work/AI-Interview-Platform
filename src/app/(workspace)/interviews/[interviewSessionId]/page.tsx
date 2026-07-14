import { notFound } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireHrWorkspaceContext } from "@/server/hr-workspace/context";
import { getInterviewDetail } from "@/server/hr-workspace/queries";

import { EmptyPanel, StatusBadge, formatDate, normalizeLabel } from "../../_components/hr-ui";

export default async function InterviewDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly interviewSessionId: string }>;
}) {
  const context = await requireHrWorkspaceContext("interviews:read");
  const { interviewSessionId } = await params;
  const interview = await getInterviewDetail(context, interviewSessionId);
  if (interview === null) notFound();

  const transcript = interview.transcripts.at(0) ?? null;
  const evaluation = interview.evaluationVersions.at(0) ?? null;
  const report = interview.hrReports.at(0)?.activeVersion ?? null;

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Interview"
        title={interview.candidate.fullName}
        description={`${interview.application?.job.title ?? "No job"} · ${formatDate(interview.updatedAt)}`}
      />

      <Card>
        <CardHeader>
          <CardTitle>Interview status</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatusItem label="Session" value={interview.status} />
          <StatusItem label="Invitation" value={interview.invitation.status} />
          <StatusItem label="Transcript" value={transcript?.status ?? "Pending"} />
          <StatusItem label="Report" value={report === null ? "Pending" : "Ready"} />
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Readiness and progress</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <p className="text-muted-foreground">
              Started {formatDate(interview.startedAt)} · Completed{" "}
              {formatDate(interview.completedAt)}
            </p>
            <div className="grid gap-2">
              {interview.readinessChecks.length === 0 ? (
                <EmptyPanel
                  title="No readiness checks"
                  description="Readiness results will appear after the candidate completes setup."
                />
              ) : (
                interview.readinessChecks.map((check) => (
                  <div
                    key={check.id}
                    className="flex items-center justify-between rounded-md border border-border p-3"
                  >
                    <span>{normalizeLabel(check.type)}</span>
                    <StatusBadge value={check.status} />
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Processing workflow</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {interview.processingWorkflow === null ? (
              <EmptyPanel
                title="Workflow not started"
                description="The processing workflow starts after interview completion and verified media upload."
              />
            ) : (
              <>
                <StatusBadge value={interview.processingWorkflow.status} />
                {interview.processingWorkflow.steps.map((step) => (
                  <div key={step.id} className="rounded-md border border-border p-3">
                    <p className="font-medium text-foreground">{normalizeLabel(step.stepKey)}</p>
                    <p className="mt-1 text-muted-foreground">
                      <StatusBadge value={step.status} /> Attempts {step.attemptCount}
                    </p>
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transcript</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {transcript?.activeVersion == null ? (
            <EmptyPanel
              title="Transcript pending"
              description="Transcript segments will appear after the processing workflow completes."
            />
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Quality <StatusBadge value={transcript.transcriptQuality} /> · Provider{" "}
                {transcript.provider}
              </p>
              {transcript.activeVersion.segments.map((segment) => (
                <div key={segment.id} className="rounded-md border border-border p-3 text-sm">
                  <p className="font-medium text-foreground">
                    {normalizeLabel(segment.speaker)} · Segment {segment.sequence}
                  </p>
                  <p className="mt-1 text-muted-foreground">{segment.text}</p>
                </div>
              ))}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Evaluation</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {evaluation === null ? (
            <EmptyPanel
              title="Evaluation pending"
              description="Competency scores and evidence will appear after the evaluation provider finishes."
            />
          ) : (
            <>
              <div className="rounded-md border border-border p-3 text-sm">
                <p className="font-medium text-foreground">Summary</p>
                <p className="mt-1 text-muted-foreground">{evaluation.summary}</p>
                <p className="mt-3 text-xs text-muted-foreground">
                  {evaluation.decisionSupportDisclaimer}
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {evaluation.scores.map((score) => (
                  <div key={score.id} className="rounded-md border border-border p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-foreground">{score.label}</p>
                      <StatusBadge value={score.confidence} />
                    </div>
                    <p className="mt-1 text-muted-foreground">
                      Score {score.score ?? "Incomplete"} / {score.maxScore}
                    </p>
                    <p className="mt-2 text-muted-foreground">{score.rationale}</p>
                    <div className="mt-3 grid gap-2">
                      {score.evidenceCitations.map((citation) => (
                        <blockquote
                          key={citation.id}
                          className="border-l-2 border-border pl-3 text-muted-foreground"
                        >
                          {citation.claim}
                        </blockquote>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {evaluation.limitations.length === 0 ? null : (
                <div className="rounded-md border border-border p-3 text-sm">
                  <p className="font-medium text-foreground">Limitations</p>
                  <ul className="mt-2 grid gap-1 text-muted-foreground">
                    {evaluation.limitations.map((limitation) => (
                      <li key={limitation.id}>{limitation.message}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Monitoring warnings</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {interview.monitoringEvents.length === 0 ? (
            <EmptyPanel
              title="No monitoring warnings"
              description="Warnings are contextual only and do not change scores or application status."
            />
          ) : (
            interview.monitoringEvents.map((event) => (
              <div key={event.id} className="rounded-md border border-border p-3 text-sm">
                <p className="font-medium text-foreground">{normalizeLabel(event.type)}</p>
                <p className="mt-1 text-muted-foreground">
                  <StatusBadge value={event.severity} /> Occurrences {event.occurrenceCount} ·{" "}
                  {formatDate(event.occurredAt)}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>HR report</CardTitle>
        </CardHeader>
        <CardContent>
          {report === null ? (
            <EmptyPanel
              title="Report pending"
              description="The HR report appears after transcription and evaluation complete."
            />
          ) : (
            <div className="grid gap-3 text-sm">
              <p className="font-medium text-foreground">Executive summary</p>
              <p className="text-muted-foreground">{report.executiveSummary}</p>
              <p className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                {report.disclaimer}
              </p>
            </div>
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
