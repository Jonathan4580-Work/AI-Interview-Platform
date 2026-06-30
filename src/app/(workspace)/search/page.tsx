import { Search } from "lucide-react";

import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function WorkspaceSearchPage({
  searchParams,
}: {
  readonly searchParams?: { readonly query?: string };
}) {
  const query = searchParams?.query?.trim() ?? "";

  return (
    <ContentContainer className="gap-6">
      <PageHeader
        eyebrow="Workspace"
        title="Search"
        description="Find safe workspace records across candidates, jobs, applications, interviews, and reports."
      />
      <Card>
        <CardHeader>
          <CardTitle>Workspace search</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="flex flex-col gap-3 sm:flex-row" action="/search">
            <label className="sr-only" htmlFor="workspace-search-query">
              Search query
            </label>
            <Input
              id="workspace-search-query"
              name="query"
              defaultValue={query}
              placeholder="Search by name, job, application, or report"
              className="min-w-0 flex-1"
            />
            <Button type="submit">
              <Search aria-hidden="true" className="size-4" />
              Search
            </Button>
          </form>
          <div className="flex flex-wrap gap-2" aria-label="Search exclusions">
            <Badge>Metadata only</Badge>
            <Badge>Tenant scoped</Badge>
            <Badge>Permission aware</Badge>
          </div>
        </CardContent>
      </Card>
    </ContentContainer>
  );
}
