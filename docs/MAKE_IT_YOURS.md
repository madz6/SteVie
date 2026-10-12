# Make your own SteVie

SteVie currently supports one private workspace per installation. A fresh GitHub checkout starts with no candidate profile, career evidence, historical applications, chats or signed-in providers. Do not copy somebody else's `data/`, `.env`, `.runtime` or workspace archive.

## Personal installation

1. Install Node.js 24 or later and Git. Fork this repository, then clone your own fork.
2. In its folder run `npm install`, `npm run build`, then `npm start`.
3. Open `http://127.0.0.1:4317`. Local loopback mode needs no password. For remote access follow PHONE_TESTING.md and configure the required HTTPS origin and password first.
4. Add your profile and facts in My evidence. Import your own CVs, case material and chat exports through Knowledge. Sources start unreviewed; only mark material reviewed after checking it. A model suggestion inside an old chat is not proof of a personal achievement.
5. Install the official Codex CLI and/or Claude Code client; sign in with your own account. Run the connection test in Connections. Optional API providers are separately billed; keep keys in `.env`, never the browser or repository. The project-local client on the original developer's laptop is not shipped with the repository.
6. Choose your default drafting provider. Practice separately offers Codex, Claude or a two-provider review. A two-provider round shares its input and first critique with those two providers and uses both allowances.
7. Save your own career preferences in Scout. Edit title/location filters and employer feeds as well. Default filters are examples, not inferred personal preferences. Enable the schedule only after reviewing coverage. The current default times are 06:30, 12:30, 16:30 and 19:00 Europe/Dublin; other time zones are not yet configurable.
8. Use Import & export for a portable content archive. Schedule/feed state, credentials and device subscriptions require separate setup on a replacement installation. Back up your private data directory securely.

On Windows, `scripts/start-background.ps1` starts a hidden server. Adding a shortcut to Windows Startup is a per-machine step; a fresh clone does not silently install one. The computer must remain awake. No external applications or outreach are sent automatically.

## Using a particular Claude chat or project

This adapter creates independent text-only native-client requests. It does not select or read a Claude.ai chat/project URL. Import the conversation export or paste its useful content into Knowledge, include the project's instructions and documents as separate sources, and mark the intended sources reviewed. Retrieval currently selects relevant reviewed excerpts; there is no guaranteed pinned per-project bundle selector yet. Add facts explicitly to My evidence before asking a draft to claim them.

Claude Code's documented session resume option refers to Claude Code sessions. It should not be treated as an adapter for arbitrary Claude.ai web chats. Resuming sessions in this implementation would also require an explicit change to its current no-session-persistence design. Do not copy session cookies or OAuth tokens from the browser.

## Sharing with other people and Vercel

**Supported now:** separate personal installs, each with its own data and provider connections. One installation's password is a workspace password, not a multi-user account system. Anyone sharing that password shares the same data.

**Not shipped:** a public multi-user Vercel service. Do not deploy this SQLite/long-running worker directly as if it were a stateless Vercel function. Vercel can host the web interface, but this architecture needs durable database/storage and scheduled durable workers elsewhere or through compatible hosted services. Subscription CLI authentication on a laptop is not automatically available to Vercel.

A shared service requires user authentication, tenant-scoped database rows/object storage, owner checks on every job/document/task, encrypted per-user connection storage, deletion/export controls, per-user quotas and durable job execution. Model access should use each user's authorised API credentials or a separately designed paired local worker. Never run other users' jobs under the original owner's subscription or credentials. Build and test these boundaries before accepting real public sign-ups.

See [ADR-002](ADR-002-review-and-sharing.md) for the proposed deployment boundary and [SOURCE_COVERAGE.md](SOURCE_COVERAGE.md) for what actually discovers leads today.
