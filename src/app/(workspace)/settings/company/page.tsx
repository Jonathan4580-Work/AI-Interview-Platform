import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/infra/database";
import { requireHrWorkspaceContext } from "@/server/hr-workspace/context";

import { EmptyPanel, StatusBadge, formatDate } from "../../_components/hr-ui";

import type { ReactNode } from "react";

export default async function CompanySettingsPage() {
  const context = await requireHrWorkspaceContext("tenant:read");
  const company = await prisma.company.findUnique({
    where: { id: context.tenant.companyId },
    include: { settings: true },
  });

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Settings"
        title="Company settings"
        description="Review workspace identity and operational configuration."
      />
      {company === null ? (
        <EmptyPanel
          title="Company not found"
          description="The authenticated company could not be loaded."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Workspace</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <Info label="Name" value={company.name} />
              <Info label="Workspace ID" value={company.id} />
              <Info label="Slug" value={company.slug} />
              <Info label="Status" value={<StatusBadge value={company.status} />} />
              <Info label="Created" value={formatDate(company.createdAt)} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <Info
                label="Branding"
                value={company.settings === null ? "Not customized" : "Configured"}
              />
              <Info
                label="Retention"
                value={company.settings === null ? "Default policy" : "Configured"}
              />
              <Info
                label="Email"
                value={company.settings === null ? "Default delivery settings" : "Configured"}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { readonly label: string; readonly value: ReactNode }) {
  return (
    <div className="grid gap-1 rounded-md border border-border p-3">
      <span className="text-xs font-medium uppercase text-muted-foreground">{label}</span>
      <span className="break-words text-foreground">{value}</span>
    </div>
  );
}
