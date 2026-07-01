import { notFound } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { updateJobAction } from "@/server/hr-workspace/actions";
import { requireHrWorkspaceContext } from "@/server/hr-workspace/context";
import { getJobDetail } from "@/server/hr-workspace/queries";

import { Field, LongTextField, NativeSelect, TextField } from "../../../_components/hr-ui";

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
      <PageHeader eyebrow="Jobs" title="Edit job" description={job.title} />
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
              />
            </Field>
            <Field label="Details">
              <LongTextField name="details" defaultValue={readDetails(job.descriptionJson)} />
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
            <div className="flex justify-end">
              <Button type="submit">Save changes</Button>
            </div>
          </CardContent>
        </Card>
      </form>
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
