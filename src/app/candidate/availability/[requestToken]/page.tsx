import { notFound } from "next/navigation";
import { CalendarClock, CheckCircle2 } from "lucide-react";

import { PendingSubmitButton } from "@/components/forms/pending-submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  confirmCandidateAvailabilityAction,
  getCandidateAvailabilityRequest,
} from "@/server/candidate-availability";

export default async function CandidateAvailabilityPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ readonly requestToken: string }>;
  readonly searchParams: Promise<{ readonly confirmed?: string; readonly error?: string }>;
}) {
  const { requestToken } = await params;
  const query = await searchParams;
  const data = await getCandidateAvailabilityRequest(requestToken);
  if (data === null) notFound();

  const { request, slots } = data;
  const expired = request.expiresAt <= new Date();
  const confirmed = request.status === "CONFIRMED" || query.confirmed === "1";

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto grid w-full max-w-4xl gap-5 px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-2">
          <p className="text-sm font-medium text-muted-foreground">{request.company.name}</p>
          <h1 className="text-3xl font-semibold tracking-normal text-foreground">
            Confirm interview availability
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Select the interview time that works best for you. The hiring team will send the
            interview invitation after your availability is confirmed.
          </p>
        </div>

        {confirmed ? (
          <Alert variant="success">
            <CheckCircle2 aria-hidden="true" className="size-4" />
            <AlertTitle>Availability confirmed</AlertTitle>
            <AlertDescription>
              {request.selectedSlot === null
                ? "The hiring team can now schedule the interview."
                : `You selected ${formatDateTime(request.selectedSlot.startAt)}.`}
            </AlertDescription>
          </Alert>
        ) : null}
        {query.error === "expired" || expired ? (
          <Alert variant="warning">
            <AlertTitle>Availability request unavailable</AlertTitle>
            <AlertDescription>
              This request has expired. Contact the hiring team for updated times.
            </AlertDescription>
          </Alert>
        ) : null}
        {query.error === "slot" ? (
          <Alert variant="warning">
            <AlertTitle>Select a time</AlertTitle>
            <AlertDescription>Choose one of the available interview slots.</AlertDescription>
          </Alert>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock aria-hidden="true" className="size-4" />
              {request.job.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm">
            <div className="rounded-md border border-border bg-muted/20 p-4">
              <p className="font-medium text-foreground">{request.candidate.fullName}</p>
              <p className="mt-1 break-all text-muted-foreground">
                {request.candidate.primaryEmail ?? "Candidate email not recorded"}
              </p>
              <p className="mt-3 text-muted-foreground">
                Request expires {formatDateTime(request.expiresAt)}.
              </p>
            </div>

            {confirmed || expired ? null : (
              <form action={confirmCandidateAvailabilityAction} className="grid gap-3">
                <input type="hidden" name="requestToken" value={requestToken} />
                {slots.length === 0 ? (
                  <div className="rounded-md border border-dashed border-border p-5 text-sm text-muted-foreground">
                    No interview slots are currently available. Contact the hiring team for support.
                  </div>
                ) : (
                  <fieldset className="grid gap-3">
                    <legend className="sr-only">Available interview times</legend>
                    {slots.map((slot) => (
                      <label
                        key={slot.id}
                        className="flex cursor-pointer gap-3 rounded-lg border border-border p-4 transition hover:bg-muted/30"
                      >
                        <input
                          required
                          type="radio"
                          name="slotId"
                          value={slot.id}
                          className="mt-1"
                        />
                        <span className="grid gap-1">
                          <span className="font-medium text-foreground">
                            {formatDateTime(slot.startAt)} - {formatTime(slot.endAt)}
                          </span>
                          <span className="text-muted-foreground">
                            {slot.isOnline ? "Online interview" : "In-person interview"}
                            {slot.locationNote === null ? "" : ` · ${slot.locationNote}`}
                          </span>
                        </span>
                      </label>
                    ))}
                  </fieldset>
                )}
                <PendingSubmitButton disabled={slots.length === 0} pendingLabel="Confirming...">
                  Confirm availability
                </PendingSubmitButton>
              </form>
            )}

            <Button asChild variant="secondary">
              <a href="/candidate/applications">View my applications</a>
            </Button>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function formatTime(value: Date): string {
  return new Intl.DateTimeFormat("en", { timeStyle: "short" }).format(value);
}
