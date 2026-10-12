# ADR-001: Run career scouting and preparation inside SteVie

**Status:** Accepted
**Date:** 2026-10-12
**Deciders:** User direction to automate inside SteVie; implementation by Codex

## Context

The prior schedule woke a Codex conversation to search and submit roles. This made a chat session part of the operating system and obscured which work SteVie actually performed. The user wants low-friction scheduled discovery and prepared documents, using their signed-in Claude/Codex allowances for language work. The existing deployment is a single-user Windows server with SQLite, private Tailscale access and a persistent application queue.

## Decision

Use the existing server worker and SQLite queue for Dublin-time scheduling, fixed-origin employer-feed requests, rules, deduplication, state and notifications. Invoke the task's captured provider only for shortlist assessment and document generation. Keep the current Claude Code selection; never switch providers after failure. Pause the old chat heartbeat. Start the server independently of Codex, with a Windows sign-in shortcut.

Allow Greenhouse and Lever board identifiers, not arbitrary network destinations. Bound feed requests, candidate count, input size and daily work. Persist slot claims and source diagnostics. Catch up the latest missed slot only. Exclude known income/ineligible roles; hold unclear eligibility. Return four complete drafts atomically and reject missing/unknown evidence references. Generated content always remains subject to review.

## Options considered

| Option | Complexity | Cost | Scale | Operational fit |
|---|---|---|---|---|
| Continue the Codex chat heartbeat | Low implementation, manual operational dependency | Chat allowance on recurring research | Broad web discovery but session-dependent | Already familiar; does not meet ownership requirement |
| Native worker with official employer feeds (chosen) | Moderate, reuses SQLite and worker | No paid search API; bounded subscription LLM calls | One local user; limited configured boards | Fits current stack, observable in SteVie |
| Hosted worker with search APIs and browser automation | High, needs deployment, credentials and source-specific adapters | Hosting/search/possibly metered model charges | Potential always-on broad coverage | Additional infrastructure and auth maintenance |

The chat approach offers broad browsing but leaves the user dependent on an assistant session. Native feeds give deterministic, inspectable discovery without LLM calls for each posting. Hosted discovery would improve uptime and coverage but cannot reuse an interactive desktop session by assumption.

## Trade-offs and consequences

- Coverage initially includes only three employer boards. This is useful automation infrastructure, not complete market coverage. No supported Jumpstart/Trackr/mail adapter has been added.
- Rules narrow the feed before the LLM sees it. Separate title/location terms may miss relevant roles; saved preferences do not automatically rewrite those filters.
- Feed presence is not definitive proof that an application remains open. The model sees full supplied description and timestamp, but does not browse application flows. Native deadline/type extraction remains unimplemented.
- Single-process queue serialises scouting and generation. Long model calls can delay a due search; persistent claims prevent overlapping work but do not provide distributed exactly-once execution.
- Seen-posting fingerprints expire after seven days. Preference/evidence changes trigger reassessment, but existing jobs remain deduplicated and do not receive automatic replacement packs.
- A full four-document pack is saved or none is. Length/placeholder/reference checks detect structural failures, not all semantic errors. Unknown references are rejected even when other content looks plausible.
- Original incomplete historical documents are retained with blocking flags. They are not deleted or silently rewritten. This correction can change a misleading completed task to failed.
- Windows startup needs sign-in and an awake laptop; it is neither a crash watchdog nor always-on hosting. Subscription limits remain a real failure mode. No automatic provider fallback or unlimited retries.
- Native schedule/run metadata is deliberately outside the current portable archive. A new machine requires reconfiguration. Candidate content stays in ignored private data.
- Phone push depends on a registered device. A completed task is independent of notification delivery.

## Validation and confidence

Live scheduled execution observed at 19:00 Dublin on 10 October, all three slots on 11 October, and 09:00/14:00 on 12 October. Latest run checked 112 postings; no new matches were imported. Initial live shortlist assessment used Claude and excluded four roles. These observations prove native scheduling and feed reads, not universal role coverage or successful new packs on every run.

Automated tests cover DST/latest-slot claims, overlap avoidance, feed bounds and links, partial failures, duplicate suppression, captured provider, invalid packs and historical quarantine. Phone-width browser checks used fictional isolated data; physical iPhone delivery is still unverified. See BUILD_LOG for final test results and the AIB replacement outcome.

## Action items

1. [x] Implement server scheduling, fixed-origin feeds, persisted history and source diagnostics.
2. [x] Add mobile-accessible coverage controls and retain saved full career preferences.
3. [x] Pause chat heartbeat and install independent Windows sign-in startup on this laptop.
4. [x] Add complete-pack/reference gates and preserve quarantined history.
5. [ ] Expand discovery through verified employer boards and supported source adapters.
6. [ ] Add structured deadlines, stronger location matching and explicit application-open checks.
7. [ ] Revisit scheduler portability, crash recovery/watchdog and always-on deployment.
8. [ ] Verify actual iPhone push delivery after device subscription.

## References

- [Greenhouse Job Board API](https://docs.greenhouse.io/job-board.html)
- [Lever Postings API](https://github.com/lever/postings-api/blob/master/README.md)
- [Operating runbook](SCOUTING.md)
