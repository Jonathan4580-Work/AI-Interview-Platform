import { Download } from "lucide-react";

import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ExportsPage() {
  return (
    <ContentContainer className="gap-6">
      <PageHeader
        eyebrow="Reporting"
        title="Exports"
        description="Track asynchronous export requests and short-lived download access."
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download aria-hidden="true" className="size-4 text-muted-foreground" />
            Export activity
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Badge>Queued generation</Badge>
          <Badge>CSV protected</Badge>
          <Badge>Audited downloads</Badge>
        </CardContent>
      </Card>
    </ContentContainer>
  );
}
