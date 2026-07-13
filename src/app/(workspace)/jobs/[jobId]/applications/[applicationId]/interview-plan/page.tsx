import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, RefreshCw } from "lucide-react";

import { PendingSubmitButton } from "@/components/forms/pending-submit-button";
import { PageHeader } from "@/components/layout/page-header";
import { SectionCard } from "@/components/recruiting/recruiting-ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/infra/database";
import { regeneratePersonalizedInterviewAction } from "@/server/hr-workspace/actions";
import { requireHrWorkspaceContext } from "@/server/hr-workspace/context";

import { StatusBadge, formatDate } from "../../../../../_components/hr-ui";

export default async function PersonalizedInterviewPlanPage({
  params,
}: {
  readonly params: Promise<{ readonly jobId: string; readonly applicationId: string }>;
}) {
  const context = await requireHrWorkspaceContext("applications:read");
  const { jobId, applicationId } = await params;
  const application = await prisma.candidateApplication.findUnique({
    where: { companyId_id: { companyId: context.tenant.companyId, id: applicationId } },
    include: {
      candidate: true,
      job: true,
      personalizedInterviewPlans: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        include: { personalizedVersion: true, sourceVersion: true },
      },
    },
  });
  if (application?.jobId !== jobId) {
    notFound();
  }
  const plan = application.personalizedInterviewPlans.at(0) ?? null;
  const questions = readQuestions(plan?.personalizedVersion?.questionBlueprintJson ?? null);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Personalized interview"
        title={`${application.candidate.fullName} · ${application.job.title}`}
        description="Review candidate-specific, job-related questions before sending the interview invitation."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <Link href={`/jobs/${application.jobId}`}>
                <ArrowLeft aria-hidden="true" />
                Back to job
              </Link>
            </Button>
            <form action={regeneratePersonalizedInterviewAction}>
              <input type="hidden" name="applicationId" value={application.id} />
              <PendingSubmitButton pendingLabel="Regenerating...">
                <RefreshCw aria-hidden="true" />
                Regenerate
              </PendingSubmitButton>
            </form>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[0.7fr_1.3fr]">
        <SectionCard title="Generation status" description="Safe diagnostics for HR review only.">
          {plan === null ? (
            <p className="text-sm text-muted-foreground">
              No personalized interview has been generated yet.
            </p>
          ) : (
            <div className="grid gap-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <StatusBadge value={plan.status} />
                <StatusBadge value={`${String(plan.questionCount)} questions`} />
                <StatusBadge value={plan.provider ?? "provider pending"} />
              </div>
              <p className="text-muted-foreground">
                Generated {plan.generatedAt === null ? "not yet" : formatDate(plan.generatedAt)}
              </p>
              {plan.failureMessageSafe === null ? null : (
                <p className="rounded-md border border-warning/30 bg-warning/10 p-3 text-warning">
                  {plan.failureMessageSafe}
                </p>
              )}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="AI basis summary"
          description="This summary is for HR review. Candidates do not see screening scores, missing-skill labels, or internal rationale."
        >
          <p className="text-sm leading-6 text-muted-foreground">
            {plan === null
              ? "Generate a personalized interview to summarize the role, CV evidence, screening focus, and HR shortlist context used."
              : (plan.basisSummary ??
                "Generate a personalized interview to summarize the role, CV evidence, screening focus, and HR shortlist context used.")}
          </p>
        </SectionCard>
      </div>

      <SectionCard
        title="Candidate-safe questions"
        description="The candidate interview shows question text only. Reasons, signals, red flags, and follow-ups stay internal to HR."
      >
        {questions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Questions will appear here after generation completes successfully.
          </p>
        ) : (
          <div className="grid gap-3">
            {questions.map((question) => (
              <Card key={question.key}>
                <CardHeader>
                  <CardTitle className="flex flex-col gap-2 text-base sm:flex-row sm:items-center sm:justify-between">
                    <span>
                      {String(question.sequence)}. {question.prompt}
                    </span>
                    <StatusBadge value={question.questionType ?? question.kind} />
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 text-sm text-muted-foreground md:grid-cols-2">
                  <Detail title="Competency" value={question.competency} />
                  <Detail title="Why this question" value={question.reason} />
                  <DetailList title="Expected signals" values={question.expectedSignals} />
                  <DetailList title="Red flags" values={question.redFlags} />
                  <DetailList title="Optional follow-ups" values={question.followUps} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function Detail({ title, value }: { readonly title: string; readonly value: string | null }) {
  return (
    <div>
      <p className="font-medium text-foreground">{title}</p>
      <p className="mt-1">{value ?? "Not recorded."}</p>
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
        <p className="mt-1">None recorded.</p>
      ) : (
        <ul className="mt-1 list-disc space-y-1 pl-5">
          {values.map((value) => (
            <li key={value}>{value}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function readQuestions(value: unknown): readonly PersonalizedQuestion[] {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    const record =
      typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
    return {
      key: readString(record.key) ?? `question-${String(index + 1)}`,
      sequence: readNumber(record.sequence) ?? index + 1,
      kind: readString(record.kind) ?? "main",
      prompt: readString(record.prompt) ?? "Question unavailable.",
      questionType: readString(record.questionType),
      competency: readString(record.competency),
      reason: readString(record.reason),
      expectedSignals: readStringList(record.expectedSignals),
      redFlags: readStringList(record.redFlags),
      followUps: readStringList(record.followUps),
    };
  });
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readStringList(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

interface PersonalizedQuestion {
  readonly key: string;
  readonly sequence: number;
  readonly kind: string;
  readonly prompt: string;
  readonly questionType: string | null;
  readonly competency: string | null;
  readonly reason: string | null;
  readonly expectedSignals: readonly string[];
  readonly redFlags: readonly string[];
  readonly followUps: readonly string[];
}
