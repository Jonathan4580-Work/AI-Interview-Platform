"use client";

import { useMemo, useState } from "react";

import { PendingSubmitButton } from "@/components/forms/pending-submit-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { parseJobDescriptionAutofill } from "@/modules/jobs/jd-local-autofill";

import { Field, LongTextField, TextField } from "../../_components/hr-ui";

const ACCEPTED_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export function JobDescriptionInputCard() {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileStatus, setFileStatus] = useState<string>("No file selected.");
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const preview = useMemo(() => parseJobDescriptionAutofill(text), [text]);
  const hasPreview =
    preview.title !== null ||
    preview.location !== null ||
    preview.department !== null ||
    preview.employmentType !== null ||
    preview.experienceLevel !== null ||
    preview.responsibilities.length > 0 ||
    preview.requirements.length > 0 ||
    preview.niceToHaveSkills.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create from job description</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid gap-3 rounded-md border border-border bg-muted/20 p-3 text-sm">
          <p className="font-medium text-foreground">Choose one input method</p>
          <div className="grid gap-2 text-muted-foreground sm:grid-cols-3">
            <span>1. Paste JD text</span>
            <span>2. Upload PDF</span>
            <span>3. Upload DOCX</span>
          </div>
        </div>
        <Field
          label="Paste job description"
          hint="Local autofill runs in your browser only. OpenAI is not called until you click Analyze JD."
        >
          <LongTextField
            name="jobDescriptionText"
            minLength={80}
            maxLength={50000}
            rows={12}
            value={text}
            onChange={(event) => {
              setText(event.target.value);
            }}
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
            onChange={(event) => {
              const file = event.currentTarget.files?.[0] ?? null;
              setFileName(file?.name ?? null);
              if (file === null) {
                setFileStatus("No file selected.");
                return;
              }
              if (ACCEPTED_TYPES.has(file.type) || /\.(pdf|docx)$/iu.test(file.name)) {
                setFileStatus("Ready for extraction after you click Analyze JD.");
              } else {
                setFileStatus("Unsupported file type. Choose PDF or DOCX.");
              }
            }}
          />
        </Field>
        <div className="grid gap-3 rounded-md border border-border p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium text-foreground">Detected draft preview</p>
            <span className="rounded-md bg-warning/15 px-2 py-1 text-xs font-medium text-warning-foreground">
              AI analysis has not run yet
            </span>
          </div>
          {hasPreview ? (
            <div className="grid gap-3 md:grid-cols-2">
              <PreviewItem label="Title" value={preview.title} />
              <PreviewItem label="Department" value={preview.department} />
              <PreviewItem label="Location" value={preview.location} />
              <PreviewItem label="Employment type" value={preview.employmentType} />
              <PreviewItem label="Experience" value={preview.experienceLevel} />
              <PreviewList label="Responsibilities" values={preview.responsibilities} />
              <PreviewList label="Requirements" values={preview.requirements} />
              <PreviewList label="Nice-to-have" values={preview.niceToHaveSkills} />
            </div>
          ) : (
            <p className="text-muted-foreground">
              Paste a structured JD to preview obvious fields before analysis.
            </p>
          )}
          <p className="text-muted-foreground">
            {fileName === null ? fileStatus : `${fileName}: ${fileStatus}`}
          </p>
          <input type="hidden" name="detectedTitle" value={preview.title ?? ""} />
          {validationMessage === null ? null : (
            <p className="rounded-md border border-danger/30 bg-danger/10 p-3 text-danger">
              {validationMessage}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
          <p>
            OpenAI creates an AI-generated draft only after this explicit action. HR review is
            required.
          </p>
          <PendingSubmitButton
            pendingLabel="Analyzing JD..."
            onClick={(event) => {
              const hasText = text.trim().length > 0;
              const hasFile = fileName !== null;
              if (!hasText && !hasFile) {
                event.preventDefault();
                setValidationMessage("Paste a job description or upload a PDF/DOCX file.");
                return;
              }
              setValidationMessage(null);
            }}
          >
            Analyze JD
          </PendingSubmitButton>
        </div>
      </CardContent>
    </Card>
  );
}

function PreviewItem({ label, value }: { readonly label: string; readonly value: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-foreground">{value ?? "Not detected"}</p>
    </div>
  );
}

function PreviewList({
  label,
  values,
}: {
  readonly label: string;
  readonly values: readonly string[];
}) {
  return (
    <div className="md:col-span-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      {values.length === 0 ? (
        <p className="mt-1 text-muted-foreground">Not detected</p>
      ) : (
        <ul className="mt-1 list-disc space-y-1 pl-5 text-foreground">
          {values.slice(0, 5).map((value) => (
            <li key={value}>{value}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
