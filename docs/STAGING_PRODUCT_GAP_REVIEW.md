# Staging Product Gap Review

Review date: 2026-07-02

Scope: authenticated Aptly staging UI after Railway deployment validation. This review covers visible workspace areas and compares the user-facing surface with the implemented backend and API modules.

## Summary

Aptly staging is operational for authentication, shell navigation, core API foundations, candidate portal/interview foundations, processing pipelines, reports, search, exports, and enterprise integration settings. The authenticated workspace is not yet a complete HR product experience. Several areas have backend/API capability but no full product workflow screens.

This document must not be interpreted as a production-complete claim.

## Area Inventory

| Area             | Status             | Notes                                                                                                                                                                              |
| ---------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overview         | UI foundation only | Provides safe navigation to implemented workspace surfaces. No metrics or activity feed are shown because real dashboard queries are not implemented.                              |
| Jobs/Roles       | API/backend only   | Job, job-template, pipeline, and RBAC APIs exist. No full authenticated jobs or role-management product pages are implemented.                                                     |
| Candidates       | API/backend only   | Candidate domain, applications, documents, notes, tags, invitations, and candidate-session APIs exist. No internal candidate list/detail workspace pages are implemented.          |
| Applications     | API/backend only   | Application domain and status handling exist. No internal application workflow UI is implemented.                                                                                  |
| Interviews       | API/backend only   | Candidate interview room and internal inspection APIs exist. No HR interview list/detail workspace pages are implemented.                                                          |
| Invitations      | API/backend only   | Invitation activation, magic-link, resend, and email foundations exist. No HR invitation-management page is implemented.                                                           |
| Reports          | UI foundation only | Reports and comparison pages exist as bounded product surfaces. Full report browsing, filtering, and review workflows are not complete.                                            |
| Search           | UI foundation only | Search page routes to the permission-aware search API. It intentionally excludes notes, transcript bodies, identity data, accommodation data, prompts, rubrics, and media content. |
| Exports          | UI foundation only | Export infrastructure and audited download APIs exist. No full export management workflow UI is implemented.                                                                       |
| Company settings | Missing            | Company profile, departments, teams, locations, email settings, and hiring settings are backend/API only or not surfaced in the workspace shell.                                   |
| Profile          | Missing            | No user profile route or account management API surface is implemented for the authenticated UI. Menu actions remain hidden until real routes exist.                               |
| Preferences      | Missing            | No preferences route or persistence model is implemented. Menu actions remain hidden until real routes exist.                                                                      |
| Integrations     | UI foundation only | Enterprise integration settings pages exist with product-facing setup language. Live provider setup still requires credentials and configuration.                                  |
| Webhooks         | UI foundation only | Webhook subscription and delivery APIs exist. The page describes configuration areas but does not yet provide full create/edit workflows.                                          |
| SSO              | UI foundation only | OIDC configuration APIs and safety checks exist. Real Google/Microsoft credential setup and UI completion remain pending.                                                          |
| SCIM             | UI foundation only | SCIM configuration and token-safety APIs exist. Full provisioning administration UI remains pending.                                                                               |
| ATS              | UI foundation only | Provider-neutral connection, mapping, and sync architecture exists. Production ATS connectors and full setup workflows remain pending.                                             |
| Data region      | UI foundation only | Data-residency policy metadata exists. No data movement has occurred and no multi-region infrastructure is provisioned.                                                            |

## Immediate Hardening Completed

- Authenticated shell identity now uses verified session data instead of placeholder text.
- Account menu displays actual user name, email, and role label.
- Workspace selector displays actual company or platform context.
- Dead Profile and Preferences menu actions are hidden.
- Company/Admin navigation is filtered to implemented routes and, for company users, available permissions.
- Platform Admin navigation is scoped to platform-appropriate settings pages.
- Internal phase and foundation badges were removed from normal authenticated UI.
- Workspace selector, account menu, and dropdowns were adjusted for long names, narrow widths, and higher browser zoom.

## Remaining Product Gaps

- HR workspace pages for jobs, candidates, applications, interviews, invitations, and company settings need real list/detail workflows.
- Profile and preferences require product decisions and account-management APIs before being shown.
- Reports, search, and exports need complete workflows beyond their current operational surfaces.
- Enterprise integration settings need full create/edit/test flows once provider credentials and setup procedures are available.
- Overview should eventually show real, permission-aware operational summaries. It must not use fake metrics.

## Recommended Next User-Facing Milestone

Build the Company Admin and HR workspace core:

1. Jobs and hiring pipeline pages.
2. Candidate list/detail pages.
3. Application and invitation management.
4. Interview status and results review pages.
5. Company settings for departments, teams, locations, and email configuration.

This should be implemented with real API-backed data, permission-aware navigation, and no placeholder metrics.
