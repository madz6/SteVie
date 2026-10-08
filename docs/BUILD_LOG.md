# SteVie rebuild: build log and review packet

## Current checkpoint — 8 October 2026

This checkpoint supersedes status and validation claims in the historical sections below. This remains a working rebuild, not a completed autonomous Job OS.

### Verified fixes

- Fixed the native Codex adapter's invalid `agents.enabled=false` option. A live structured connection probe succeeded on this machine. The production server has been restarted with the corrected adapter. Claude Code is installed locally but the account owner still needs to sign in using `npm run claude:login`.
- Fixed the blank workspace caused by running an older backend with the new frontend. Bootstrap compatibility errors are visible; production startup requires a built frontend and reports port conflicts.
- Added serial draft autosave and browser recovery for Practice, protected newer edits from delayed feedback, and separated working drafts from submitted answers. Behavioural drills have a direct editor; case drills retain four stages. At 390×844, a fictional verification draft survived reload. This is browser viewport evidence, not a physical iPhone test.
- Case sessions now show readable source content and provenance separately from internal model instructions. Only reviewed case text can start a source-based case. Original source snapshots remain available after source edits.
- Fixed workspace archives to accept actual email confidence values and optional practice fields. Tested 25 MB request handling, nested validation, transactional additive restore, source relationships, existing profile preservation and interrupted-task recovery. A real local export containing 1,135 inbox observations succeeded.
- Tightened inbox extraction after finding generic roles and snippets promoted to high confidence. A backed-up local repair marked 20 earlier auto-recovered identities uncertain without deleting evidence. Further classification changes are in source; broader mailbox coverage still needs work.
- Added Resolve identity for unlinked inbox evidence. A user can choose an existing application or supply an exact employer and role. New records start at status unknown; linked records retain their current stage. Missing messages and conflicting links reject the whole operation. Candidate grouping separates linked and unlinked observations.
- Changing evidence or knowledge used by a draft invalidates its approval and requires review/regeneration. Linked knowledge cannot be permanently deleted; it can be archived. Generated documents expose their stored source excerpts.
- Bulk KB imports keep valid files when another file fails. PDF/DOCX extraction retains filenames and clearly distinguishes readable text from scans or original attachments.
- Removed personal seed data and candidate-specific rules from public source. Fresh installs start empty. Optional local rules and seed data remain in ignored `data/private-seed.json`. Original private review packets stay excluded from Git.
- Added private phone configuration helper and [iPhone verification guide](PHONE_TESTING.md). It prepares a random password and Tailscale HTTPS origin, without opening network access automatically.

### Validation at this checkpoint

- `npm run typecheck`: passed.
- `npm test`: 40 tests passed, zero failures (native adapter, API, persistence, extraction, knowledge, portability and remote authentication).
- `npm run build`: passed; production server started successfully at local port 4317.
- The final test/build initially hit Windows sandbox child-process restrictions and an approval usage limit. After the limit reset, normal approved test and production build commands completed successfully.
- Native Codex: live connection probe passed. Claude: not signed in. No final CV/cover-letter quality claim is inferred from a connection probe.
- Browser: current practice flow rendered at phone width; saved fictional draft survived reload. Real device, push delivery and network access remain unverified.

### Decisions and confidence

