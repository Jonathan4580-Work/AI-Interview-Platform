import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { PendingSubmitButton } from "@/components/forms/pending-submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { publishJdJobAction, saveJdReviewAction } from "@/server/hr-workspace/actions";
import { requireHrWorkspaceContext } from "@/server/hr-workspace/context";
import { getJobReviewDetail } from "@/server/hr-workspace/queries";

import {
  EmptyPanel,
  Field,
  LongTextField,
  NativeSelect,
  StatusBadge,
  TextField,
  formatDate,
} from "../../../_components/hr-ui";

export default async function JobReviewPage({
  params,
}: {
  readonly params: Promise<{ readonly jobId: string }>;
}) {
  const context = await requireHrWorkspaceContext("jobs:manage");
  const { jobId } = await params;
  const job = await getJobReviewDetail(context, jobId);
  if (job === null) notFound();

  const profile = job.intelligenceProfile;
  const latestAsset = job.descriptionAssets.length > 0 ? job.descriptionAssets[0] : null;
  const questions =
    job.interviewQuestions.length > 0 ? job.interviewQuestions : fallbackQuestions();

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Job review"
        title={job.title}
        description="Review and edit the AI-generated draft before publishing this job."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <Link href={`/jobs/${job.id}`}>View job</Link>
            </Button>
            <form action={publishJdJobAction}>
              <input type="hidden" name="jobId" value={job.id} />
              <PendingSubmitButton
                pendingLabel="Publishing..."
                disabled={job.interviewQuestions.length < 3}
              >
                Publish job
              </PendingSubmitButton>
            </form>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[0.7fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Analysis status</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="flex flex-wrap gap-2">
              <StatusBadge value={profile?.status ?? "draft"} />
              <StatusBadge value={job.status} />
            </div>
            {profile?.failureMessage ? (
              <p className="rounded-md border border-danger/30 bg-danger/10 p-3 text-danger">
                {profile.failureMessage}
              </p>
            ) : null}
            {job.workflows.length === 0 ? (
              <p className="text-muted-foreground">No analysis workflow has run for this job.</p>
            ) : (
              <div className="grid gap-2">
                {job.workflows.map((workflow) => (
                  <div key={workflow.id} className="rounded-md border border-border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">JD analysis</span>
                      <StatusBadge value={workflow.status} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Updated {formatDate(workflow.updatedAt)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {workflow.steps.map((step) => (
                        <StatusBadge key={step.id} value={`${step.stepKey} ${step.status}`} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Extracted job description</CardTitle>
          </CardHeader>
          <CardContent>
            {latestAsset === null ? (
              <EmptyPanel
                title="No source text"
                description="No job description source is attached."
              />
            ) : (
              <div className="grid gap-2 text-sm">
                <div className="flex flex-wrap gap-2">
                  <StatusBadge value={latestAsset.sourceType} />
                  <StatusBadge value={latestAsset.status} />
                </div>
                <p className="text-muted-foreground">
                  {latestAsset.fileName ?? "Pasted text"} · {latestAsset.extractedText.length}{" "}
                  characters
                </p>
                <p className="max-h-44 overflow-auto rounded-md border border-border bg-muted/30 p-3 text-muted-foreground">
                  {latestAsset.extractedText}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <form action={saveJdReviewAction}>
        <input type="hidden" name="jobId" value={job.id} />
        <input type="hidden" name="questionCount" value={questions.length} />
        <Card>
          <CardHeader>
            <CardTitle>Job intelligence draft</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Field label="Job title">
              <TextField name="title" defaultValue={profile?.title ?? job.title} required />
            </Field>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Employment type">
                <NativeSelect name="employmentType" defaultValue={job.employmentType}>
                  <option value="FULL_TIME">Full time</option>
                  <option value="PART_TIME">Part time</option>
                  <option value="CONTRACT">Contract</option>
                  <option value="TEMPORARY">Temporary</option>
                  <option value="INTERNSHIP">Internship</option>
                </NativeSelect>
              </Field>
              <Field label="Workplace">
                <NativeSelect name="workplaceType" defaultValue={job.workplaceType}>
                  <option value="REMOTE">Remote</option>
                  <option value="HYBRID">Hybrid</option>
                  <option value="ONSITE">On-site</option>
                </NativeSelect>
              </Field>
              <Field label="Seniority">
                <NativeSelect name="seniorityLevel" defaultValue={job.seniorityLevel}>
                  <option value="ENTRY">Entry</option>
                  <option value="MID">Mid</option>
                  <option value="SENIOR">Senior</option>
                  <option value="STAFF">Staff</option>
                  <option value="EXECUTIVE">Executive</option>
                </NativeSelect>
              </Field>
            </div>
            <Field label="Summary">
              <LongTextField
                name="summary"
                defaultValue={readSummary(job.descriptionJson)}
                rows={4}
              />
            </Field>
            <Field label="Details">
              <LongTextField
                name="details"
                defaultValue={readDetails(job.descriptionJson)}
                rows={6}
              />
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Responsibilities">
                <LongTextField
                  name="responsibilities"
                  defaultValue={jsonList(profile?.responsibilitiesJson)}
                  rows={8}
                />
              </Field>
              <Field label="Required skills">
                <LongTextField
                  name="requiredSkills"
                  defaultValue={jsonList(profile?.requiredSkillsJson)}
                  rows={8}
                />
              </Field>
              <Field label="Nice-to-have skills">
                <LongTextField
                  name="niceToHaveSkills"
                  defaultValue={jsonList(profile?.niceToHaveSkillsJson)}
                  rows={6}
                />
              </Field>
              <Field
                label="Competencies"
                hint="Use one competency per line. Add a colon for a description."
              >
                <LongTextField
                  name="competencies"
                  defaultValue={competencyList(profile?.competenciesJson)}
                  rows={6}
                />
              </Field>
              <Field label="Interview structure">
                <LongTextField
                  name="interviewStructure"
                  defaultValue={jsonList(profile?.interviewStructureJson)}
                  rows={5}
                />
              </Field>
              <Field label="Scoring rubric">
                <LongTextField
                  name="rubric"
                  defaultValue={jsonList(profile?.rubricJson)}
                  rows={5}
                />
              </Field>
              <Field label="Red flags">
                <LongTextField
                  name="redFlags"
                  defaultValue={jsonList(profile?.redFlagsJson)}
                  rows={5}
                />
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Interview questions</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {questions.map((question, index) => {
              const fieldPrefix = `questions.${String(index)}.`;
              const questionNumber = String(index + 1);
              return (
                <div key={question.id} className="grid gap-3 rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">Question {questionNumber}</p>
                    <StatusBadge value={question.questionType} />
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <Field label="Competency">
                      <TextField
                        name={`${fieldPrefix}competencyName`}
                        defaultValue={question.competencyName}
                        required
                      />
                    </Field>
                    <Field label="Question type">
                      <NativeSelect
                        name={`${fieldPrefix}questionType`}
                        defaultValue={question.questionType}
                      >
                        <option value="introduction">Introduction</option>
                        <option value="behavioral">Behavioral</option>
                        <option value="technical">Technical</option>
                        <option value="situational">Situational</option>
                        <option value="role-specific">Role-specific</option>
                        <option value="culture/team fit">Culture/team fit</option>
                      </NativeSelect>
                    </Field>
                    <Field label="Difficulty">
                      <NativeSelect
                        name={`${fieldPrefix}difficulty`}
                        defaultValue={question.difficulty}
                      >
                        <option value="introductory">Introductory</option>
                        <option value="standard">Standard</option>
                        <option value="advanced">Advanced</option>
                      </NativeSelect>
                    </Field>
                  </div>
                  <Field label="Competency description">
                    <LongTextField
                      name={`${fieldPrefix}competencyDescription`}
                      defaultValue={question.competencyDescription ?? ""}
                      rows={2}
                    />
                  </Field>
                  <Field label="Question">
                    <LongTextField
                      name={`${fieldPrefix}questionText`}
                      defaultValue={question.questionText}
                      rows={3}
                      required
                    />
                  </Field>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Expected answer signals">
                      <LongTextField
                        name={`${fieldPrefix}expectedAnswerSignals`}
                        defaultValue={jsonList(question.expectedSignalsJson)}
                        rows={4}
                      />
                    </Field>
                    <Field label="Question scoring rubric">
                      <LongTextField
                        name={`${fieldPrefix}scoringRubric`}
                        defaultValue={jsonList(question.scoringRubricJson)}
                        rows={4}
                      />
                    </Field>
                    <Field label="Question red flags">
                      <LongTextField
                        name={`${fieldPrefix}redFlags`}
                        defaultValue={jsonList(question.redFlagsJson)}
                        rows={4}
                      />
                    </Field>
                    <Field label="Follow-up prompts">
                      <LongTextField
                        name={`${fieldPrefix}followUps`}
                        defaultValue={jsonList(question.followUpsJson)}
                        rows={4}
                      />
                    </Field>
                  </div>
                </div>
              );
            })}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
              <p>
                Saving keeps the job in HR review. Publishing activates the job and its interview
                plan.
              </p>
              <PendingSubmitButton variant="secondary" pendingLabel="Saving draft...">
                Save draft
              </PendingSubmitButton>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}

function jsonList(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .map((item) => {
      if (typeof item === "string") return item;
      if (typeof item === "object" && item !== null && "name" in item) {
        return String((item as { name: unknown }).name);
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function competencyList(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .map((item) => {
      if (typeof item !== "object" || item === null || Array.isArray(item)) return "";
      const name = (item as { name?: unknown }).name;
      const description = (item as { description?: unknown }).description;
      return `${typeof name === "string" ? name : "Competency"}: ${
        typeof description === "string" ? description : "Assess role-related evidence."
      }`;
    })
    .filter(Boolean)
    .join("\n");
}

function readSummary(value: unknown): string {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return "";
  const summary = (value as { summary?: unknown }).summary;
  return typeof summary === "string" ? summary : "";
}

function readDetails(value: unknown): string {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return "";
  const details = (value as { details?: unknown }).details;
  return typeof details === "string" ? details : "";
}

function fallbackQuestions() {
  return [
    {
      id: "fallback-1",
      competencyName: "Communication",
      competencyDescription: "Candidate communicates clearly and professionally.",
      questionText: "Please introduce yourself and briefly describe your relevant experience.",
      questionType: "introduction",
      difficulty: "introductory",
      expectedSignalsJson: ["Clear overview of relevant background."],
      scoringRubricJson: ["Look for concise, relevant communication."],
      redFlagsJson: ["Unable to summarize relevant experience."],
      followUpsJson: ["What experience is most relevant to this role?"],
    },
    {
      id: "fallback-2",
      competencyName: "Role relevance",
      competencyDescription: "Candidate experience aligns with the role.",
      questionText: "What part of your experience best prepares you for this role?",
      questionType: "behavioral",
      difficulty: "standard",
      expectedSignalsJson: ["Specific, job-related example."],
      scoringRubricJson: ["Look for evidence tied to the role requirements."],
      redFlagsJson: ["No job-related example."],
      followUpsJson: ["What outcome did you produce?"],
    },
    {
      id: "fallback-3",
      competencyName: "Problem solving",
      competencyDescription: "Candidate explains practical problem solving.",
      questionText: "Tell us about a difficult work problem you solved and how you approached it.",
      questionType: "situational",
      difficulty: "standard",
      expectedSignalsJson: ["Structured problem, action, and outcome."],
      scoringRubricJson: ["Look for clear reasoning and ownership."],
      redFlagsJson: ["No concrete action or outcome."],
      followUpsJson: ["What would you do differently next time?"],
    },
  ];
}
