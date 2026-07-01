import Link from "next/link";
import { BriefcaseBusiness, CalendarCheck, Mail, Plus, Search, UserRound } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireHrWorkspaceContext } from "@/server/hr-workspace/context";
import { getDashboardData } from "@/server/hr-workspace/queries";

import { EmptyPanel, formatDate, titleCase } from "./_components/hr-ui";

const quickActions = [
  { label: "Create job", href: "/jobs/new", icon: BriefcaseBusiness },
  { label: "Add candidate", href: "/candidates/new", icon: UserRound },
  { label: "Send invitation", href: "/candidates", icon: Mail },
  { label: "View interviews", href: "/interviews", icon: CalendarCheck },
] as const;

export default async function WorkspaceOverviewPage() {
  const context = await requireHrWorkspaceContext();
  const dashboard = await getDashboardData(context);

  const stats = [
    { label: "Active jobs", value: dashboard.activeJobs, href: "/jobs" },
    { label: "Total candidates", value: dashboard.totalCandidates, href: "/candidates" },
    { label: "Invitations sent", value: dashboard.invitationsSent, href: "/candidates" },
    {
      label: "Awaiting completion",
      value: dashboard.interviewsAwaitingCompletion,
      href: "/interviews",
    },
    { label: "Completed interviews", value: dashboard.interviewsCompleted, href: "/interviews" },
    { label: "Results ready", value: dashboard.resultsReady, href: "/interviews" },
  ];

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Hiring workspace"
        title="Dashboard"
        description="Track open roles, candidates, invitations, interviews, and ready results."
        actions={
          <Button asChild>
            <Link href="/jobs/new">
              <Plus aria-hidden="true" />
              Create job
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Card className="h-full transition-colors hover:border-primary/40 hover:bg-muted/40">
              <CardContent>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="mt-3 text-3xl font-semibold text-foreground">{stat.value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
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
                    className="rounded-md border border-border bg-background p-3 text-sm"
                  >
                    <p className="font-medium text-foreground">
                      {titleCase(event.action.replaceAll(".", " "))}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {titleCase(event.resourceType.replaceAll("_", " "))} ·{" "}
                      {formatDate(event.createdAt)}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
