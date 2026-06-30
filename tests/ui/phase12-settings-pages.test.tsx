/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";

import AtsSettingsPage from "@/app/(workspace)/settings/ats/page";
import DataRegionSettingsPage from "@/app/(workspace)/settings/data-region/page";
import IntegrationSyncSettingsPage from "@/app/(workspace)/settings/integration-sync/page";
import IntegrationsOverviewPage from "@/app/(workspace)/settings/integrations/page";
import ScimSettingsPage from "@/app/(workspace)/settings/scim/page";
import SsoSettingsPage from "@/app/(workspace)/settings/sso/page";
import WebhookSettingsPage from "@/app/(workspace)/settings/webhooks/page";

describe("Phase 12 enterprise settings pages", () => {
  it("renders the approved integration settings overview", () => {
    render(<IntegrationsOverviewPage />);

    expect(screen.getByRole("heading", { name: "Integrations" })).toBeInTheDocument();
    expect(screen.getByText("Webhook subscriptions")).toBeInTheDocument();
    expect(screen.getByText("ATS connections")).toBeInTheDocument();
  });

  it("renders narrowly scoped enterprise setting pages without dashboard workflows", () => {
    render(
      <>
        <WebhookSettingsPage />
        <SsoSettingsPage />
        <ScimSettingsPage />
        <AtsSettingsPage />
        <IntegrationSyncSettingsPage />
        <DataRegionSettingsPage />
      </>,
    );

    expect(screen.getByRole("heading", { name: "Webhook Subscriptions" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Single Sign-On" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "SCIM Provisioning" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "ATS Connections" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sync Status" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Data Region" })).toBeInTheDocument();
    expect(
      screen.queryByText(/best candidate|automated decision|production deployment/iu),
    ).toBeNull();
  });
});
