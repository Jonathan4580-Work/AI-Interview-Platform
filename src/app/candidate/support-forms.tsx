"use client";

import { useState } from "react";

import { candidatePost } from "@/components/candidate/candidate-api";
import { CandidateShell } from "@/components/candidate/candidate-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function CandidateRequestForm({ mode }: { readonly mode: "support" | "accommodation" }) {
  const [contactEmail, setContactEmail] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("TECHNICAL");
  const [submitted, setSubmitted] = useState(false);
  const endpoint = mode === "support" ? "/api/candidate/support" : "/api/candidate/accommodations";

  async function submit() {
    const result = await candidatePost(endpoint, {
      ...(mode === "support" ? { category } : { type: category }),
      contactEmail,
      message,
    });
    setSubmitted(result.ok);
  }

  return (
    <CandidateShell
      title={mode === "support" ? "Candidate support" : "Accessibility and accommodations"}
      description="Send a request to the hiring team. This does not start the interview."
      actions={<Button onClick={() => void submit()}>Submit request</Button>}
    >
      {submitted ? (
        <Alert variant="success">
          <AlertTitle>Request submitted</AlertTitle>
          <AlertDescription>The hiring team will review your request.</AlertDescription>
        </Alert>
      ) : null}
      <FormField label="Contact email" htmlFor="contact-email" required>
        <Input
          id="contact-email"
          value={contactEmail}
          onChange={(event) => {
            setContactEmail(event.target.value);
          }}
        />
      </FormField>
      <FormField label="Category" htmlFor="request-category">
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger id="request-category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(mode === "support"
              ? ["TECHNICAL", "ACCESSIBILITY", "SCHEDULING", "PRIVACY", "OTHER"]
              : ["WEBCAM_ALTERNATIVE", "TIME_EXTENSION", "ACCESSIBILITY_SUPPORT", "OTHER"]
            ).map((item) => (
              <SelectItem key={item} value={item}>
                {item.replaceAll("_", " ").toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
      <FormField label="Message" htmlFor="request-message" required>
        <Textarea
          id="request-message"
          value={message}
          onChange={(event) => {
            setMessage(event.target.value);
          }}
        />
      </FormField>
    </CandidateShell>
  );
}
