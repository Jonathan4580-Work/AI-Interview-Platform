import Link from "next/link";
import {
  BriefcaseBusiness,
  CalendarCheck,
  ClipboardCheck,
  FileSearch,
  Mail,
  Plus,
  Search,
  Sparkles,
  Star,
  Trophy,
  UserRound,
  XCircle,
} from "lucide-react";

import { MetricCard, PremiumHero, SectionCard } from "@/components/recruiting/recruiting-ui";
import { Button } from "@/components/ui/button";
import { requireHrWorkspaceContext } from "@/server/hr-workspace/context";
import { getDashboardData } from "@/server/hr-workspace/queries";

import { EmptyPanel, formatDate, titleCase } from "../_components/hr-ui";

const quickActions = [
  { label: "Create job", href: "/jobs/new", icon: BriefcaseBusiness },
  { label: "Add candidate", href: "/candidates/new", icon: UserRound },
  { label: "Review applications", href: "/applications", icon: Mail },
  { label: "View interviews", href: "/interviews", icon: CalendarCheck },
] as const;

export default async function WorkspaceOverviewPage() {
  const context = await requireHrWorkspaceContext();
  const dashboard = await getDashboardData(context);

  const stats = [
    { label: "Open jobs", value: dashboard.activeJobs, href: "/jobs", icon: BriefcaseBusiness },
    {
      label: "New applications",
      value: dashboard.newApplications,
      href: "/applications?status=NEW",
      icon: UserRound,
    },
    {
      label: "Screening pending",
      value: dashboard.screeningPending,
      href: "/applications",
      icon: FileSearch,
    },
    {
      label: "Recommended",
      value: dashboard.recommendedCandidates,
      href: "/candidates",
      icon: Star,
    },
    {
      label: "Shortlisted",
      value: dashboard.shortlistedCandidates,
      href: "/applications?status=SHORTLISTED",
      icon: ClipboardCheck,
    },
    {
      label: "Availability requested",
      value: dashboard.availabilityRequested,
      href: "/applications?status=AVAILABILITY_REQUESTED",
      icon: CalendarCheck,
    },
    {
      label: "Awaiting completion",
      value: dashboard.interviewsAwaitingCompletion,
      href: "/interviews",
      icon: CalendarCheck,
    },
    { label: "Reports ready", value: dashboard.resultsReady, href: "/reports", icon: Sparkles },
    {
      label: "Hired",
      value: dashboard.hiredCandidates,
      href: "/applications?status=HIRED",
      icon: Trophy,
    },
    {
      label: "Not selected",
      value: dashboard.notSelectedCandidates,
      href: "/applications?status=NOT_SELECTED",
      icon: XCircle,
    },
  ];
  const recentActivityDescription = `${String(
    dashboard.invitationsSent,
  )} invitations sent · ${String(dashboard.interviewsCompleted)} interviews completed`;

  return (
    <div className="grid gap-6">
      <PremiumHero
        eyebrow="Hiring workspace"
        title="Recruiting command center"
        description="Track jobs, applications, AI screening, availability, interviews, and reports from one polished workspace."
        actions={
          <Button asChild>
            <Link href="/jobs/new">
              <Plus aria-hidden="true" />
              Create job
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.label}
              href={stat.href}
              className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <MetricCard
                label={stat.label}
                value={stat.value}
                caption={index < 2 ? "Live workspace total" : "Needs HR attention"}
                icon={<Icon className="size-5" aria-hidden="true" />}
                tone={
                  index % 4 === 0
                    ? "blue"
                    : index % 4 === 1
                      ? "green"
                      : index % 4 === 2
                        ? "amber"
                        : "violet"
                }
              />
            </Link>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <SectionCard title="Next actions" description="Fast paths for the work HR does every day.">
          <div className="grid gap-2">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Button key={action.href} asChild variant="secondary" className="justify-start">
                  <Link href={action.href}>
                    <Icon aria-hidden="true" />
                    {action.label}
                  </Link>
                </Button>
              );
            })}
            <Button asChild variant="quiet" className="justify-start">
              <Link href="/search">
                <Search aria-hidden="true" />
                Search workspace
              </Link>
            </Button>
          </div>
        </SectionCard>

        <SectionCard title="Recent activity" description={recentActivityDescription}>
          {dashboard.recentActivity.length === 0 ? (
            <EmptyPanel
              title="No activity yet"
              description="Actions such as job creation, candidate updates, and invitations will appear here."
            />
          ) : (
            <ol className="grid gap-3">
              {dashboard.recentActivity.map((event) => (
                <li
                  key={event.id}
                  className="rounded-xl border border-border/80 bg-surface/80 p-4 text-sm shadow-xs"
                >
                  <p className="font-medium text-foreground">{titleCase(event.action)}</p>
                  <p className="mt-1 text-muted-foreground">
                    {titleCase(event.resourceType)} · {formatDate(event.createdAt)}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
