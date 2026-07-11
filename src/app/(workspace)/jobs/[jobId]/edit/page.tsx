import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { setJobStatusAction, updateJobAction } from "@/server/hr-workspace/actions";
import { requireHrWorkspaceContext } from "@/server/hr-workspace/context";
import { getJobDetail } from "@/server/hr-workspace/queries";

import {
  Field,
  LongTextField,
  NativeSelect,
  StatusBadge,
  TextField,
} from "../../../_components/hr-ui";

export default async function EditJobPage({
  params,
}: {
  readonly params: Promise<{ readonly jobId: string }>;
}) {
  const context = await requireHrWorkspaceContext("jobs:manage");
  const { jobId } = await params;
  const job = await getJobDetail(context, jobId);
  if (job === null) notFound();

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Jobs"
        title="Edit job"
        description="Update the visible job profile and operational status."
        actions={
          <Button asChild variant="secondary">
            <Link href={`/jobs/${job.id}`}>Back to job</Link>
          </Button>
        }
      />
      <form action={updateJobAction}>
        <input type="hidden" name="jobId" value={job.id} />
        <Card>
          <CardHeader>
            <CardTitle>Job details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Field label="Job title">
              <TextField name="title" required defaultValue={job.title} />
            </Field>
            <Field label="Summary">
              <LongTextField
                name="summary"
                required
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
            <div className="grid gap-4 md:grid-cols-4">
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
              <Field label="Status">
                <NativeSelect name="status" defaultValue={job.status}>
                  <option value="DRAFT">Draft</option>
                  <option value="OPEN">Open</option>
                  <option value="PAUSED">Paused</option>
                  <option value="CLOSED">Closed</option>
                  <option value="ARCHIVED">Archived</option>
                </NativeSelect>
              </Field>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Location">
                <TextField
                  name="locationText"
                  defaultValue={job.intelligenceProfile?.locationText ?? ""}
                  maxLength={160}
                />
              </Field>
              <Field label="Department">
                <TextField
                  name="departmentText"
                  defaultValue={job.intelligenceProfile?.departmentText ?? ""}
                  maxLength={160}
                />
              </Field>
              <Field label="Experience level">
                <TextField
                  name="experienceText"
                  defaultValue={job.intelligenceProfile?.experienceText ?? ""}
                  maxLength={400}
                />
              </Field>
              <Field label="Requirements">
                <LongTextField
                  name="requiredSkills"
                  defaultValue={requirementsList(job.requirementsJson)}
                  rows={6}
                />
              </Field>
              <Field label="Responsibilities">
                <LongTextField
                  name="responsibilities"
                  defaultValue={jsonList(job.intelligenceProfile?.responsibilitiesJson)}
                  rows={7}
                />
              </Field>
              <Field label="Skills">
                <LongTextField
                  name="niceToHaveSkills"
                  defaultValue={jsonList(job.intelligenceProfile?.niceToHaveSkillsJson)}
                  rows={7}
                />
              </Field>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                Current status <StatusBadge value={job.status} />
              </span>
              <Button type="submit">Save changes</Button>
            </div>
          </CardContent>
        </Card>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>Job availability</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground">
          <p>
            Closed jobs are removed from open-job counts and should not be used for new invitations.
          </p>
          <form action={setJobStatusAction}>
            <input type="hidden" name="jobId" value={job.id} />
            <input type="hidden" name="status" value={job.status === "OPEN" ? "CLOSED" : "OPEN"} />
            <Button type="submit" variant="secondary">
              {job.status === "OPEN" ? "Close job" : "Reopen job"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
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

function jsonList(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value.filter((item): item is string => typeof item === "string").join("\n");
}

function requirementsList(value: unknown): string {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return "";
  const items = (value as { items?: unknown }).items;
  return jsonList(items);
}
