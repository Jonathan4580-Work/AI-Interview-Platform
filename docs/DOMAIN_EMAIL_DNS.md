# Domain, Email, DNS, and TLS

## Status

Prepared only. No DNS records, TLS certificates, sender domains, or email provider credentials were configured.

## Recommended Subdomains

- Workspace: `app.example.com`.
- Candidate portal: `interview.example.com`.
- API: same origin as workspace unless a separate API domain is required.
- Status page: `status.example.com` if an external status provider is used.
- Media/static delivery: use private object storage with signed URLs, not public buckets.

## TLS and Cookies

Requirements:

- TLS everywhere.
- HSTS after DNS and certificate validation.
- Secure cookies in production.
- `SameSite=Lax` for session and candidate cookies unless a provider flow requires stricter review.
- No wildcard redirect acceptance.
- Candidate magic-link redirects must target approved origins only.

## DNS Checklist

Workspace/candidate:

- A/AAAA or CNAME records to deployment platform.
- TLS certificate issuance and renewal.
- HSTS rollout after validation.

Email:

- SPF record for email provider.
- DKIM records from provider.
- DMARC record with monitoring policy first, then enforcement.
- Return-path/bounce domain if provider supports it.

SSO:

- OAuth redirect URIs registered in Google/Microsoft.
- Verified domain ownership.

Object storage:

- CORS allowed origins restricted to workspace and candidate origins.
- No public bucket policy.

## Email Configuration

Production email must remain disabled or preview-only until:

- Sender domain is verified.
- SPF/DKIM/DMARC are published and verified.
- Bounce and complaint handling is configured.
- Template rendering is checked in sandbox.
- Candidate invitation, password reset, email verification, and results-ready links use production HTTPS domains.

## Production Email Smoke Test Checklist

Requires provider sandbox or explicit approval before live send.

- Render invitation email.
- Verify webcam/microphone instructions.
- Verify magic-link domain.
- Render reminder email.
- Render expiration notice.
- Render password reset.
- Render email verification.
- Confirm no raw secrets or signed URLs in email body.
- Confirm bounce/complaint webhook verification.
- Confirm non-production environments cannot send production email.

## Current Status

All DNS/TLS/email setup is pending infrastructure/provider access.
