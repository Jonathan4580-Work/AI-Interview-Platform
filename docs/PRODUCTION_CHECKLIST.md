# Production Checklist

## Status Categories

- Ready: repository artifact is implemented and verified.
- Ready with accepted risk: usable for launch prep with documented external validation pending.
- Blocked: cannot proceed until a prerequisite is satisfied.
- Not tested: no practical verification was possible in this environment.
- Requires credentials: needs provider secrets.
- Requires infrastructure access: needs cloud/DNS/staging/production access.

## Checklist

| Area                              | Status                         | Notes                                          |
| --------------------------------- | ------------------------------ | ---------------------------------------------- |
| Repository build/lint/test/audit  | Ready                          | Runs locally and in CI foundation              |
| Production environment validation | Ready                          | `npm.cmd run validate:production-env`          |
| Container runtime                 | Ready                          | Multi-stage, non-root, pruned runtime          |
| CI verification                   | Ready                          | GitHub Actions foundation; deployment disabled |
| Managed PostgreSQL                | Requires infrastructure access | Must configure TLS, PITR, backups, pooling     |
| Managed Redis                     | Requires infrastructure access | Must configure TLS/authentication              |
| Object storage                    | Requires infrastructure access | Private bucket, SSE, lifecycle, CORS           |
| Production domains/TLS            | Requires infrastructure access | DNS and certificates pending                   |
| Email provider                    | Requires credentials           | Sender domain, SPF/DKIM/DMARC pending          |
| OpenAI                            | Requires credentials           | Production key and schema smoke pending        |
| SSO providers                     | Requires credentials           | Google/Microsoft tenant setup pending          |
| SCIM                              | Requires credentials           | IdP sandbox pending                            |
| ATS integration                   | Requires credentials           | Provider selection pending                     |
| External webhooks                 | Requires infrastructure access | Egress controls and endpoint tests pending     |
| Backup/restore drill              | Ready with accepted risk       | Scripts exist; full RPO/RTO not proven         |
| Browser/device matrix             | Not tested                     | Requires real staging and devices              |
| Accessibility manual review       | Not tested                     | Requires assistive technology pass             |
| Security penetration test         | Not tested                     | No external pentest performed                  |

## Launch Blockers

- No staging deployment has been performed.
- No production infrastructure exists in this workspace.
- No production secrets or provider credentials are available.
- No DNS/TLS/email domain verification has been performed.
- No full browser/device validation has been performed against staging.
- No measured RPO/RTO restore drill has been completed on managed infrastructure.

## Minimum Before External Pilot

- Staging deployed and smoke-tested.
- Managed database backup/restore drill completed.
- Production domains and TLS validated.
- Email sender domain verified.
- Object upload/playback smoke passed.
- Browser/device matrix completed for Chrome, Edge, Firefox, Safari.
- Security, privacy, and accessibility go/no-go reviewed.