| Area | Confidence in current slice | Limitation / next proof |
|---|---|---|
| Persistent records and import/export | High in tested paths | Full browser restore rehearsal, attachment preservation and larger archives |
| KB text ingestion and provenance | Medium-high | Original files, page citations, OCR, explicit source version history |
| Inbox interpretation | Medium | Partial search snapshot; exact role/cycle identity still requires evidence review |
| Manual inbox resolution | High in tested paths | Real user review of ambiguous messages; no silent reassignment |
| Practice draft reliability | Medium-high | Cross-device simultaneous edits and physical phone testing |
| Case coaching quality | Medium-low | Real case packs, exhibit presentation, adaptive interviewer dialogue and calibrated evaluation |
| Codex transport | High for current installed client | Long drafting runs, subscription-limit recovery and future CLI compatibility |
| Claude transport | Unverified live | Account sign-in and a live structured response |
| Mission control and accessibility | Medium | Screen-reader and keyboard walkthroughs; timed real-user tasks |
| Phone access and notifications | Setup prepared | Tailscale sign-in on both devices, HTTPS and physical notification check |
| Jumpstart, Trackr, LinkedIn | Handoffs only | No working autonomous ingestion or Quick Apply adapter |
| Ongoing mailbox/calendar sync | Not implemented | Read-only OAuth, pagination/checkpoints, incremental sync and deduplication |

### Next implementation priorities

1. Connect a read-only mailbox with durable paging and coverage reporting; reconcile new correspondence into existing applications with explicit identity review.
2. Inspect the signed-in Jumpstart flow and implement a verified role capture/review adapter. Trackr needs its actual product URL/API or export format. Keep external submission separate from drafting.
3. Build a useful case studio around the user's real materials: exhibits, staged interviewer dialogue, independent arithmetic checks, feedback rubrics and progress history.
4. Preserve original KB attachments and page-level citations; add source change detection and durable document versions.
5. Complete the private phone setup and notification test, then decide whether an always-on server is necessary. Local native AI sessions currently require the laptop to remain awake.

See [review handoff](REVIEW_HANDOFF.md) for reviewer starting points and [phone testing](PHONE_TESTING.md) for setup.

---


**Build date:** 6 October 2026  
**Workspace:** `SteVie Reboot`  
**Purpose:** rebuild SteVie as a private job operating system that keeps job search, evidence, applications, preparation, practice, people and learning in one place.

## What was built

The rebuild is a local-first React and Node application with a SQLite data layer. It has one source of truth for candidate evidence, a task queue for preparation work, a responsive workspace interface, and explicit provider connection status.

The current product surfaces are:

- Today: priorities, deadlines, follow-ups and work in progress.
- Applications: imported and new roles, status, source links, job descriptions and application packs.
- Practice: behavioural, case, numerical and product drills with stored feedback.
- People: contacts, notes and follow-up dates.
- Learning: planned, active and completed goals with next actions.
- My evidence: source-backed facts with verified, user-stated and unresolved states.
- Connections: Codex, Claude Code, optional API providers, Jumpstart link, preparation limits and device notifications.
- Knowledge base: pasted text, Markdown/JSON imports, document links, previous chat links, GitHub repository links and case-material sources.
- Scout: saved role and people searches with LinkedIn, Jumpstart, Trackr and web handoffs, plus explicit review stages.

## Architecture decisions

### 1. Native provider clients are the AI layer

SteVie calls the official Codex and Claude Code clients through their own signed-in sessions. It does not depend on a local model and does not silently switch a subscription connection to separately billed API usage. OpenAI and Anthropic APIs remain optional providers.

**Reason:** the user has access to stronger hosted models and wants quality over a local-model shortcut.

### 2. Evidence is the factual boundary

Documents and coaching prompts receive a curated evidence set and a controlled context string. Generated candidate claims must carry evidence markers. Zod validation, citation checks, numeric checks and forbidden-claim checks run before a document is saved.

**Reason:** polished but inaccurate CV claims are a higher risk than a document that asks for confirmation.

### 3. Imported application history stays reviewable

Historical roles are imported with `needsReview: true`, unresolved outcomes remain unknown, and historical fit notes are not treated as a fresh assessment. A job description is required for a properly tailored preparation task.

**Reason:** old notes can be useful context without being treated as current truth.

### 4. Preparation is a draft workflow

Preparing a role creates a CV, cover letter, answers and interview brief. It never submits an application, sends an email or changes a third-party account. Documents remain drafts until the user reviews them.

**Reason:** external submission is irreversible and every role can have different eligibility, privacy and accuracy requirements.

