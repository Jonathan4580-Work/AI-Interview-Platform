"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { setJobStatusAction } from "@/server/hr-workspace/actions";

export function JobStatusForm({
  jobId,
  currentStatus,
}: {
  readonly jobId: string;
  readonly currentStatus: string;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const nextStatus = currentStatus === "OPEN" ? "CLOSED" : "OPEN";
  const isClosing = nextStatus === "CLOSED";

  if (isClosing && !confirmed) {
    return (
      <Button
        type="button"
        variant="secondary"
        onClick={() => {
          setConfirmed(true);
        }}
      >
        Close job
      </Button>
    );
  }

  return (
    <form action={setJobStatusAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="status" value={nextStatus} />
      {isClosing ? <span className="text-sm text-muted-foreground">Confirm close?</span> : null}
      <SubmitButton label={isClosing ? "Confirm close" : "Reopen job"} />
      {isClosing ? (
        <Button
          type="button"
          variant="quiet"
          onClick={() => {
            setConfirmed(false);
          }}
        >
          Cancel
        </Button>
      ) : null}
    </form>
  );
}

function SubmitButton({ label }: { readonly label: string }) {
  const status = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={status.pending}>
      {status.pending ? "Saving..." : label}
    </Button>
  );
}
