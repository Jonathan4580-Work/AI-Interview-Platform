# Final Privacy Review

## Status

Ready with accepted risk for staging deployment. External production launch requires live provider and data-processing validation.

## Verified Foundations

- Candidate consent records are versioned.
- Monitoring disclosure and neutral warning separation are documented and implemented in prior phases.
- AI output is decision-support only and does not automatically change candidate/application status.
- Human decision ownership is separate from AI evaluation output.
- Retention, legal hold, privacy-request, export, audit, and data-region foundations exist.
- Production environment requires managed secret references.
- Provider setup documentation keeps optional providers disabled until configured.

## Privacy Controls To Validate In Staging

- Consent versions shown to candidates match persisted versions.
- Candidate withdrawal and privacy-request handling produce audit history.
- Restricted identity, accommodation, transcript, prompt, evidence, and media data are excluded from general search and analytics payloads.
- Export access is audited and signed URLs are not persisted.
- AI redaction excludes restricted fields before provider calls.
- Monitoring warnings remain contextual and do not affect scores or decisions.

## Provider Data-Sharing Checks Required

- OpenAI or evaluation provider data-processing terms, region, retention, and logging policy.
- Transcription provider data-processing terms, region, retention, and logging policy.
- Email provider processing, bounce/complaint data, and template content handling.
- Object-storage region and cross-region transfer policy.
- SSO, SCIM, ATS, and webhook data-sharing scopes.

## Backup And Retention

- Backup retention is documented but must be configured in managed infrastructure.
- RPO/RTO are not proven until a timed restore drill is performed.
- Legal-hold behavior must be validated against production-equivalent storage.

## Accepted Risks

- No real production data has been processed.
- No live provider privacy settings have been verified.
- No DPA or vendor-review completion is claimed.
- Regional data-residency controls are policy/configuration foundations until infrastructure is selected.

## Launch Blockers

- Unverified provider data-processing settings.
- Missing legal/compliance approval for the pilot region and provider set.
- Untested deletion/anonymization workflow against staging-equivalent data.
- Unverified backup retention and restore path.

## Go/No-Go

Go for staging with synthetic data only. No-go for external production launch until provider privacy review, data-retention configuration, backup validation, and manual privacy checks are complete.