### 5. Local access is private by default

The server binds to loopback by default. Remote access requires a long password and an HTTPS public origin. Push notifications use web-push VAPID keys and do not store an email address as a substitute for a device subscription.

**Reason:** the workspace contains personal evidence, job history and generated documents.

### 6. Jumpstart is an explicit integration boundary

The Jumpstart page is stored as a source link and surfaced in Connections. The Quick Apply flow has not been automated or claimed as supported because the signed-in page could not be safely inspected in this build session.

**Reason:** a browser adapter must be verified against the current form, login state, consent screens and submission boundary before it can be trusted.

### 7. Knowledge and scouting are separate from evidence

Source material can be stored and attached to case practice, but it does not become candidate evidence automatically. Scouting opens a source-specific search handoff and keeps the results user-reviewed.

**Reason:** a case pack can teach a method without proving the candidate used it, and LinkedIn/third-party scraping requires a source-authorised path.

## Validation completed

- TypeScript typecheck passed with `npm run typecheck`.
- Nine compiled backend tests passed before the environment execution limit was reached:
  - SQLite recovery.
  - Application worker document creation.
  - Unsupported claim and invalid evidence guards.
  - Provider failure and redaction behaviour.
  - Practice feedback persistence.
  - PDF overflow preservation.
  - Factual checks.
  - API validation, deduplication, active-task protection and daily cap.
  - Import truth and raw-journal exclusion.
- The frontend source now has a responsive visual system, focus states, keyboard-friendly modals and reduced-motion support.
- Windows provider discovery now checks the versioned OpenAI Codex desktop executable and includes a one-command project-local Claude Code PATH setup script.
- A tenth backend test now covers knowledge-source and scouting-plan persistence; it still needs a full runner pass outside the sandbox execution restriction.

The normal Vite build and `tsx --test` runner could not be re-run in the desktop sandbox because Windows process creation for the esbuild child process returned `spawn EPERM`. That is an environment limitation; it is separate from the TypeScript and compiled backend results above. Run the normal commands on the user's machine after cloning to confirm the complete bundle.

## Feature confidence

| Feature | Confidence | Evidence | Remaining risk |
|---|---:|---|---|
| Evidence-backed document generation | High | Provider schemas, citation audit, forbidden-claim checks and backend tests | Native provider output still needs human review for nuance |
| Application tracking and duplicate protection | High | SQLite unique URL index, API validation and backend tests | Historical records need reconciliation |
| Practice sessions and feedback storage | High | Persisted practice flow and backend test | Quality depends on selected provider and prompt |
| PDF and Markdown export | High | PDF renderer and overflow test | Visual review of unusual long documents |
| Codex connection | Medium-high | Codex CLI is installed and signed in | Native structured response should be tested on the user's machine |
| Claude Code connection | Medium | Official client installed and local binary discovery added | Claude account sign-in is still required |
| iPhone notifications | Medium | Service worker, VAPID status, subscription and test endpoints | Requires deployed HTTPS site and Home Screen install |
| Knowledge base and case library | Medium-high | Local source records, text import, link records and case-practice attachment | PDF/DOCX extraction and semantic retrieval are still backlog items |
| Role and people scouting | Medium | Saved searches, source-specific links and review stages | No LinkedIn/Trackr/Jumpstart scraping or API connection yet |
| Jumpstart Quick Apply | Low / unverified | Source URL is stored; public product flow is known | Signed-in form and submission boundary still need inspection |
| Email and calendar connections | Not yet built | Connection surface is ready for provider status | OAuth connector and consent policy still need implementation |
| Production deployment | Not yet built | Local server and security gates are ready | Requires a persistent Node host, HTTPS, environment variables and backups |

## Improvements for the next review

