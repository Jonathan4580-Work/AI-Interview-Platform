import { PageHeader } from "@/components/layout/page-header";
import { PendingSubmitButton } from "@/components/forms/pending-submit-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/infra/database";
import { CompanySettingsService, PrismaCompanySettingsRepository } from "@/modules/tenant";
import { AuditWriter, PrismaAuditEventStore } from "@/modules/audit";
import { updateCompanySettingsAction } from "@/server/hr-workspace/actions";
import { requireHrWorkspaceContext } from "@/server/hr-workspace/context";

import { EmptyPanel, StatusBadge, formatDate } from "../../_components/hr-ui";

import type { ReactNode } from "react";

export default async function CompanySettingsPage() {
  const context = await requireHrWorkspaceContext("tenant:read");
  const company = await prisma.company.findUnique({
    where: { id: context.tenant.companyId },
  });
  const settings = await new CompanySettingsService(
    new PrismaCompanySettingsRepository(),
    new AuditWriter(new PrismaAuditEventStore()),
  ).getSettings(context.tenant);

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
              <CardTitle>Current policy</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <Info label="Careers display" value={settings.branding.displayName ?? company.name} />
              <Info label="Primary color" value={settings.branding.primaryColor} />
              <Info
                label="Candidate duplicates"
                value={settings.candidatePolicy.duplicateCandidateMode ? "Allowed" : "Blocked"}
              />
              <Info
                label="Default invitation expiry"
                value={`${String(settings.invitationPolicy.defaultExpirationDays)} days`}
              />
              <Info label="Scheduling timezone" value={settings.schedulingPolicy.defaultTimeZone} />
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Workspace and candidate-facing settings</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={updateCompanySettingsAction} className="grid gap-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="Careers display name">
                    <input
                      name="displayName"
                      defaultValue={settings.branding.displayName ?? company.name}
                      maxLength={160}
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                    />
                  </Field>
                  <Field label="Logo URL">
                    <input
                      name="logoUrl"
                      type="url"
                      placeholder="https://..."
                      defaultValue={settings.branding.logoUrl ?? ""}
                      maxLength={500}
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                    />
                  </Field>
                  <Field label="Primary color">
                    <input
                      name="primaryColor"
                      type="color"
                      defaultValue={settings.branding.primaryColor}
                      className="h-10 rounded-md border border-input bg-background px-2 py-1"
                    />
                  </Field>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="Default invitation expiry days">
                    <input
                      required
                      name="defaultExpirationDays"
                      type="number"
                      min={1}
                      max={30}
                      defaultValue={settings.invitationPolicy.defaultExpirationDays}
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                    />
                  </Field>
                  <Field label="Minimum expiry hours">
                    <input
                      required
                      name="minimumExpirationHours"
                      type="number"
                      min={1}
                      max={168}
                      defaultValue={settings.invitationPolicy.minimumExpirationHours}
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                    />
                  </Field>
                  <Field label="Maximum expiry days">
                    <input
                      required
                      name="maximumExpirationDays"
                      type="number"
                      min={1}
                      max={90}
                      defaultValue={settings.invitationPolicy.maximumExpirationDays}
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                    />
                  </Field>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="Default scheduling timezone">
                    <input
                      required
                      name="defaultTimeZone"
                      defaultValue={settings.schedulingPolicy.defaultTimeZone}
                      placeholder="Asia/Colombo"
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                    />
                  </Field>
                  <label className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 text-sm text-foreground">
                    <input
                      name="duplicateCandidateMode"
                      type="checkbox"
                      defaultChecked={settings.candidatePolicy.duplicateCandidateMode}
                      className="size-4 rounded border-input"
                    />
                    Allow duplicate candidate records
                  </label>
                  <label className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 text-sm text-foreground">
                    <input
                      name="allowEmailLessCandidates"
                      type="checkbox"
                      defaultChecked={settings.candidatePolicy.allowEmailLessCandidates}
                      className="size-4 rounded border-input"
                    />
                    Allow candidates without email
                  </label>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary-soft/40 p-4">
                  <p className="max-w-2xl text-sm text-muted-foreground">
                    These settings are audited and tenant-scoped. Careers display name is safe for
                    candidate-facing pages; internal workspace ID and security settings remain
                    unchanged.
                  </p>
                  <PendingSubmitButton pendingLabel="Saving settings...">
                    Save company settings
                  </PendingSubmitButton>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-foreground">
      {label}
      {children}
    </label>
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
