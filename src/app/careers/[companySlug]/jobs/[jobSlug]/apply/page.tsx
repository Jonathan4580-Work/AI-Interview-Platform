import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, LockKeyhole, UserRound } from "lucide-react";

import { PremiumHero, SectionCard } from "@/components/recruiting/recruiting-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  loginCandidateAccountAction,
  registerCandidateAccountAction,
  submitPublicApplicationAction,
} from "@/server/public-careers/actions";
import { getCandidateAccountSession } from "@/server/public-careers/candidate-auth";
import { getPublicCareerJobDetail } from "@/server/public-careers/queries";

import type { ReactNode } from "react";

import { CandidateAuthSubmitButton, CandidateCvInput } from "./candidate-apply-controls";

export default async function PublicApplyPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ readonly companySlug: string; readonly jobSlug: string }>;
  readonly searchParams: Promise<{ readonly authError?: string; readonly applyError?: string }>;
}) {
  const { companySlug, jobSlug } = await params;
  const query = await searchParams;
  const job = await getPublicCareerJobDetail(companySlug, jobSlug);
  if (job === null) notFound();

  const session = await getCandidateAccountSession();
  const candidateSession = session?.companyId === job.company.id ? session : null;
  const returnTo = `/careers/${job.company.slug}/jobs/${job.slug}/apply`;

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto grid w-full max-w-5xl gap-5 px-4 py-10 sm:px-6 lg:px-8">
        <Button asChild variant="quiet" className="w-fit">
          <Link href={`/careers/${job.company.slug}/jobs/${job.slug}`}>
            <ArrowLeft aria-hidden="true" />
            Back to job
          </Link>
        </Button>

        <PremiumHero
          eyebrow={job.company.name}
          title={`Apply for ${job.title}`}
          description="Create a candidate account or sign in, upload your CV, and submit your application securely."
        />
        <div className="grid gap-3 rounded-2xl border border-border/80 bg-white/80 p-4 shadow-xs">
          <div className="flex flex-wrap gap-2">
            {job.location === null ? null : <Badge variant="neutral">{job.location}</Badge>}
            <Badge variant="neutral">{job.employmentType}</Badge>
            <Badge variant="neutral">{job.seniorityLevel}</Badge>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">{job.summary}</p>
        </div>

        {candidateSession === null ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <CandidateRegisterCard
              companyId={job.company.id}
              returnTo={returnTo}
              authError={query.authError}
            />
            <CandidateLoginCard companyId={job.company.id} returnTo={returnTo} />
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[0.72fr_1.28fr]">
            <SectionCard
              title="Before you submit"
              description="Your CV is used for HR review and advisory screening only."
            >
              <div className="grid gap-3 text-sm text-muted-foreground">
                <p>DOCX is recommended for best AI screening accuracy.</p>
                <p>PDF is supported, but scanned or protected PDFs may not extract clearly.</p>
                <p>After submission, you can track progress from your candidate dashboard.</p>
              </div>
            </SectionCard>
            <Card>
              <CardHeader>
                <CardTitle>Application details</CardTitle>
              </CardHeader>
              <CardContent>
                {query.applyError === undefined ? null : (
                  <Alert variant="danger" className="mb-4">
                    <AlertTitle>Application not submitted</AlertTitle>
                    <AlertDescription>{query.applyError}</AlertDescription>
                  </Alert>
                )}
                <form action={submitPublicApplicationAction} className="grid gap-4">
                  <input type="hidden" name="companySlug" value={job.company.slug} />
                  <input type="hidden" name="jobSlug" value={job.slug} />
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Full name">
                      <Input name="fullName" defaultValue={candidateSession.fullName} required />
                    </Field>
                    <Field label="Email">
                      <Input
                        name="email"
                        type="email"
                        defaultValue={candidateSession.email}
                        required
                      />
                    </Field>
                  </div>
                  <Field label="Phone number">
                    <Input name="phone" defaultValue={candidateSession.phone ?? ""} />
                  </Field>
                  <Field label="CV">
                    <CandidateCvInput />
                  </Field>
                  <Field label="Cover note">
                    <Textarea
                      name="coverNote"
                      placeholder="Optional context you would like the hiring team to know."
                    />
                  </Field>
                  <label className="flex gap-3 rounded-md border border-border bg-surface p-3 text-sm">
                    <input name="consent" type="checkbox" className="mt-1 size-4" required />
                    <span className="text-muted-foreground">
                      I confirm this application is accurate and consent to Aptly and{" "}
                      {job.company.name} processing my application data for recruitment.
                    </span>
                  </label>
                  <div className="flex flex-wrap items-center gap-3">
                    <CandidateAuthSubmitButton pendingLabel="Uploading CV...">
                      <FileText aria-hidden="true" />
                      Submit application
                    </CandidateAuthSubmitButton>
                    <p className="text-sm text-muted-foreground">
                      DOCX is recommended for best screening accuracy. PDF and DOCX files up to 10
                      MB are supported.
                    </p>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </section>
    </main>
  );
}

function CandidateRegisterCard({
  companyId,
  returnTo,
  authError,
}: {
  readonly companyId: string;
  readonly returnTo: string;
  readonly authError?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserRound aria-hidden="true" className="size-4" />
          Create candidate account
        </CardTitle>
      </CardHeader>
      <CardContent>
        {authError === undefined ? null : (
          <Alert variant="danger" className="mb-4">
            <AlertTitle>Account action failed</AlertTitle>
            <AlertDescription>{authError}</AlertDescription>
          </Alert>
        )}
        <form action={registerCandidateAccountAction} className="grid gap-3">
          <input type="hidden" name="companyId" value={companyId} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <Field label="Full name">
            <Input name="fullName" autoComplete="name" required />
          </Field>
          <Field label="Email">
            <Input name="email" type="email" autoComplete="email" required />
          </Field>
          <Field label="Phone number">
            <Input name="phone" autoComplete="tel" />
          </Field>
          <Field label="Password">
            <Input name="password" type="password" autoComplete="new-password" required />
          </Field>
          <Field label="Confirm password">
            <Input name="confirmPassword" type="password" autoComplete="new-password" required />
          </Field>
          <CandidateAuthSubmitButton pendingLabel="Creating account...">
            Create account
          </CandidateAuthSubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}

function CandidateLoginCard({
  companyId,
  returnTo,
}: {
  readonly companyId: string;
  readonly returnTo: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LockKeyhole aria-hidden="true" className="size-4" />
          Already applied before?
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={loginCandidateAccountAction} className="grid gap-3">
          <input type="hidden" name="companyId" value={companyId} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <Field label="Email">
            <Input name="email" type="email" autoComplete="email" required />
          </Field>
          <Field label="Password">
            <Input name="password" type="password" autoComplete="current-password" required />
          </Field>
          <CandidateAuthSubmitButton variant="secondary" pendingLabel="Signing in...">
            Sign in and continue
          </CandidateAuthSubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <label className="grid gap-1 text-sm font-medium text-foreground">
      <span>{label}</span>
      {children}
    </label>
  );
}
