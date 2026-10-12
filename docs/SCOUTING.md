# SteVie background career scouting

SteVie's server owns the recurring schedule and persistent work queue. The previous Codex chat heartbeat is paused. Codex does not need to be open. Keep the laptop awake and SteVie running; this is not always-on cloud hosting.

## Everyday use

Open **Scout → SteVie background scout**. Automatic scouting is enabled on the existing installation at **09:00, 14:00 and 19:00 Europe/Dublin**. A fresh installation starts paused. Use **Edit coverage & times** to change times, initial title/location filters and enabled employers. Saved career preferences below the panel are also supplied to the AI assessment. The broad filters are separate from those full preferences; keep both aligned when changing target markets.

The initial enabled feeds are Monzo, BearingPoint Ireland and GoCardless. Greenhouse and Lever employer boards can be added by their careers-page links. These feeds are a limited discovery channel, not an internet-wide search. Jumpstart, Trackr, LinkedIn and live mailbox sync are not connected by this worker. It never submits applications or sends outreach.

The server fetches published jobs directly from fixed vendor API origins. Rules remove obvious income/senior roles, apply location/title filters and skip existing applications. Up to seven new candidates are sent to the configured AI for assessment against saved preferences and usable career evidence. Uncertain matches are held; only eligible matches queue four-document packs within the existing daily preparation cap. Current configuration uses signed-in Claude Code, with no provider fallback.

**Last run** reports source coverage, errors, counts and, for new assessments, reasons for inclusion/exclusion. Inspect **Applications → role → Documents** for completed drafts. Queued is not completed. Invalid or incomplete output fails the whole pack before saving; failed tasks remain visible for deliberate retry. Complete packs still require factual review.

The worker catches up only the latest due slot after sleep, does not replay every missed search, and never overlaps scout tasks. It limits scouting to six queued runs per UTC day. Assessed unchanged postings are skipped for seven days; changes to evidence, preferences or initial filters invalidate that cache. Existing applications are not regenerated. Feed failures are recorded; some failed feeds produce a partial run rather than pretending coverage was complete. Feed publication is evidence of listing availability, not a guarantee that an employer still accepts applications. Recheck the actual posting before applying. Deadline/employment-type extraction from native feeds is not yet structured.

## Windows background operation

Build the UI with `npm run build`, then run `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-background.ps1`. The helper starts a hidden production process and writes logs inside ignored `.runtime/`. It avoids starting a second instance when SteVie already owns port 4317. The existing laptop has a **SteVie Background** Windows Startup shortcut to this helper; a fresh clone does not install that shortcut automatically.

This starts at Windows sign-in, not before sign-in. There is no crash watchdog or sleep wake-up service. After an unexpected exit, run the helper again. Do not restart while a task is running. Back up private `data/` before moving machines. Workspace JSON exports include career preferences and saved content but exclude native schedule/configuration, run history, credentials and device registrations; reconfigure these on a new installation.

Phone access uses the private HTTPS address and Tailscale. Add the site to the iPhone Home Screen and enable notifications in Connections. A configured subscription and successful device test are required to verify delivery; running the scout does not by itself connect a phone.

## Optional researched imports

The following helper remains available for deliberate research outside the configured feeds. It is not the recurring scheduler.

## Context and preferences

Run `node scripts/scout-submit.mjs --context` from the workspace. This uses the local password without printing it, and returns preferences, current applications and task state. Preferences can be edited in Scout. They are included in workspace exports; the external schedule is deliberately not recreated by an import.

## Research batch

Write a UTF-8 JSON file inside ignored `data/` with this shape:

```json
{
  "checkedAt": "CURRENT_ISO_TIMESTAMP",
  "queries": ["Search query actually used"],
  "roles": [{
    "company": "Employer",
    "title": "Exact role title",
    "location": "Actual posting location",
    "url": "https://employer.example/jobs/posting",
    "description": "A sourced summary of responsibilities, requirements, working arrangements and relevant eligibility conditions, at least 80 characters.",
    "eligibility": "eligible",
    "eligibilityNotes": "What was verified against the saved candidate evidence; state any missing conditions.",
    "employmentType": "full_time",
    "deadline": "2026-10-19"
  }]
}
```

Use up to seven roles per run. Record a verified deadline as YYYY-MM-DD, or omit it when no exact deadline is published. Employment type is full_time, part_time, contract, internship or unknown. Eligibility is eligible, uncertain or ineligible. Do not interpret a missing sponsorship statement or absent graduation criterion as positive eligibility. Known gaps must remain visible. The timestamp must be within the last day. An empty roles array records an honest no-results search.

Run `node scripts/scout-submit.mjs data/scout-TIMESTAMP.json`. Exact source URLs are normalised for common tracking parameters; existing employer/title/location matches are also skipped conservatively. Income and ineligible roles are excluded. Uncertain roles or quota-held work are saved for review without automatic generation. The app drafts only from recorded candidate evidence and reviewed knowledge; generated documents remain drafts with flags for unsupported claims.

Check task status via --context. A queued task is not a finished CV. Packs appear in Applications → selected role → Documents. Existing records with missing job descriptions should be enriched deliberately; do not create duplicates simply to force generation.

No third-party submission or outreach is part of this automation. Native AI sign-ins enable generation but do not expose ChatGPT or Claude conversation history. Import chat text/exports through Knowledge separately.
