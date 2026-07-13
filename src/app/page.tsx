import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardList,
  FileSearch,
  Globe2,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  Video,
} from "lucide-react";

import { AptlyLogo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    title: "JD-based job creation",
    description:
      "Turn job descriptions into structured role profiles, requirements, and interview plans.",
    icon: ClipboardList,
  },
  {
    title: "Public careers marketplace",
    description: "Publish polished job pages with clean candidate-facing application flows.",
    icon: Globe2,
  },
  {
    title: "Candidate applications",
    description:
      "Collect candidate profiles, CVs, consent, and application history in one workflow.",
    icon: UserRoundCheck,
  },
  {
    title: "AI CV screening",
    description:
      "Surface advisory match signals, evidence, and limitations without automatic decisions.",
    icon: FileSearch,
  },
  {
    title: "Structured interviews",
    description:
      "Guide candidates through secure browser interviews with readiness and recovery support.",
    icon: Video,
  },
  {
    title: "HR reports",
    description:
      "Review transcripts, competency evidence, confidence, and human-owned decision support.",
    icon: BarChart3,
  },
] as const;

const steps = [
  "Upload JD",
  "Publish job",
  "Candidate applies",
  "AI screens CV",
  "HR shortlists",
  "Candidate interviews",
] as const;

export default function PublicLandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-canvas text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <AptlyLogo />
            <span className="text-lg font-semibold tracking-normal">Aptly</span>
          </Link>
          <nav className="flex items-center gap-2" aria-label="Public">
            <ThemeToggle />
            <Button asChild variant="secondary" size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
          </nav>
        </div>
      </header>

      <section className="relative">
        <div className="absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.16),transparent_34%),radial-gradient(circle_at_top_right,rgba(124,58,237,0.18),transparent_36%)]" />
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-24">
          <div className="flex flex-col justify-center">
            <Badge variant="primary" className="w-fit">
              <Sparkles className="size-3.5" aria-hidden="true" />
              Recruiting operations, refined
            </Badge>
            <h1 className="mt-6 max-w-4xl text-4xl font-semibold tracking-normal text-foreground sm:text-5xl lg:text-6xl">
              AI-powered hiring, from job description to interview insights
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
              Aptly helps hiring teams create better roles, publish candidate-friendly job pages,
              screen CVs with evidence, run structured interviews, and review results in one calm
              workspace.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/login">
                  Sign in
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <Link href="/careers/aptly-demo">View demo careers page</Link>
              </Button>
            </div>
          </div>

          <Card className="border-primary/10 bg-background/80 shadow-xl shadow-primary/10 backdrop-blur">
            <CardContent className="grid gap-5 p-5 sm:p-6">
              <div className="rounded-2xl bg-gradient-to-br from-primary to-violet-600 p-5 text-white shadow-lg">
                <p className="text-sm font-medium text-white/80">Hiring workspace</p>
                <h2 className="mt-2 text-2xl font-semibold">Software Engineer</h2>
                <p className="mt-2 text-sm text-white/80">
                  Published role with AI screening, availability, interview, and report readiness.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ["Open jobs", "4"],
                  ["New applications", "12"],
                  ["Shortlisted", "5"],
                  ["Reports ready", "3"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-border/80 bg-surface/80 p-4"
                  >
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <p className="mt-2 text-3xl font-semibold">{value}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl border border-border/80 bg-surface/80 p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-success-soft p-2 text-success">
                    <CheckCircle2 className="size-5" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-semibold">Evidence-linked evaluation ready</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Human review stays in control. AI output is decision support only.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card key={feature.title} className="bg-background/90">
                <CardContent className="p-6">
                  <div className="mb-5 inline-flex rounded-2xl bg-primary-soft p-3 text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </div>
                  <h2 className="text-lg font-semibold">{feature.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-border bg-background p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-primary">
                How it works
              </p>
              <h2 className="mt-2 text-3xl font-semibold">A complete hiring path, step by step</h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-muted-foreground">
              Each stage is designed for clear HR control, candidate transparency, and safe AI
              assistance.
            </p>
          </div>
          <ol className="mt-8 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            {steps.map((step, index) => (
              <li
                key={step}
                className="rounded-2xl border border-border/80 bg-surface/80 p-4 shadow-xs"
              >
                <span className="inline-flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {index + 1}
                </span>
                <p className="mt-4 text-sm font-semibold">{step}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-5 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:px-8">
        <Card className="bg-gradient-to-br from-primary-soft to-background">
          <CardContent className="p-6 sm:p-8">
            <BriefcaseBusiness className="size-7 text-primary" aria-hidden="true" />
            <h2 className="mt-5 text-2xl font-semibold">Built for hiring teams</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Keep jobs, applications, screening, availability, interviews, and reports organized
              without turning AI into the decision maker.
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-violet-500/10 to-background">
          <CardContent className="p-6 sm:p-8">
            <ShieldCheck className="size-7 text-primary" aria-hidden="true" />
            <h2 className="mt-5 text-2xl font-semibold">Clear for candidates</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Candidates get public job pages, clean application steps, availability requests, and a
              calm interview experience with visible status and expectations.
            </p>
          </CardContent>
        </Card>
      </section>

      <footer className="border-t border-border/70 bg-background/80">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <AptlyLogo />
            <span>Aptly recruiting platform</span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/login" className="hover:text-foreground">
              Sign in
            </Link>
            <Link href="/candidate" className="hover:text-foreground">
              Candidate portal
            </Link>
            <Link href="/careers/aptly-demo" className="hover:text-foreground">
              Demo careers
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
