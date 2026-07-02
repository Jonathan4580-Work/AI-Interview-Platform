# Production Architecture

## Status

Status: implemented as architecture and deployment artifacts. Not deployed. Requires infrastructure access, managed secrets, DNS, TLS, and provider credentials.

## Deployment Target Decision

Recommended path: a managed container platform running Aptly as a modular monolith.

Recommended providers:

- Application containers: Render, Fly.io, AWS ECS/Fargate, Google Cloud Run, or Azure Container Apps.
- PostgreSQL: managed PostgreSQL with PITR, TLS, automated backups, and connection pooling.
- Redis: managed Redis with TLS/authentication for BullMQ and rate-limit state.
- Object storage: S3-compatible private buckets with server-side encryption and lifecycle policies.
- Secrets: platform-managed secret store or cloud secret manager.
- Observability: hosted metrics/logs/alerts with PII-safe labels and runbook links.
- CI/CD: GitHub Actions foundation with explicit production approval gate.

Preferred initial production shape:

- One web service from the Aptly web image running `node .next/standalone/server.js`.
- Separate worker services from the dedicated `Dockerfile.worker` image running `npm run worker:prod`.
- One one-off migrator image target running `npm run migrate:deploy`.
- Managed PostgreSQL, Redis, and object storage.

Alternative path: Kubernetes. Use only when the team needs cluster-level controls, custom egress policies, or complex autoscaling beyond a managed container platform.

## Why Not Microservices

Aptly remains a modular monolith. Phase 12 created extraction seams, but production launch should minimize operational complexity. Module extraction should wait for observed scale pressure.

## Runtime Components

| Component           | Recommended production form                                           | Status                                                    |
| ------------------- | --------------------------------------------------------------------- | --------------------------------------------------------- |
| Next.js web app     | Managed container service, HTTPS ingress, health/readiness probes     | Implemented as container artifact; not deployed           |
| Workers             | Separate container services by worker class using `Dockerfile.worker` | Implemented as shared worker entrypoint; topology pending |
| PostgreSQL          | Managed PostgreSQL 16+, TLS, PITR, connection pooling                 | Requires infrastructure                                   |
| Redis/BullMQ        | Managed Redis with TLS and auth                                       | Requires infrastructure                                   |
| Object storage      | Private S3-compatible buckets, SSE, CORS-limited origins              | Requires infrastructure                                   |
| Email               | Transactional provider or SMTP with verified sender domain            | Requires credentials/DNS                                  |
| Domain/TLS          | Managed TLS, HSTS after validation                                    | Requires DNS/control plane                                |
| Secrets             | Managed secret store references only                                  | Requires secret store                                     |
| Metrics/logs/alerts | Low-cardinality telemetry, alert routing, runbooks                    | Requires observability provider                           |
| Backups             | Managed DB backups/PITR plus object-storage versioning                | Requires infrastructure                                   |

## Sizing Assumptions

Initial controlled pilot:

- Web: 2 instances, 1-2 vCPU, 1-2 GB RAM each.
- Workers: 1 instance per critical class at first; scale provider-bound workers separately.
- PostgreSQL: managed instance with PITR, 50-100 GB storage minimum, connection pooling.
- Redis: managed instance sized for BullMQ plus rate limits; start small with memory alerts.
- Object storage: private bucket with lifecycle policies and multipart upload support.

Known limits:

- In-memory rate limiting must be backed by Redis or edge controls for horizontal scale.
- Real browser/media load testing requires staging infrastructure.
- Production provider behavior is unverified until credentials and sandboxes exist.
- Webhook DNS revalidation must be wired in the production delivery worker before enabling real outbound webhooks.

## Scaling Model

- Scale web instances on request latency, 5xx rate, and CPU/memory.
- Scale workers by queue depth, oldest job age, provider throttling, and tenant fairness signals.
- Keep provider-bound queues isolated from internal CPU/IO work.
- Use feature flags and kill switches before increasing rollout scope.
