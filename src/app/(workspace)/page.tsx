import { Download, FileText, Search, Settings } from "lucide-react";

import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const navigationCards = [
  {
    title: "Search",
    href: "/search",
    icon: Search,
    description: "Find tenant-scoped records across jobs, candidates, interviews, and reports.",
  },
  {
    title: "Reports",
    href: "/reports",
    icon: FileText,
    description: "Review bounded reporting surfaces and decision-support outputs.",
  },
  {
    title: "Exports",
    href: "/exports",
    icon: Download,
    description: "Track asynchronous exports and audited download access.",
  },
  {
    title: "Settings",
    href: "/settings/integrations",
    icon: Settings,
    description: "Manage enterprise integration and workspace configuration foundations.",
  },
] as const;

export default function WorkspaceOverviewPage() {
  return (
    <ContentContainer className="gap-6">
      <PageHeader
        eyebrow="Workspace"
        title="Overview"
        description="Start from the available workspace tools and enterprise settings."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {navigationCards.map((item) => {
          const Icon = item.icon;
          return (
            <a
              key={item.title}
              href={item.href}
              className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="h-full transition-colors duration-base hover:border-primary/40 hover:bg-muted/40">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
                    {item.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </CardContent>
              </Card>
            </a>
          );
        })}
      </div>
    </ContentContainer>
  );
}
