"use client";

import { useState } from "react";

import { candidatePost } from "@/components/candidate/candidate-api";
import { CandidateShell } from "@/components/candidate/candidate-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/textarea";

export function WithdrawalClient() {
  const [reason, setReason] = useState("");
  const [withdrawn, setWithdrawn] = useState(false);

  async function submit() {
    const result = await candidatePost("/api/candidate/withdrawal", { reason });
    setWithdrawn(result.ok);
  }

  return (
    <CandidateShell
      title="Withdraw from this interview"
      description="Confirming withdrawal closes this invitation and notifies the hiring team."
      actions={
        <Button variant="destructive" onClick={() => void submit()}>
          Confirm withdrawal
        </Button>
      }
    >
      {withdrawn ? (
        <Alert variant="success">
          <AlertTitle>Withdrawal confirmed</AlertTitle>
          <AlertDescription>Your interview invitation has been closed.</AlertDescription>
        </Alert>
      ) : null}
      <FormField label="Reason" htmlFor="withdrawal-reason" description="Optional">
        <Textarea
          id="withdrawal-reason"
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
          }}
        />
      </FormField>
    </CandidateShell>
  );
}
