# Phase 13 Launch Readiness

## Status Summary

Phase 13 prepared Aptly for a controlled production launch without provisioning live infrastructure or connecting production providers.

| Area                        | Status                         | Notes                                                                                                      |
| --------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Production architecture     | Implemented                    | Provider-neutral architecture and recommended deployment path are documented.                              |
| Environment validation      | Implemented                    | Production environment schema, examples, and validation script are present.                                |
| Runtime hardening           | Implemented                    | Multi-stage Dockerfile, non-root runtime, health checks, and CI container build are present.               |
| CI/CD foundation            | Implemented                    | GitHub Actions validates build, lint, tests, audit, compose config, and container build.                   |
| Staging deployment          | Requires infrastructure access | Manifests and steps exist, but no staging environment was available.                                       |
| Production deployment       | Requires infrastructure access | No production deployment was performed.                                                                    |
| Provider credentials        | Requires credentials           | DeepSeek, SSO, SCIM, ATS, SMTP, object storage, and observability credentials remain external.             |
| DNS/TLS/email domain setup  | Requires infrastructure access | Records and verification steps are documented but not applied.                                             |
| Backup/restore drill        | Partially verified             | Repository procedures and local-compatible checks exist; managed PITR/RPO/RTO are not proven.              |
| Browser/device validation   | Requires manual validation     | Matrix is documented; live device/browser testing was not performed here.                                  |
| Security launch review      | Ready with accepted risk       | Repository checks passed; external penetration testing is not performed.                                   |
| Accessibility launch review | Ready with accepted risk       | Automated and code-level review passed; screen-reader and device lab testing remain pending.               |
| Privacy launch review       | Ready with accepted risk       | Controls are documented and implemented in foundation; production provider DPAs/configuration are pending. |

## Implemented

- Production deployment target decision for the modular monolith.
- Production environment schema hardening and secret-reference requirements.
- Production `.env` example using placeholders and managed secret references only.
- Container hardening with a multi-stage Dockerfile, non-root runtime user, and health check.
- Production compose example for web, migration, and worker process classes.
- CI workflow with repository checks, container build, and a disabled production approval gate.
- Deployment, staging, provider setup, DNS/email, checklist, and launch-plan documentation.
- Backup/restore and rollback runbook updates.
- Final security, accessibility, privacy, and browser/device launch review documents.

## Configured

- Runtime health check endpoint use through `scripts/healthcheck.mjs`.
- Production environment validation through `scripts/validate-production-env.ts`.
- Docker production targets for runner and migrator images.
- CI checks for dependency install, formatting, lint, build/type validation, tests, audit, Docker Compose validation, and container build.

## Verified

- Repository build, lint, tests, format check, dependency audit, and Docker Compose validation.
- Production compose syntax with a placeholder image value.
- Production environment example validation where no live secret resolution is required.
- Container build for runtime and migrator targets where Docker is available.

## Requires Credentials

- Production PostgreSQL, Redis, object storage, SMTP/transactional email, observability, backup storage, DeepSeek, transcription provider, Google OIDC, Microsoft Entra, SCIM, ATS, and webhook provider credentials.
- Managed secret references must be created in the selected deployment platform before launch.

## Requires Infrastructure Access

- Staging and production app hosting.
- Managed PostgreSQL and Redis provisioning.
- Object-storage buckets and CORS policies.
- DNS and TLS validation.
- Email domain verification records.
- Observability workspace, alert routing, and backup storage.
- Container registry publication.

## Requires Manual Validation

- Browser/device matrix across Chrome, Edge, Firefox, Safari, Windows, macOS, and supported mobile/tablet behavior.
- Camera and microphone permission flows.
- Candidate interview recording and upload recovery under real browser APIs.
- Screen-reader testing with NVDA, JAWS, and VoiceOver.
- Staging synthetic interview smoke test against real staging resources.
- Restore drill against managed database/object-storage infrastructure.

## Blocked

- External production launch is blocked until staging is provisioned, live credentials are configured, DNS/TLS/email domains are verified, and manual launch checks pass.
- Production RPO/RTO claims are blocked until a timed managed restore drill proves them.
- Live-provider readiness is blocked until provider credentials, quotas, and data-processing settings are validated.

## Production Pilot Readiness

Aptly is ready for infrastructure provisioning and staging deployment preparation. It is not yet ready for an external production pilot because live staging, DNS/TLS, provider credentials, restore validation, browser/device testing, and operational alert routing still require manual execution.
