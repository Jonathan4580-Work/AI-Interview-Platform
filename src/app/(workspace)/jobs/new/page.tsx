import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createJobAction, createJobFromJdAction } from "@/server/hr-workspace/actions";
import { requireHrWorkspaceContext } from "@/server/hr-workspace/context";

import { Field, LongTextField, NativeSelect, TextField } from "../../_components/hr-ui";

export default async function NewJobPage() {
  await requireHrWorkspaceContext("jobs:manage");
  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Jobs"
        title="Create job"
        description="Paste or upload a job description, generate a structured draft, then review it before publishing."
      />
      <form action={createJobFromJdAction}>
        <Card>
          <CardHeader>
            <CardTitle>Create from job description</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Field
              label="Paste job description"
              hint="Paste the role description here, or upload a PDF/DOCX below. The generated profile remains a draft until HR publishes it."
            >
              <LongTextField
                name="jobDescriptionText"
                minLength={80}
                maxLength={50000}
                rows={12}
                placeholder="Paste responsibilities, requirements, skills, tools, location, and interview guidance."
              />
            </Field>
            <Field
              label="Upload PDF or DOCX"
              hint="Maximum 4 MB. Paste text if the document cannot be read locally."
            >
              <TextField
                name="jobDescriptionFile"
                type="file"
                accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx"
              />
            </Field>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
              <p>OpenAI creates an AI-generated draft. HR must review, edit, and publish it.</p>
              <Button type="submit">Analyze job description</Button>
            </div>
          </CardContent>
        </Card>
      </form>
      <form action={createJobAction}>
        <Card>
          <CardHeader>
            <CardTitle>Manual job setup</CardTitle>
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
