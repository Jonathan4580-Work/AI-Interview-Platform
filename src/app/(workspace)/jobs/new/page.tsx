import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createJobAction } from "@/server/hr-workspace/actions";
import { requireHrWorkspaceContext } from "@/server/hr-workspace/context";

import { Field, LongTextField, NativeSelect, TextField } from "../../_components/hr-ui";

export default async function NewJobPage() {
  await requireHrWorkspaceContext("jobs:manage");
  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Jobs"
        title="Create job"
        description="Create an active job and publish a simple interview plan candidates can complete in the browser."
      />
      <form action={createJobAction}>
        <Card>
          <CardHeader>
            <CardTitle>Job details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Field label="Job title">
              <TextField name="title" required minLength={2} maxLength={120} />
            </Field>
            <Field label="Summary">
              <LongTextField name="summary" required maxLength={2000} />
            </Field>
            <Field label="Details">
              <LongTextField name="details" maxLength={10000} />
            </Field>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Employment type">
                <NativeSelect name="employmentType" defaultValue="FULL_TIME">
                  <option value="FULL_TIME">Full time</option>
                  <option value="PART_TIME">Part time</option>
                  <option value="CONTRACT">Contract</option>
                  <option value="TEMPORARY">Temporary</option>
                  <option value="INTERNSHIP">Internship</option>
                </NativeSelect>
              </Field>
              <Field label="Workplace">
                <NativeSelect name="workplaceType" defaultValue="REMOTE">
                  <option value="REMOTE">Remote</option>
                  <option value="HYBRID">Hybrid</option>
                  <option value="ONSITE">On-site</option>
                </NativeSelect>
              </Field>
              <Field label="Seniority">
                <NativeSelect name="seniorityLevel" defaultValue="MID">
                  <option value="ENTRY">Entry</option>
                  <option value="MID">Mid</option>
                  <option value="SENIOR">Senior</option>
                  <option value="STAFF">Staff</option>
                  <option value="EXECUTIVE">Executive</option>
                </NativeSelect>
              </Field>
            </div>
            <Field
              label="Interview questions"
              hint="Enter 3 to 5 questions, one per line. The first and last are used as the opening and closing prompts."
            >
              <LongTextField
                name="questions"
                required
                defaultValue={
                  "Please introduce yourself and briefly describe your relevant experience.\nWhat project or responsibility best demonstrates your fit for this role?\nTell us about a difficult problem you solved and how you approached it.\nWhat questions or context would help you be successful in this role?"
                }
              />
            </Field>
            <div className="flex justify-end">
              <Button type="submit">Create job</Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
