# Email System

Phase 4 establishes Aptly's provider-neutral, queued email delivery foundation. It supports SMTP and preview delivery modes, tenant-scoped configuration, versioned templates, delivery attempts, provider events, and internal management APIs.

## Secret Handling

- SMTP credentials are never stored in PostgreSQL.
- `smtp_profiles.secret_ref` stores only a managed secret reference such as `tenant/acme/smtp`.
- Runtime credentials are resolved by `EnvironmentSmtpSecretResolver` or a future secret-manager implementation.
- Queue payloads contain only `companyId`, `deliveryId`, `requestId`, and `correlationId`.
- Audit snapshots redact `secretRef` and do not include raw email bodies, SMTP passwords, signed URLs, or raw provider payloads.

## Development Delivery

Local and test environments default to:

```env
EMAIL_DELIVERY_MODE=preview
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
```

Preview mode confirms the delivery pipeline without contacting production SMTP infrastructure. If local SMTP capture is needed, run a tool such as Mailpit or MailHog on port `1025` and set `EMAIL_DELIVERY_MODE=smtp` with a development-only `SMTP_SECRET_REF`.

## Deliverability Guidance

Each tenant-owned sender domain should publish:

- SPF: authorize the tenant's SMTP provider or Aptly-managed provider.
- DKIM: publish provider-issued DKIM public keys for the sender domain.
- DMARC: publish a policy record and reporting address before high-volume sends.

Recommended rollout:

1. Start with `p=none` DMARC monitoring.
2. Verify SPF and DKIM alignment.
3. Move to `p=quarantine` once legitimate traffic is aligned.
4. Move to `p=reject` only after monitoring confirms no legitimate mail is failing.

Sender domain records in Aptly track DNS TXT verification metadata and status. DNS polling and provider-specific DKIM automation remain future extension points.

## Bounce And Complaint Contracts

Provider webhooks should map provider events into:

- `delivered`
- `deferred`
- `bounced`
- `complained`
- `failed`

Provider payloads must be normalized before storage. Store only safe reason codes, concise reason text, provider message IDs, and timestamps. Do not store full webhook payloads when they include message bodies, recipient lists beyond the target delivery, headers with tokens, or provider credentials.

## Operational Notes

- Email workers rehydrate delivery data from PostgreSQL and resolve SMTP credentials at runtime.
- Temporary SMTP failures are marked `deferred` and rethrown for BullMQ retry.
- Permanent provider failures are marked `failed` and are safe to retry only through authorized internal APIs.
- Tenant email can be disabled at the platform level through email settings.
- Every tenant-owned email record uses `company_id` and tenant-qualified keys or indexes.
