import { BarChart3, FileText, GitCompareArrows } from "lucide-react";

import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const reportSections = [
  {
    title: "Aggregate reports",
    icon: BarChart3,
    description:
      "Bounded summaries for pipeline, delivery, completion, processing, and review activity.",
  },
  {
    title: "Candidate comparison",
    icon: GitCompareArrows,
    description:
      "Side-by-side role context without rankings, recommendations, or automated decisions.",
  },
  {
    title: "Compliance reports",
    icon: FileText,
    description: "Access and export activity designed for auditable review workflows.",
  },
] as const;

export default function ReportsPage() {
  return (
    <ContentContainer className="gap-6">
      <PageHeader
        eyebrow="Reporting"
        title="Reports"
        description="Review enterprise reporting surfaces with bounded ranges and explicit permissions."
      />
      <div className="grid gap-4 lg:grid-cols-3">
        {reportSections.map((section) => {
          const Icon = section.icon;
          return (
            <Card key={section.title}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
                  {section.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{section.description}</p>
                <Badge variant="info">Phase 10</Badge>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </ContentContainer>
  );
}
