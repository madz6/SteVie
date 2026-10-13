# SteVie rebuild: build log and review packet

## Current checkpoint � 13 October 2026: People and outreach

This section supersedes earlier status snapshots. SteVie remains a single-owner local application with a limited set of connected discovery sources.

### Shipped behaviour

- People now retains multiple source-backed hiring signals (URL, observed date, summary, unconfirmed/user-confirmed/closed), links to multiple saved roles, editable contact details and constrained conversation statuses. Roles open their real application detail; due follow-ups can be filtered on a phone.
- New durable outreach tasks use the explicitly selected provider and bounded structured output. Context includes profile, usable career evidence, contact notes, signal summaries and linked-role text. Contact email/profile/source URLs are not needed by the drafting prompt. This is drafting only: no message transport, guessed email enrichment or application submission.
- Drafts expose checks and human-readable evidence, support editing, marking reviewed, copy and plain-text download. Contact/source edits, evidence edits and relevant linked-role edits invalidate affected drafts. A context change during generation fails the task without saving an outdated draft.
- Concurrent duplicate requests are rejected, failed calls count against a separate daily outreach budget, retries preserve provider selection and up to 20 drafts are retained per contact. The configured daily limit supplies the numeric cap. Draft removal is an explicit user action.
- Mission Control includes outstanding outreach reviews and correctly routes running outreach tasks to People. Completion notifications target People; delivery still requires a registered device subscription.
- JSON archives preserve signals, many-to-many role links, draft review state and task ownership. Import checks related record IDs and never starts restored work automatically.

### Evidence and confidence

- 68 automated tests pass, including source/date validation, provider capture, duplicate prevention, failed-call caps, context change rejection, invalid evidence IDs, source URL changes and archive relationship validation. TypeScript and production build pass.
- A live Claude Code draft succeeded using only fictional candidate/contact data. It asked about a possible opening without claiming a vacancy or shared relationship. The observed-date language was too confident, so the prompt now explicitly separates observation date from publication date and preserves simulated/training qualifiers. This last prompt tightening is not a guarantee of factual correctness; all drafts require human review.
- Browser at 390�844: edited and saved a fictional outreach subject, marked it reviewed, edited the contact status and opened its linked role. This is responsive browser evidence, not a physical iPhone test.
- Read-only production check: all four scheduled scouts ran on 13 October at 06:30, 12:30, 16:30 and 19:00 Dublin. Latest run read 114 postings across Monzo, BearingPoint Ireland and GoCardless, with zero newly shortlisted roles. No tasks were active before deployment.
- Confidence: high for tested persistence/queue/review paths; medium for model draft quality; automatic people discovery and mailbox reply sync are not implemented. No real networking messages were generated or sent in validation.

### Architecture decisions and remaining work

Contacts own their signal history and draft history as bounded optional fields, maintaining compatibility with existing records. Role IDs provide many-to-many links without a second duplicated jobs store. A distinct outreach task kind uses the existing persistent worker and failure reporting. Existing application/practice work is unchanged.

Next: standalone company signals and authorised bulk ingestion; broaden verified employer feeds; compare/revise outreach with a second model; live mailbox sync; source publication dates and immutable context snapshots; stronger semantic evidence checks; a configurable dedicated outreach budget and discard/restore UX; tenant isolation and durable hosted workers before a shared Vercel service. A signal's current status is still manually maintained, and merely saving a link never means a platform account is connected. The previous AIB application-pack failure is not fixed by this release.

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

### Publication and final smoke checks

