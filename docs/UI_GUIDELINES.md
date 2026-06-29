# UI Guidelines

## Design Intent

Aptly should feel like premium enterprise recruitment software: composed, precise, quiet, and trustworthy. It should not look like an AI application.

Reference mood:

- Linear
- Stripe Dashboard
- Vercel
- Rippling
- Ashby
- Greenhouse
- Notion

Avoid:

- Purple-led palettes.
- Robots.
- Brain icons.
- Glowing gradients.
- Chat bubbles as the primary interface metaphor.
- Cyberpunk visuals.
- "Magic" AI language.
- Neon accents.

## Product Feel

The interface should communicate:

- Operational confidence.
- Hiring clarity.
- Calm precision.
- Clear evidence.
- Professional candidate experience.

The AI should be described through outcomes:

- Evaluation.
- Summary.
- Transcript.
- Evidence.
- Report.
- Interviewer.

Avoid making the AI the visual center of the product.

## Layout System

### App Shell

Authenticated company workspace:

- Left sidebar navigation.
- Top bar with workspace switcher or company name, search, notifications, and user menu.
- Main content area with constrained readable width for detail pages.
- Dense but breathable tables for operational lists.

Platform admin:

- Similar shell, clearly marked as Platform Admin.
- More operational metrics and tenant search.

Candidate portal:

- Focused single-column flow.
- Minimal navigation.
- Company branding present but restrained.
- Clear progress through readiness checks and interview stages.

### Spacing

Use a consistent 4px spacing scale.

Recommended rhythm:

- 4px micro gaps.
- 8px control spacing.
- 12px compact groups.
- 16px standard groups.
- 24px section spacing.
- 32px major layout spacing.
- 48px page-level breaks.

### Cards

Cards should be used only for repeated items, focused panels, or review sections. Avoid page sections that look like decorative floating cards.

Card style:

- Border radius: 8px or less.
- Thin border.
- White or near-white background.
- Subtle shadow only where depth is useful.

Do not nest cards inside cards.

## Navigation

Primary company navigation:

- Dashboard
- Roles
- Candidates
- Interviews
- Reports
- Team
- Settings

Platform admin navigation:

- Overview
- Companies
- Queues
- Email
- Audit Logs
- Settings

Candidate flow navigation:

- No full app navigation.
- Show step progress only.

## Key Screens

### Company Dashboard

Purpose:

- Give HR teams a concise operational view.

Content:

- Active roles.
- Pending invitations.
- Interviews completed this week.
- Results awaiting review.
- Recent candidate activity.
- Queue or processing issues relevant to the company.

### Roles

Purpose:

- Manage hiring roles and interview plans.

UI:

- Table list with filters.
- Role detail page with interview plan, active invitations, completion metrics, and evaluation rubric.

### Candidates

Purpose:

- Track candidate state across invitations and interviews.

UI:

- Searchable table.
- Status filters.
- Candidate detail with invitation history and interview artifacts.

### Invitations

Purpose:

- Create, resend, revoke, and monitor interview invitations.

UI:

- Clear invitation status.
- Expiration date.
- Last email delivery state.
- Actions: resend, send reminder, revoke.

### Interview Review

Purpose:

- Let HR evaluate interview evidence efficiently.

Recommended layout:

- Header with candidate, role, status, score, and recommendation.
- Recording and transcript side by side on larger screens.
- Evaluation summary.
- Competency score table.
- Evidence citations linked to transcript segments.
- Monitoring warnings as contextual timeline.
- HR notes and recommendation controls.
- Confidence and uncertainty indicators.
- Human score override with required reason.
- Decision history.
- Reviewer assignment.

Monitoring warnings must be visually secondary and never framed as automatic disqualification.

Evaluation copy must make clear that Aptly provides decision support. Avoid verdict language. Prefer "recommended next step" and "evidence" over "approved", "rejected", or "AI decision."

### Candidate Readiness Flow

Purpose:

- Prepare the candidate and reduce failed interviews.

Steps:

- Welcome.
- Consent.
- Identity.
- Camera.
- Microphone.
- Browser.
- Internet.
- Instructions.

Each step should:

