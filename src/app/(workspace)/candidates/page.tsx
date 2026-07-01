import Link from "next/link";
import { Plus, Search } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireHrWorkspaceContext } from "@/server/hr-workspace/context";
import { listCandidates } from "@/server/hr-workspace/queries";

import { EmptyPanel, Field, StatusBadge, TextField, formatDate } from "../_components/hr-ui";

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
              className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="transition-colors hover:border-primary/40 hover:bg-muted/40">
                <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-base font-semibold text-foreground">
                        {candidate.fullName}
                      </h2>
                      <StatusBadge value={candidate.status} />
                    </div>
                    <p className="mt-1 break-all text-sm text-muted-foreground">
                      {candidate.primaryEmail ?? "No email"} · {candidate.applications.length}{" "}
                      applications · Updated {formatDate(candidate.updatedAt)}
                    </p>
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
