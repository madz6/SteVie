# SteVie Job OS

SteVie is a private job-search workspace for applications, evidence, preparation, practice, networking, scouting and learning. It keeps candidate facts in a source-backed evidence store and asks a signed-in provider to produce drafts only from that evidence. Its knowledge base accepts pasted source material and links for previous chats, case packs and repositories; its Scout area creates source-aware role and people-search handoffs.

## Run locally

```powershell
npm install
# Copy .env.example to .env and add your personal contact fields locally.
npm run dev
```

Open `http://127.0.0.1:4317`. The local app does not require a password. It binds to loopback by default so the workspace is not exposed to the network accidentally.

Keep `.env` private. The public repository intentionally contains no phone number, email address or LinkedIn URL; those values are read from the local settings documented in `.env.example` when documents are drafted.

The production build is served with:

```powershell
npm run build
npm start
```

## AI connections

SteVie can use the signed-in native clients directly:

- **Codex / ChatGPT plan**: the Codex CLI must be installed and signed in with `codex login`.
- **Claude Code / Claude plan**: the official Claude Code CLI must be installed and signed in with `claude auth login`.
- **OpenAI API** and **Anthropic API**: optional, separately billed API connections. Set their keys in the server environment if you choose them.

The app never silently falls back to a local model or from a subscription connection to metered API usage. If a provider is unavailable, its task stays reviewable and can be retried after the connection is fixed.

## Current rebuild slice

The local workspace now includes a Mission Control view, targeted Gmail evidence recovery, bulk Knowledge imports, source-grounded case practice and versioned workspace import/export. The mailbox snapshot is intentionally partial: it covers the declared application/interview/assessment search and records its dates, query and message count in the workspace. Review recovered roles before treating an old message as a current application status.

Knowledge imports support text, Markdown, ChatGPT mapping exports, Claude `chat_messages` exports, PDF and DOCX selectable text. Mark a source reviewed before it can be retrieved into preparation or case practice. Scanned PDFs produce a warning and need OCR or pasted text. Link-only records remain links and are never presented as readable source text.

Use **Import & export** to download a versioned JSON workspace archive or applications CSV. The archive excludes provider credentials, API keys, mailbox access and device push subscriptions. Import previews conflicts and restores additively; queued work is left for an explicit retry.

Use **Today** for the daily action queue, **Inbox recovery** for ambiguous historical evidence, **Knowledge** for case packs and prior-chat exports, and **Practice** for staged Clarify → Structure → Calculate → Recommend drills. Jumpstart, LinkedIn and Trackr currently open user-reviewed source handoffs; they are not claimed as automated scraping or submission integrations.

On Windows, if `claude` is not recognised, run this once from the project folder:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-claude.ps1
```

The script adds the project-local official client to your user PATH and starts its normal sign-in flow. Open a new PowerShell window afterwards if you want to type `claude` directly.

In this workspace, `npm run claude:login` also starts the bundled official client's sign-in without changing PATH. The account owner must complete that sign-in.

## Remote access and iPhone notifications

For private iPhone testing, install Tailscale on both devices and sign into the same account, then run `npm run phone:setup` on the laptop. Follow [the phone testing guide](docs/PHONE_TESTING.md). The helper prepares local settings; Tailscale Serve must then be enabled and the laptop must stay awake with SteVie running.

For a deployed site, set `STEVIE_PUBLIC_URL` to the HTTPS origin and `STEVIE_PASSWORD` to a password of at least 16 characters. The server refuses remote access without both settings. Push keys are generated once in private `data/push-keys.json`; keep this file persistent. Set `STEVIE_PUSH_CONTACT` to a contact URL or `mailto:` address if needed.

On iPhone, open the HTTPS site in Safari, use **Share → Add to Home Screen**, open the new icon, then enable notifications in Connections. Safari web push requires the Home Screen web app context.

## Application safety

Imported roles are marked for review. A preparation task creates a CV, cover letter, answers and brief as drafts; it never submits an application. Generated factual claims require evidence markers and unresolved or unsupported claims are surfaced for review. Jumpstart is stored as a saved source link until its supported application flow has been verified in the signed-in session.
