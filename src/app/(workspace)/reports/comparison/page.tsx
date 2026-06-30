import { GitCompareArrows } from "lucide-react";

import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function CandidateComparisonPage() {
  return (
    <ContentContainer className="gap-6">
      <PageHeader
        eyebrow="Reports"
        title="Candidate comparison"
        description="Compare candidates for one role with neutral, evidence-aware context."
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitCompareArrows aria-hidden="true" className="size-4 text-muted-foreground" />
            Role comparison
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <label className="sr-only" htmlFor="comparison-job-id">
              Job ID
            </label>
            <Input id="comparison-job-id" name="jobId" placeholder="Job ID" />
            <Button type="submit" disabled>
              Prepare
            </Button>
          </form>
          <div className="flex flex-wrap gap-2" aria-label="Comparison safeguards">
            <Badge>Side-by-side</Badge>
            <Badge>No ranking</Badge>
            <Badge>Monitoring separate</Badge>
          </div>
        </CardContent>
      </Card>
    </ContentContainer>
  );
}