1. Run the complete build and browser smoke test on a normal machine: start the server, add a role, prepare a task with Codex, edit a document, export PDF, create a practice session and reload.
2. Complete Claude sign-in and test a structured application pack, checking that no tool events or credentials enter the saved output.
3. Add a persistent deployment with HTTPS, database backup and a documented restore drill.
4. Add email OAuth with read-only import first, then draft-only email composition. Do not add send permission until the review flow is explicit.
5. Inspect Jumpstart Quick Apply manually and implement a site-specific adapter only if its terms and consent steps permit it. Keep final submission user-controlled.
6. Add stronger document rendering checks for one-page CV layout, page breaks, links and long evidence flags.
7. Add a review dashboard showing every generated claim, its evidence record and the reason a flag was raised.
8. Add observability for task duration, provider failures and retry reasons without logging prompts, documents or credentials.
9. Add a document extraction pipeline for PDF, DOCX and slide decks with page-level citations.
10. Add approved connectors for Trackr, Jumpstart, LinkedIn, email and calendar only after their account permissions and terms are confirmed.
11. Add semantic search and source ranking across the knowledge base, with source citations in practice prompts.

## Setup checklist

### Required now

1. Install Node.js 24 or newer.
2. Clone the GitHub repository and run `npm install`.
3. Run `npm run dev`, then open `http://127.0.0.1:4317`.
4. Confirm Codex with `codex login status`. The current machine is already signed in.
5. If Claude is wanted, run `powershell -ExecutionPolicy Bypass -File .\scripts\setup-claude.ps1` from the project folder. It adds the project-local official client to the user PATH and starts its own browser sign-in. Then use Connections → Test for Claude Code.
6. Review imported opportunities and mark each historical status, deadline and URL as confirmed, changed or archived.
7. Copy the personal contact fields from `.env.example` into a local `.env` file. They are intentionally excluded from the public repository.

### Required for iPhone use

1. Deploy to a persistent Node host with HTTPS.
2. Set `STEVIE_PUBLIC_URL` and a `STEVIE_PASSWORD` of at least 16 characters.
3. Generate VAPID keys and set `STEVIE_VAPID_PUBLIC_KEY`, `STEVIE_VAPID_PRIVATE_KEY` and `STEVIE_VAPID_SUBJECT`.
4. Open the HTTPS site in Safari, choose **Share → Add to Home Screen**, open the new icon and enable notifications in Connections.

### Optional

- Set `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` only if separately billed API use is wanted.
- Set `STEVIE_CODEX_BIN` or `STEVIE_CLAUDE_BIN` only when a provider executable is outside normal discovery paths.
- Add email and calendar OAuth after the core application workflow has passed review.

## Review questions for GPT-6 Ultra

Ask the reviewer to inspect:

1. Whether the provider boundary can accidentally execute tools or leak credentials.
2. Whether every generated factual claim is traceable to evidence.
3. Whether SQLite indexes, task recovery and daily caps remain correct under concurrent requests.
4. Whether the remote-access and push-notification setup is safe for personal data.
5. Whether the React UI has keyboard, mobile and error-state coverage.
6. Whether the Jumpstart, email and deployment boundaries are honest about what is and is not implemented.
7. Which of the listed improvements should be promoted before production use.

## GitHub publication state

The requested repository is `madz6/SteVie`, and it is public with the existing CV Auditor on `main`. The rebuild is prepared as a separate `stevie-reboot` branch so the existing branch is preserved. This was the earlier staging state. The later privacy repair removed historical role seeds from the public source; they now live only in ignored local configuration.

The branch creation and remote commit were not completed in this session because the account's automatic approval review hit its usage limit. No claim of a successful GitHub push should be made until the branch URL and commit SHA are returned by GitHub. After the limit resets, create the branch from `main`, upload the staged tree, and open a draft pull request for GPT-6 Ultra review.

## Reset-pass continuation — 6 October 2026

This section supersedes the earlier backlog notes above for the features completed in the current workspace. It records what is actually present on disk after the Astra review pass.

### Delivered in this pass