- Uploaded the rebuild to `codex/stevie-job-os` in the requested public `madz6/SteVie` repository. `main` remains unchanged. The review branch proposes replacing the earlier CV-auditor root application; review before merging.
- [GitHub Actions run 37823472900](https://github.com/madz6/SteVie/actions/runs/37823472900) passed on Linux for implementation commit `f5d3b221bb4c117845f6612c8c1d90794cee653f`.
- The running production app's Codex connection check returned connected at 18:19 UTC on 8 October.
- Exporting the actual workspace and previewing the untouched JSON back into the same workspace produced zero conflicts, zero creations and 1,244 skipped existing records. No import was committed. A diagnostic PowerShell deserialize/reserialize changed date strings and produced conflicts; raw JSON preserved the archive correctly.
- The inbox identity form opens on the production phone-width UI. Record-changing behavior is covered by isolated fixtures rather than modifying real identities for a smoke test.
- Draft pull request creation was rejected by the GitHub connector with HTTP 403 (resource not accessible by integration). The in-app GitHub browser is signed out. The uploaded branch can still be reviewed directly or compared with `main`; no pull request is claimed.

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

## Career scouting, review navigation and Claude delivery - 9 October 2026

### Delivered and design decisions

- Career/income/unclassified pipelines are independent of full-time/part-time/contract hours. Existing titles receive visible suggestions; explicit user classifications win. Today and Applications default to career roles. Uncertain records are not silently declared career matches.
- Application Review clears a stale search, opens the chosen record, and hides the long application list on narrow screens. Document Review carries the document ID in the URL and opens its editor, including on reload. Mark details reviewed persists without changing the application stage.
- Fixed Claude Code structured output: blocking every tool also blocked its internal StructuredOutput response. Only StructuredOutput is auto-allowed; built-in tools, external MCP, browser access and session persistence remain disabled. A live subscription probe and a real four-document application task succeeded. No API-key fallback was introduced.
- Career-only scouting uses a Codex chat heartbeat at 09:00, 14:00 and 19:00 Europe/Dublin. Saved role/location preferences are editable in Scout. It relies on the laptop, Codex and SteVie being available; it is not an always-on server crawler.
- Research ingestion records source URLs, requirements, eligibility notes and verified deadlines; deduplicates URL and employer/title/location; excludes income/ineligible roles; and queues only eligible matches within the preparation cap. Uncertain matches are retained for review. A first researched batch saved two real roles, queued one pack and held one for an eligibility check.
- User explicitly approved candidate profile/contact data, career evidence, reviewed knowledge excerpts and role requirements going to signed-in Claude Code for the current and future matching career roles. Claude is now the local default. This permission does not include external application submission or outreach.
- Knowledge explains individual conversation paste and ChatGPT/Claude JSON import. Provider login grants generation access, not access to old conversations. Links alone remain link-only records. No case material is implied to exist before import.
- Workspace archives preserve classification, working arrangement and scouting preferences, while excluding the external schedule and credentials. Review checks collapse above the document to keep the draft accessible on phones.

### Verification and current evidence

- TypeScript validation and production build passed. All 46 automated tests passed, including new review-state, classification, deadline, malformed historical URL, provider restriction and portability regressions.
- At a 390 x 844 browser viewport, tested Today -> Review application, Mark details reviewed -> decision disappears, Review document -> actual editor, document reload, and Review inbox evidence -> Inbox recovery. These are browser checks, not physical iPhone testing.
- One live Claude task saved all four nonempty documents atomically. The CV PDF download returned a valid PDF. Drafts remain needs_review due to missing contact details and unconfirmed evidence/eligibility; generation success is not submission readiness.
- The additional eligible scout pack also completed with four saved drafts. Eight documents are now saved across two applications; both task records are done. A queued task is never counted as a delivered CV.

### Confidence and remaining work

| Area | Confidence | Remaining limitation |
|---|---|---|
| Review navigation | High for tested flows | Physical iPhone/Safari verification still needed; not every historical record was individually opened |
| Career classification | Medium | Rules suggest purpose from titles; ambiguous titles need user overrides |
| Claude connection and draft persistence | High on this machine | Subscription availability/rate limits can interrupt future work |
| CV content | Medium, requires review | Confirm contact details, candidate-stated metrics, skills and eligibility; improve concision and compare against actual employer requirements |
| Scouting ingestion | High for tested schema/duplicates/holds | Discovery coverage and eligibility assessment depend on source quality and agent research |
| Recurring execution | Medium | Schedule configured; a future timed wake-up and phone notification have not yet been observed |
| Chat imports | Medium-high | Large exports need splitting; private chat links do not grant readable content |

Live mailbox sync, Jumpstart Quick Apply, Trackr API integration, automatic LinkedIn collection, and always-on hosting remain unfinished. Inbox recovery is still a partial historical snapshot. This update does not claim a complete A-Z job service.

### First scheduled evening scout - 9 October 2026

The timed chat wake-up ran against the live workspace. One new employer-verified career role was saved and a Claude application task completed with four documents. The employer required an anonymous CV and one stream choice, both retained in the role record; no application was submitted. During export review, CV PDF author metadata was found to reintroduce identity even when the visible text was anonymous. CV exports now omit the hidden Author field entirely; letter author behaviour is unchanged. Regression coverage uses an explicitly configured private author and asserts that a CV PDF has no Author entry. Text still needs user review for indirect identifying details, unsupported claims and employer-specific requirements.

## Evidence editing and actionable draft review - 10 October 2026

### Delivered and decisions

- My evidence now supports adding and editing career facts, contact details, source descriptions, categories and confirmation status. Nothing is automatically declared verified; confirmation is a user action.
- Reviewed knowledge sources offer an explicit path to add a career fact, with the source reference filled in. The fact starts blank and unconfirmed, so assistant suggestions in old conversations do not silently become candidate achievements.
- Document review shows the actual linked candidate evidence as well as saved reference excerpts. Candidate evidence is labelled as current data, not an immutable generation snapshot.
- Review warnings can be resolved with a saved explanation of at least 12 characters. Original generation warnings and review timestamps remain in the record and workspace archive. Review notes record a human decision, not independent verification.
- Current factual validation, missing placeholders, PDF layout problems and invalid/stale provenance still block approval. Evidence edits invalidate dependent drafts and clear review notes; draft text edits clear old resolutions. Changed sources require a fresh pack.
- Added bracketed MISSING and TBC placeholder detection. No private facts or contact details were invented or confirmed by the implementation.

### Verification

- TypeScript validation and production build passed; all 49 automated tests passed. New regressions cover review notes, blocked factual/provenance checks, editing resets and evidence updates. The 10 portability tests also passed after adding saved review notes to the round-trip fixture.
- Using an isolated in-memory workspace with fictional data, added confirmed contact evidence through the UI, resolved a review warning, approved the draft, and verified the saved state. At 390 x 844 the checklist and approval control were usable. The knowledge-to-evidence form retained its source and started with a blank fact and unconfirmed status.
- No real candidate records were changed during the UI checks, and no new packs or external applications were submitted by these tests.

### Confidence and remaining improvements

High confidence in the tested editing, review-state and archive flows. Medium confidence in content readiness: validation uses heuristics and cannot establish that every claim is true. Review text must be meaningful, even though software can enforce only its presence and length. Physical iPhone testing remains outstanding. Future work includes immutable candidate-evidence snapshots, structured links between extracted facts and their source documents, stronger contextual claim validation, and employer-specific page limits. Mailbox sync, connected platform imports and other previously documented integration gaps remain open.

## Native scheduled scouting and complete-pack gates - 10–12 October 2026

### Delivered and decisions

- Moved recurring work into SteVie's server worker and persistent SQLite task queue. The previous Codex heartbeat is PAUSED. Schedule is enabled locally at 09:00, 14:00 and 19:00 Europe/Dublin; Codex can be closed. A fresh install defaults to paused.
- Implemented fixed-origin Greenhouse and Lever feed adapters, request limits, title/location rules, career-only exclusions and duplicate suppression before model calls. Enabled live boards: Monzo, BearingPoint Ireland and GoCardless. Coverage is explicitly limited to configured employers.
- Claude assesses at most seven shortlisted roles against saved preferences and usable evidence. Eligible new roles queue CV/letter/answers/brief tasks under the existing daily cap; uncertain roles are held. Captured provider choice is preserved; failures never switch providers.
- Added mobile-accessible schedule/coverage editing, manual runs, source diagnostics and inclusion/exclusion reasons for newly assessed runs. Cached unchanged postings avoid repeated model spend for seven days. Existing applications do not trigger automatic pack regeneration.
- Launched the production server independently with a hidden Windows helper and installed a sign-in Startup shortcut on this laptop. Local runtime and logs remain ignored. The helper is shipped; the machine-specific shortcut is not.
- Reject incomplete/placeholder packs and missing/invalid evidence references before any document writes. Historical incomplete packs retain their text with blocking flags and lose misleading done labels. Reopening a successfully replaced task does not re-quarantine it solely because its old quarantined documents remain.
- Constrained the provider's structured evidence list to actual supplied usable record IDs and explicitly required four complete documents. Inline citations remain independently audited; the schema cannot establish factual truth.
- Structured Claude errors now pass through the same credential-free classifier as process failures, including usage-limit detection. No raw model output or candidate details are surfaced in these errors.
- Notification links target the relevant role or Scout; failure and partial-run messages are distinct from completed drafts. Empty successful runs do not send push messages.

Architecture alternatives, consequences and follow-ups are in [ADR-001](ADR-001-native-career-worker.md). Operational instructions are in [SCOUTING.md](SCOUTING.md).

### Verification and observed outcomes

- Final TypeScript validation passed; all **57 tests passed**. Production UI build passed. Regression coverage includes Dublin DST/latest-slot handling, overlap avoidance, source failures, provider isolation, repeated-result suppression, complete-pack rejection, historical quarantine, constrained evidence schema and safe structured error messages.
- Native timed runs were observed at 19:00 Dublin on 10 October, all three slots on 11 October, and 09:00/14:00 on 12 October. The latest checked **112 postings** across all three feeds with no source errors and no new matching roles. The initial manual native run shortlisted four roles; Claude excluded all four. These are checked postings, not 112 suitable opportunities.
- The production process was restarted only after confirming no queued/running work. Password-protected private access and the existing startup shortcut were checked. The old chat heartbeat was confirmed paused.
- Isolated fictional UI checks at 390 x 844 exercised enabling the schedule, coverage/time editing, saving filters and queuing a manual run with the button disabled afterwards. The fixture had no worker and made no real submissions. Its temporary server/tab were closed and viewport reset after testing. Screenshot retained locally in ignored `.runtime/native-scout-phone.png`.
- **AIB Finance pack remains failed, not delivered.** Its original letter/answers/brief contained placeholder-only text and were quarantined. A 10 October retry was rejected for invalid evidence references. A 12 October retry after tighter schema/prompt constraints failed at the Claude client; no new documents were saved. A subsequent small structured connection probe succeeded. This does not establish that full pack generation is reliable. The earlier generic error did not retain enough diagnostic detail to establish the cause; the new classifier improves future errors without retaining private output.
- Notification status reports **zero device subscriptions**. No physical iPhone delivery has been demonstrated.

### Confidence, limitations and next work

| Area | Confidence | Remaining work |
|---|---|---|
| Native schedule and feed reads | High on this laptop while awake | Crash watchdog, wake-from-sleep/always-on hosting; scheduled work can wait behind long drafting tasks |
| Discovery coverage | Low for the whole job market | More verified employers and supported adapters; current three-board coverage is narrow |
| Matching | Medium | Align simple filters with full preferences; improve geographic matching, structured deadlines and application-open verification |
| LLM generation reliability | Medium-low for the failed AIB case | Diagnose full structured-response failures; no claim that a small connection probe proves a complete pack can finish |
| Pack integrity gates | High for tested structural failures | Semantic truth still needs review; length and citation checks are heuristics |
| Phone layout | Medium-high for tested browser width | Physical Safari testing and push subscription/delivery |
| Portability | Medium | Native schedule, feed configuration, run history and credentials are not restored by the current workspace archive |

Still unfinished: live mailbox OAuth/sync, Jumpstart Quick Apply, Trackr API integration, automatic LinkedIn/people collection, broader discovery and always-on hosting. This release completes the native scheduling handover; it does not complete the entire A–Z job OS or the failed AIB replacement pack. No applications or outreach were sent.

## Commute schedule, mobile sorting and joint review - 12 October 2026

- Updated live native schedule to **06:30, 12:30, 16:30 and 19:00 Europe/Dublin**, preserving existing preferences/feeds. Chose 06:30 to allow preparation time before the user's bus journey, not because all employers publish then. The UI/schema now support four slots; Dublin DST remains respected.
- Applications now store Phone-friendly / Better on laptop / Not checked ratings and an explanatory note. Phone-first sort uses that observed rating; unchecked sites are not labelled easy from a URL. Ratings survive workspace export/import.
- Practice offers Codex coaching, Claude coaching, or a bounded Codex + Claude challenge. A saved document can also queue that joint critique into Practice. Reviewer choices persist, both opinions/scores stay attributed, and first feedback is saved before the second call. A second-provider failure marks the round failed but preserves that first opinion. There is no silent fallback, automatic rewrite, document approval or external submission.
- Live **fictional** numerical review succeeded through both signed-in clients: Codex checked the answer, Claude agreed with the arithmetic and disputed a specific critique about missing units. This proves the two-client path on one bounded example; it does not establish universal reliability or resolve the previously failed AIB pack.
- Added LinkedIn post search handoffs for hiring signals. Existing automatic discovery remains the same three employer boards. No automatic LinkedIn harvesting, contact enrichment or cold-email sending was added. Exact boundaries and a relationship-led workflow are in SOURCE_COVERAGE.md.
- Clarified editable database-backed career preferences versus initial feed filters. Existing role families are junior consulting/strategy, product/product operations, fintech operations, business/data analysis and graduate programmes; primary locations are Dublin and London. US interest remains conditional on viable work authorisation. Private facts and preferences were not hard-coded into public source.
- Added MAKE_IT_YOURS.md for clean personal forks with their own accounts. Documented that the current workspace/password is single-user, and laid out the tenant/database/worker/credential changes required for a shared Vercel service in ADR-002. No public multi-user deployment was created and no private local files were published.

Validation: **62 automated tests passed**, TypeScript validation and production build passed. New coverage checks four slots/DST, ratings, archive round trips, both explicit providers, retained partial feedback and source separation. At a 390 x 844 viewport, saved a fictional phone rating, selected phone-first sorting, queued a document review and opened its discussion in Practice. UI fixture has no worker, so these UI actions do not spend tokens or touch candidate records. Screenshots remain local in ignored `.runtime/`. Physical iPhone checks remain outstanding.

Confidence: high in the tested schedule/storage/queue paths, medium in cross-model content quality and live reliability based on one successful fictional run. Broader sources, structured lead-to-contact links, outreach drafting, pinned knowledge bundles, continuing Claude.ai web projects and multi-user hosted access remain follow-up work. Two-provider review is an explicit optional action; regular scheduled drafting still uses the configured single provider.
