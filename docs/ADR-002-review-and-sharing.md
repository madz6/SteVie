# ADR-002: Bounded model review and private workspace ownership

**Status:** Accepted for local review; hosted multi-user architecture proposed
**Date:** 2026-10-12
**Deciders:** User requested joint document/interview review and reusable personal installations

## Context

The user wants phone-friendly application sessions, interview coaching from Codex, Claude collaboration, richer lead discovery and a version others can use with their own accounts. Current persistence and authentication belong to one local user. A Claude Code subscription connection is distinct from a Claude.ai project knowledge store.

## Decision

Ship a bounded, opt-in two-provider review. Codex produces the first opinion; Claude independently checks the original answer/document and challenges the first critique. Save the first opinion before calling the second provider. Failure of either remains visible; do not switch providers or manufacture consensus. Each subsequent revision starts a new explicit round. Document review does not rewrite or approve a document automatically.

Keep candidate facts in the evidence store and reviewed external context in Knowledge. Imported chats can inform context, but assistant-generated claims do not become candidate facts automatically. Leave pinned context bundles and continuing external web chats as explicit follow-up work.

Persist phone usability as a user-observed rating plus explanation. Unknown application flows stay unknown; do not infer easy application from the posting page or employer brand. Sort phone-friendly first, unchecked next and laptop-rated last.

Continue separate personal installations now. Design public hosting around tenant ownership before accepting other users' data. The original single workspace password cannot provide tenant isolation.

## Options considered

| Option | Complexity / cost | Advantages | Disadvantages |
|---|---|---|---|
| Unbounded multi-agent group chat | High, unpredictable model spend | Rich iterative debate | Hard to audit termination, factual drift and failure |
| Bounded draft/critique rounds (chosen) | Two model calls per opted-in review | Attributed disagreements, predictable boundaries, partial results retained | Manual revision and another round; no automatic consensus |
| Resume arbitrary Claude web project | Unsupported by this adapter | Familiar user context if a supported bridge is built | A web URL is not a Code session; unclear context ownership |
| Separate personal clones (chosen now) | Existing local architecture | Independent credentials and SQLite data | Each user installs and runs their own worker |
| Public Vercel frontend + durable backend/workers | Substantial new auth/data/operations work | Shared online onboarding and possible always-on operation | Requires tenant isolation, connection lifecycle and per-user budgets |

## Consequences and limitations

- The UI makes both destinations explicit before a joint review. Each account must be signed in locally. Provider errors stop the round; prior work is preserved.
- Scores remain provider-specific assessments, not a consensus or hiring probability. A polished critique can still be wrong.
- Document review stores the original document text in a practice record. Other retrieved facts/context are current at review time, not a full immutable source snapshot. Broader provenance snapshots are follow-up work.
- Source discovery remains three enabled employer boards; LinkedIn post searches are handoffs. Leads and cold outreach require the subsequent signal/contact workflow.
- Current archives support ratings and review-provider selection. Old application versions that do not recognise the new optional fields should be upgraded before importing.
- Vercel Functions cannot make the existing local SQLite store and in-process schedule durable simply by deploying the code. Use durable data services and a job runner; subscription clients require a designed per-user local bridge or use configured APIs instead.

## Action items

1. [x] Four commute-oriented daily slots and persisted mobile ratings.
2. [x] Opt-in Codex/Claude practice and document critique, with partial-result retention.
3. [x] LinkedIn post search handoff and explicit source inventory.
4. [x] Fresh-install instructions and documented single-user boundary.
5. [ ] Pinned reviewed context bundles and richer conversation UI.
6. [ ] Signal-to-person-to-opportunity links and outreach drafting queue.
7. [ ] Public-service authentication, tenant database/storage isolation, durable worker and credential lifecycle.
8. [ ] Deployment and cross-tenant security testing before public trial.

## References

- [Claude Code CLI and session resume](https://code.claude.com/docs/en/cli-reference)
- [Vercel runtimes and filesystem](https://vercel.com/docs/functions/runtimes)
- [Vercel scheduled functions](https://vercel.com/docs/cron-jobs)