- State what is being checked.
- Explain how to fix common failures.
- Provide retry where possible.
- Avoid alarming language.
- Provide support and accommodation paths.
- Preserve progress where possible if the candidate refreshes or changes browser.

### Candidate Interview

Purpose:

- Provide a professional interview experience in the browser.

UI:

- Clean video area.
- Interview prompt or question area.
- Progress or remaining time.
- Connection and recording indicators.
- Minimal controls.
- Recovery messaging for short interruptions.
- Upload recovery state after completion if needed.

Avoid chat app styling. The interview may have conversational content, but the visual model should feel like a guided assessment room.

## Components

Use shadcn/ui as the base component system.

Preferred components:

- Button
- Dialog
- Dropdown Menu
- Tabs
- Table
- Badge
- Tooltip
- Select
- Input
- Textarea
- Checkbox
- Switch
- Progress
- Toast
- Sheet
- Command

Use lucide icons where icons are needed.

Icon usage:

- Icons should clarify actions.
- Use simple line icons.
- Avoid AI, robot, brain, sparkle, wand, or magic icons.

## Typography

Typography should be elegant, readable, and restrained.

Rules:

- Avoid oversized headings inside operational screens.
- Use clear hierarchy.
- Keep letter spacing at 0.
- Do not scale font size with viewport width.
- Ensure all button and table text fits on mobile.

Suggested hierarchy:

- Page title: 24px to 30px.
- Section heading: 16px to 20px.
- Body: 14px to 16px.
- Metadata: 12px to 13px.

## Color Usage

The interface should primarily use neutral surfaces with refined accents.

Usage:

- Neutral backgrounds for app structure.
- Slate or ink for primary text.
- Blue or green accent for primary actions and healthy states.
- Amber for warnings.
- Red only for destructive or failed states.

Avoid dominant purple, neon, or heavy gradients.

## Status Language

Use clear operational labels:

- Draft
- Active
- Pending
- Sent
- Opened
- Expired
- Revoked
- In progress
- Processing
- Results ready
- Failed
- Completed

Avoid vague labels:

- Magic
- AI powered
- Smart
- Genius
- Bot thinking

## Accessibility

Requirements:

- Target WCAG 2.2 AA.
- Keyboard navigable controls.
- Visible focus states.
- Sufficient color contrast.
- Captions or transcript availability for interview recording review.
- Clear error messages.
- Candidate flow usable by non-technical users.
- Candidate flow usable with screen readers.
- Non-color status indicators.
- Reduced motion support.
- Browser-specific permission recovery instructions.
- Accommodation request path for candidates who cannot complete camera, microphone, or identity checks.
- Time limit warnings and extension/accommodation messaging.

## Responsive Behavior

Desktop:

- Tables, split review layouts, dense operational views.

Tablet:

- Collapse secondary panels.
- Preserve review context.

Mobile:

- Candidate flow must be excellent.
- HR workspace can be functional but need not expose every dense table at once.
- Avoid horizontal overflow.

## Empty States

Empty states should be understated and useful.

Examples:

- No invitations yet.
- No interviews completed.
- No reports ready.

Each should include the next meaningful action if the user has permission.

## Enterprise Admin UI

Platform admin screens must expose operational power carefully:

- Support access requires visible reason, expiration, and audit trail.
- Failed job inspection must show redacted payloads only.
- Queue replay and cancellation must require confirmation.
- Tenant suspension must show impact preview.
- Legal hold and export actions must be visually distinct from routine settings.

Company admin screens must expose:

- Support access history.
- Retention by data class.
- Domain verification.
- Role permission audit.
- Legal hold status.
- Privacy request status.

## Reporting UI

Aggregate reporting should support:

- Role pipeline summaries.
- Invitation conversion.
- Completion rates.
- Readiness drop-off.
- Processing latency.
- Time-to-review.
- Evaluation distribution.
- Monitoring warning frequency.
- Email deliverability.
- Reviewer workload.
- Compliance access reports.

Large reports should load progressively and offer export workflows rather than blocking page rendering.

## Copy Tone

Tone:

- Clear.
- Professional.
- Calm.
- Specific.

Avoid:

- Hype.
- AI-first claims.
- Playful gimmicks.
- Fear-based monitoring language.
