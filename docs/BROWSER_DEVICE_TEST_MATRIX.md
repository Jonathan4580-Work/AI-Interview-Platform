# Browser And Device Test Matrix

## Status

This matrix is prepared for launch validation. Practical live browser/device execution is pending because no staging or production environment is available in this workspace.

## Desktop Browser Matrix

| Scenario                                | Chrome  | Edge    | Firefox | Safari  | Status                                        |
| --------------------------------------- | ------- | ------- | ------- | ------- | --------------------------------------------- |
| Login                                   | Pending | Pending | Pending | Pending | Requires staging URL                          |
| Candidate magic link                    | Pending | Pending | Pending | Pending | Requires email/link setup                     |
| Consent flow                            | Pending | Pending | Pending | Pending | Requires staging URL                          |
| Camera permission granted               | Pending | Pending | Pending | Pending | Requires device/browser pass                  |
| Camera permission denied                | Pending | Pending | Pending | Pending | Requires manual pass                          |
| Microphone permission granted           | Pending | Pending | Pending | Pending | Requires device/browser pass                  |
| Microphone permission denied            | Pending | Pending | Pending | Pending | Requires manual pass                          |
| Identity still capture                  | Pending | Pending | Pending | Pending | Requires object storage                       |
| Readiness checks                        | Pending | Pending | Pending | Pending | Requires browser APIs                         |
| Interview recording                     | Pending | Pending | Pending | Pending | Requires media capture                        |
| MIME fallback                           | Pending | Pending | Pending | Pending | Requires browser-specific validation          |
| Multipart upload retry                  | Pending | Pending | Pending | Pending | Requires object storage                       |
| Refresh recovery                        | Pending | Pending | Pending | Pending | Requires live session                         |
| Network interruption                    | Pending | Pending | Pending | Pending | Requires controlled network test              |
| Monitoring supported behavior           | Pending | Pending | Pending | Pending | Requires browser pass                         |
| Monitoring unsupported behavior         | Pending | Pending | Pending | Pending | Firefox/Safari assumptions require validation |
| Completion                              | Pending | Pending | Pending | Pending | Requires workflow workers                     |
| Transcript/evaluation/report processing | Pending | Pending | Pending | Pending | Requires workers and dev providers            |
| Workspace search/reports/exports        | Pending | Pending | Pending | Pending | Requires authenticated staging tenant         |
| Reduced motion                          | Pending | Pending | Pending | Pending | Requires manual setting check                 |
| Keyboard-only use                       | Pending | Pending | Pending | Pending | Requires manual pass                          |
| Screen-reader basics                    | Pending | Pending | Pending | Pending | Requires assistive technology                 |

## Device Matrix

| Device/OS      | Required Checks                                                                     | Status  |
| -------------- | ----------------------------------------------------------------------------------- | ------- |
| Windows laptop | Chrome, Edge, Firefox; camera/mic; upload retry; keyboard-only                      | Pending |
| macOS laptop   | Chrome, Firefox, Safari; camera/mic; VoiceOver smoke                                | Pending |
| iPad/tablet    | Supported guidance, responsive layout, unsupported recording behavior if applicable | Pending |
| Mobile phone   | Supported guidance, recovery/help pages, non-blocking unsupported-device flow       | Pending |

## Automated Coverage Already Available

- Repository unit and integration tests cover interview state, media contracts, monitoring constraints, transcripts, evaluations, reporting, search, exports, integrations, and security foundations.
- These tests do not replace manual browser/device validation.

## Launch Blockers

- External pilot must not start until Chrome, Edge, Firefox, and Safari have at least one passing controlled candidate flow or documented accepted limitation.
- Candidate recording and upload recovery must be validated against production-equivalent object storage.
- Screen-reader basics must be validated for candidate entry, readiness, interview, and completion flows.
