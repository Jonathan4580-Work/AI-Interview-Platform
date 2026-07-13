import Link from "next/link";
import { FileText, Plus, Search, Sparkles } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireHrWorkspaceContext } from "@/server/hr-workspace/context";
import { listCandidates } from "@/server/hr-workspace/queries";

import { EmptyPanel, Field, StatusBadge, TextField, formatDate } from "../_components/hr-ui";

import type { ReactNode } from "react";

type CandidateListItem = Awaited<ReturnType<typeof listCandidates>>[number];

export default async function CandidatesPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly q?: string }>;
}) {
  const context = await requireHrWorkspaceContext("candidates:read");
  const { q } = await searchParams;
  const candidates = await listCandidates(context, q ?? null);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Hiring"
        title="Candidates"
        description="Add candidates, attach them to jobs, send invitations, and review interview outcomes."
        actions={
          <Button asChild>
            <Link href="/candidates/new">
              <Plus aria-hidden="true" />
              Add candidate
            </Link>
          </Button>
        }
      />
      <form action="/candidates" className="max-w-xl">
        <Field label="Search candidates">
          <div className="flex gap-2">
            <TextField name="q" defaultValue={q ?? ""} placeholder="Name or email" />
            <Button type="submit" variant="secondary">
              <Search aria-hidden="true" />
              Search
            </Button>
          </div>
        </Field>
      </form>
      {candidates.length === 0 ? (
        <EmptyPanel
          title="No candidates found"
          description="Add a candidate manually, then attach them to a job to send an interview invitation."
        />
      ) : (
        <div className="grid gap-3">
          {candidates.map((candidate) => (
            <Link
              key={candidate.id}
              href={`/candidates/${candidate.id}`}
              className="rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="overflow-hidden transition-colors hover:border-primary/40 hover:bg-muted/40">
                <CardContent className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-base font-semibold text-foreground">
                        {candidate.fullName}
                      </h2>
                      <StatusBadge value={candidate.status} />
                      {candidate.documents.length > 0 ? <StatusBadge value="CV uploaded" /> : null}
                    </div>
                    <p className="mt-1 break-all text-sm text-muted-foreground">
                      {candidate.primaryEmail ?? "No email"} · {candidate.applications.length}{" "}
                      applications · Updated {formatDate(candidate.updatedAt)}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {candidate.applications.slice(0, 2).map((application) => (
                        <StatusBadge
                          key={application.id}
                          value={`${application.job.title}: ${applicationStatusLabel(
                            application.status,
                          )}`}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-2 text-sm lg:min-w-64">
                    <CandidateSignal
                      icon={<FileText className="size-4" aria-hidden="true" />}
                      label="Latest application"
                      value={latestApplicationLabel(candidate)}
                    />
                    <CandidateSignal
                      icon={<Sparkles className="size-4" aria-hidden="true" />}
                      label="Results"
                      value={candidateResultLabel(candidate)}
                    />
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

function CandidateSignal({
  icon,
  label,
  value,
}: {
  readonly icon: ReactNode;
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-border/80 bg-surface px-3 py-2">
      <span className="mt-0.5 text-primary">{icon}</span>
      <span className="min-w-0">
        <span className="block text-xs font-medium uppercase text-muted-foreground">{label}</span>
        <span className="block truncate font-medium text-foreground">{value}</span>
      </span>
    </div>
  );
}

function latestApplicationLabel(candidate: CandidateListItem): string {
  const application = candidate.applications.at(0);
  if (application === undefined) {
    return "No applications";
  }
  const stage = application.currentStage?.name ?? applicationStatusLabel(application.status);
  return `${application.job.title} · ${stage}`;
}

function candidateResultLabel(candidate: CandidateListItem): string {
  if (
    candidate.applications.some((application) =>
      application.interviewSessions.some((interview) =>
        interview.hrReports.some((report) => report.status === "READY"),
      ),
    )
  ) {
    return "Report ready";
  }
  if (
    candidate.applications.some((application) =>
      application.cvScreenings.some((screening) => screening.screeningStatus === "COMPLETE"),
    )
  ) {
    return "CV screened";
  }
  if (
    candidate.invitations.some((invitation) =>
      ["SENT", "OPENED", "ACCEPTED"].includes(invitation.status),
    )
  ) {
    return "Invitation active";
  }
  return "No results yet";
}

function applicationStatusLabel(status: string): string {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}
