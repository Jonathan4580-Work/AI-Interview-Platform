# AGENTS.md

## Project Mission

Build a premium enterprise recruitment platform where companies invite candidates to complete secure browser-based AI interviews. The AI operates behind the scenes; the product should feel like refined recruitment operations software, not an AI chatbot or novelty tool.

## Operating Principles

- Do not implement production code until the architecture and product documents are approved.
- Treat this as a production SaaS platform from day one: tenant isolation, auditability, privacy, observability, reliability, and maintainability are core requirements.
- Prefer boring, durable technology choices and clear module boundaries over clever abstractions.
- Keep AI provider integration behind replaceable interfaces. DeepSeek is planned for evaluation later, but the realtime interview experience must not depend on any single AI vendor.
- Candidates never create accounts. They enter through secure, expiring, single-use magic links.
- Camera monitoring creates warning signals only. It must never automatically reject a candidate.
- UI must look like premium enterprise software: calm, precise, minimal, trustworthy.

## Required Stack

- Next.js
- TypeScript
- PostgreSQL
- Prisma
- Redis
- BullMQ
- Docker
- Tailwind CSS
- shadcn/ui
- Modular Monolith architecture

## Architecture Direction

The initial system is a modular monolith deployed as one application, with modules isolated by explicit service interfaces, database ownership conventions, and event contracts. The design must allow future extraction into microservices without rewriting business logic.

Core modules:

- Identity and access
- Tenant management
- User and role management
- Candidate invitations
- Email delivery
- Interview session orchestration
- Workflow orchestration
- Browser readiness checks
- Media recording and storage
- Monitoring signals
- Transcription
- Evaluation
- AI governance
- Reporting
- Billing readiness
- Usage and entitlements
- Audit logs
- Compliance and privacy
- Data lifecycle
- Support access
- Search
- Export
- Platform administration
- Observability

## Repository Rules

- Documentation lives in `docs/`.
- Source application code must not be created until the user approves implementation.
- Keep architectural decisions reflected in the appropriate document before coding.
- Do not introduce UI patterns that conflict with `docs/UI_GUIDELINES.md` or `docs/BRAND_GUIDE.md`.
- Do not add AI-first visual language: no robots, glowing gradients, cyberpunk styling, chat-bubble-first interfaces, purple-led palettes, or "magic" product framing.

## Security Rules

- Every tenant-scoped table must include `companyId` unless explicitly global.
- Every tenant query must be scoped by company context at the service/repository boundary.
- Tenant isolation must be enforced through request context, repository/service boundaries, tests, and database-compatible constraints. It cannot rely on developer convention alone.
- Candidate magic links must be hashed at rest, expiring, single-use for session creation, and auditable.
- Candidate resume must use a separate short-lived continuation session, never the original raw token.
- Store secrets only in environment variables or a managed secret store.
- Never log raw magic tokens, credentials, media URLs, identity documents, or complete transcripts.
- Access to recordings, transcripts, evaluations, and HR reports must be permission checked and audited.
- Queue payloads must contain IDs and minimal context only. Do not place transcripts, raw prompts, media URLs, identity payloads, or secrets in queue payloads or job logs.
- Sensitive data must follow the data classification, retention, legal hold, export, and deletion rules in the architecture and database documentation.
- AI evaluation must be governed by provider, model, prompt, rubric, evidence, confidence, redaction, and human override rules. AI output is decision support only.
- Audit logs for sensitive events must include request/correlation/session context and must be protected from application-level mutation.
- Disaster recovery, backup, restore, observability, and tenant isolation tests are implementation prerequisites, not post-launch polish.

## Implementation Gate

Implementation may begin only after the documentation set is reviewed and approved:

- `docs/PRODUCT_SPEC.md`
- `docs/ARCHITECTURE.md`
- `docs/DATABASE.md`
- `docs/API_SPEC.md`
- `docs/UI_GUIDELINES.md`
- `docs/BRAND_GUIDE.md`
- `docs/ROADMAP.md`
