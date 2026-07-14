import { notFound } from "next/navigation";
import { CalendarClock, CheckCircle2 } from "lucide-react";

import { PendingSubmitButton } from "@/components/forms/pending-submit-button";
import { PremiumHero } from "@/components/recruiting/recruiting-ui";
import { ThemeToggle } from "@/components/theme/theme-toggle";
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
  const isHrInterview = request.purpose === "HR_INTERVIEW";

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto grid w-full max-w-5xl gap-5 px-4 py-10 sm:px-6 lg:px-8">
        <PremiumHero
          eyebrow={request.company.name}
          title={isHrInterview ? "Book your HR interview" : "Confirm interview availability"}
          description={
            isHrInterview
              ? "Select the HR interview time that works best for you. The hiring team will use this slot for the next conversation."
              : "Select the interview time that works best for you. The hiring team will send the interview invitation after your availability is confirmed."
          }
          actions={<ThemeToggle className="text-white hover:bg-white/15 hover:text-white" />}
        />

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

        <Card className="overflow-hidden shadow-lg shadow-primary/5">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CalendarClock aria-hidden="true" className="size-4 text-primary" />
                  {request.job.title}
                </CardTitle>
                <p className="mt-2 text-sm text-muted-foreground">
                  Choose the time you can attend. You will see the confirmed slot in your candidate
                  dashboard.
                </p>
              </div>
              <div className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {isHrInterview ? "Final-stage conversation" : "Interview availability"}
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm">
            <div className="grid gap-3 rounded-2xl border border-border bg-gradient-to-br from-muted/50 to-surface p-4 sm:grid-cols-3">
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Candidate</p>
                <p className="mt-1 font-medium text-foreground">{request.candidate.fullName}</p>
                <p className="mt-1 break-all text-muted-foreground">
                  {request.candidate.primaryEmail ?? "Candidate email not recorded"}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Company</p>
                <p className="mt-1 font-medium text-foreground">{request.company.name}</p>
                <p className="mt-1 text-muted-foreground">Hiring team request</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Expires</p>
                <p className="mt-1 font-medium text-foreground">
                  {formatDateTime(request.expiresAt)}
                </p>
                <p className="mt-1 text-muted-foreground">Contact the team if this expires.</p>
              </div>
            </div>

            {confirmed || expired ? null : (
              <form action={confirmCandidateAvailabilityAction} className="grid gap-4">
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
                        className="group flex cursor-pointer gap-3 rounded-2xl border border-border/80 bg-surface/80 p-4 shadow-xs transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary-soft/40 focus-within:border-primary focus-within:ring-2 focus-within:ring-ring"
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
                            {slot.isOnline
                              ? isHrInterview
                                ? "Online HR interview"
                                : "Online interview"
                              : "In-person interview"}
                            {slot.locationNote === null ? "" : ` · ${slot.locationNote}`}
                          </span>
                        </span>
                      </label>
                    ))}
                  </fieldset>
                )}
                <PendingSubmitButton disabled={slots.length === 0} pendingLabel="Confirming...">
                  {isHrInterview ? "Confirm HR interview" : "Confirm availability"}
                </PendingSubmitButton>
              </form>
            )}

            {confirmed && request.selectedSlot !== null ? (
              <div className="rounded-2xl border border-success/25 bg-success/10 p-4">
                <p className="font-semibold text-success">Confirmed slot</p>
                <p className="mt-1 text-foreground">
                  {formatDateTime(request.selectedSlot.startAt)} -{" "}
                  {formatTime(request.selectedSlot.endAt)}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  The hiring team will use this time for the next conversation.
                </p>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button asChild variant="secondary">
                <a href="/candidate/applications">View my applications</a>
              </Button>
              <Button asChild variant="quiet">
                <a href="/candidate">Candidate dashboard</a>
              </Button>
            </div>
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