- **Mailbox recovery:** a private, local Gmail evidence snapshot contains 1,135 messages from a targeted application/interview/assessment search (16 pages, 8 July 2019–4 October 2026). The snapshot is explicitly marked partial rather than exhaustive. The classifier keeps each message, separates recommendations from employer events, detects incoming versus outgoing mail, and allows one thread to support more than one role. Recovery created 52 applications and linked four existing applications and leaves recovered records marked for review.
- **Mission control:** Today now exposes coverage, recoverable inbox decisions, application work, practice, learning and follow-ups as direct actions. The default recovery view shows actionable candidates instead of flooding the user with low-confidence mailbox noise.
- **Knowledge base:** bulk source preview supports text, Markdown, JSON exports from ChatGPT mapping and Claude `chat_messages`, PDF and DOCX selectable text. Sources retain provenance, reviewed/unreviewed/archived state, bounded excerpts and warnings when extraction cannot read a scanned document. Reviewed sources are retrieved into preparation and coaching context with source snapshots.
- **Case practice:** case drills can use a reviewed imported case instead of the synthetic fixture. The studio has Clarify, Structure, Calculate and Recommend stages, persisted answers, a pauseable timer, source labelling and saved feedback.
- **Portability:** versioned workspace JSON export/import preserves supported records, IDs, relationships, provenance and inbox coverage without exporting credentials. Imports preview conflicts before an additive restore; pending work is restored as failed for explicit retry. Applications also export as formula-neutral CSV.
- **Privacy and reliability fixes:** provider/source flags survive document edits, public access still requires authentication, local test ports remain usable, and PDF/DOCX parsing is bounded. No mailbox credentials, API keys or push subscriptions are included in the workspace archive.

### Current validation

- `npm run typecheck` passes.
- Compiled direct test runs pass: 10 backend tests, 5 inbox-recovery tests, 3 knowledge/practice tests and 7 portability/security tests (25 total).
- The normal `npm test` and Vite build were not executable in this Windows session because child-process creation returned `spawn EPERM`; this is an environment limitation and still needs a normal-machine smoke test.
- Installing the PDF/DOCX extraction dependencies reports three moderate npm audit findings in transitive packages; no high or critical findings were reported. Review or replace those dependencies before public deployment.

### Confidence after this pass

| Area | Confidence | What still needs proof |
|---|---:|---|
| Inbox evidence and recovery | Medium-high | Broader mailbox queries and user review of ambiguous or repeated roles |
| Knowledge import and source retrieval | Medium-high | Page-level citations, OCR for scans and larger real-world exports |
| Source-grounded practice | Medium-high | Provider feedback quality and exhibit/chart drills |
| Workspace export/import | Medium-high | Normal-machine browser round trip and backup/restore rehearsal |
| Mission-control daily flow | Medium | Browser accessibility pass and user task timing |
| Codex connection | Medium-high | Live structured generation on the user’s signed-in machine |
| Claude Code connection | Medium | Official client sign-in still required on this machine |
| Jumpstart Quick Apply | Low / unverified | Manual signed-in flow inspection and a consent-controlled adapter |
| Gmail/calendar OAuth | Not connected | Read-only connector implementation and consent review |
| LinkedIn/Trackr scouting | Medium for handoffs | Authorised APIs or user-reviewed browser handoff; no scraping claim |

### Immediate handoff

1. Run `npm run typecheck`; then run the normal test/build commands on a machine where Windows child processes are permitted.
2. Open the local workspace and review the recovered inbox candidates before treating historical statuses as current.
3. Import the user’s case packs and previous ChatGPT/Claude exports through Knowledge, mark only trustworthy sources as reviewed, then start source-based case sessions.
4. Run `powershell -ExecutionPolicy Bypass -File .\\scripts\\setup-claude.ps1` and sign in through the official client if Claude output is wanted.
5. Do not publish the public GitHub branch until personal seed filenames and any local-only material have been reviewed; the Gmail snapshot and SQLite database are intentionally ignored by Git.
