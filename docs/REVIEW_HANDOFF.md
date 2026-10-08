# SteVie review handoff — 8 October 2026

## Product goal

A private mission control for job search: recover forgotten applications, maintain reusable evidence and knowledge, find roles and people, prepare documents, practise interviews, and review work from a phone. The present build covers local records, recovery from saved messages, KB text import, drafting/provider adapters, basic practice and portable archives. External connectors are not complete.

## Start here

- `docs/BUILD_LOG.md`: current checkpoint, prior decisions, tests and confidence.
- `server/ai.ts`: native client isolation, structured responses, provider error reporting, no silent metered fallback.
- `server/import.ts`: optional private seed and validation rules; public installs must stay empty.
- `server/inbox.ts`: conservative classification, historical observation groups, automatic recovery boundaries and manual identity resolution.
- `server/knowledge.ts`, `server/practice.ts`: source extraction, reviewed-source retrieval and immutable practice snapshots.
- `server/api.ts`: task lifecycle, source invalidation, draft progress and preservation of edits during feedback.
- `server/portability.ts`: schema validation, dependency checks, additive preview/commit transaction and pending-task recovery.
- `server/security.ts`, `server/notifications.ts`: authentication, origin checks, device subscriptions and deployment requirements.
- `src/MissionControl.tsx`, `src/Recovery.tsx`, `src/PracticeSession.tsx`: daily decisions, source review and phone drafting.

## Verified baseline

Type checking, 40 regression tests and production build passed on Windows with Node 24. Codex returned a live structured probe; this proves connectivity, not the quality of every generated document. Phone-width practice draft recovery was exercised in the browser. Physical iPhone, push delivery, live Claude and cloud deployment remain unverified.

## Review priorities

1. Look for source-to-claim gaps and invalidation bypasses. Heuristics cannot establish factual truth; source snapshots are not claim-level immutable document history.
2. Test ambiguous email identities, repeated hiring cycles and partial source coverage. A recommendation must never become proof of an application.
3. Exercise simultaneous edits from laptop and phone; current draft persistence serialises one component's saves, not competing devices.
4. Check native client sandbox/tool isolation and timeout cleanup. Never let imported text grant filesystem, browser or shell authority.
5. Verify export/import against realistic backups without sharing credentials, private seed rules, device subscriptions or original local audit notes.
6. Walk all phone and keyboard workflows. Broad responsive styling is not a complete accessibility certification.
7. Test actual case packs and provider feedback. Existing synthetic drills are fixed fixtures, not an adaptive interview curriculum.

## Important remaining work

Read-only mailbox OAuth and incremental sync; working Jumpstart/Trackr import; verified Quick Apply flow; people discovery beyond saved search handoffs; original attachment storage/OCR/page citations; document versions; adaptive case interviews; calibrated assessments; phone notification proof; always-on operation.

Do not treat source links as connected accounts, a saved chat URL as extracted chat content, a model connection probe as a completed application pack, or historical interview mail as a current booking. Nothing in this checkpoint sends outreach or submits job applications.
