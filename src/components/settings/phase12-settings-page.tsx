import { ArrowRight, CheckCircle2, CircleDashed } from "lucide-react";

import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SettingsItem {
  readonly label: string;
  readonly description: string;
  readonly status?: "ready" | "development";
}

interface Phase12SettingsPageProps {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly items: readonly SettingsItem[];
}

export function Phase12SettingsPage({
  eyebrow,
  title,
  description,
  items,
}: Phase12SettingsPageProps) {
  return (
    <ContentContainer className="gap-6">
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <div className="grid gap-4 lg:grid-cols-2">
        {items.map((item) => {
          const Icon = item.status === "ready" ? CheckCircle2 : CircleDashed;
          return (
            <Card key={item.label}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
                  {item.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{item.description}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={item.status === "ready" ? "success" : "info"}>
                    {item.status === "ready" ? "Foundation ready" : "Development foundation"}
                  </Badge>
                  <Badge>
                    <ArrowRight aria-hidden="true" className="size-3" />
                    Phase 12
                  </Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </ContentContainer>
  );
}
