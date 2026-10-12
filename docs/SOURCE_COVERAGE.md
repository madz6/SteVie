# Discovery coverage and relationship-led opportunities

Status checked 12 October 2026. A supported adapter is not the same as an enabled source, and a saved search is not an automatic connector.

| Source | Actual behaviour |
|---|---|
| Monzo / Greenhouse | Enabled native scheduled feed |
| BearingPoint Ireland / Greenhouse | Enabled native scheduled feed |
| GoCardless / Greenhouse | Enabled native scheduled feed |
| Other Greenhouse employers | Supported; add a verified board in Scout |
| Lever / Lever EU employers | Supported adapter; no additional boards enabled by this update |
| LinkedIn jobs and people | User-controlled saved search links; no automatic collection |
| LinkedIn posts | New saved content-search links for hiring announcements and people-led signals; no scraping or automated ingestion |
| Jumpstart | Saved signed-in source handoff; no native feed or Quick Apply integration |
| Trackr | Saved source handoff; no API sync |
| General web search | Saved query handoff; no recurring whole-web search engine in the worker |
| Mailbox | Existing partial historical recovery; no live OAuth/sync in this release |
| VC portfolios, accelerators, company team pages, newsletters | Proposed expansion; not yet connected |

## Finding opportunities through people

Use Scout's People and LinkedIn posts searches to find a specific hiring signal, then retain the exact source URL, date, company, named public professional contact and reason it fits your preferences. Examples: a founder describing a new team, an employee saying their team is hiring, an alumnus offering referrals, or a small company's careers page. A funding announcement alone does not establish a vacancy. Check the company website before treating a social post as an open role.

Save a relevant person in People with a professional profile link, context and follow-up date. Save a genuine opportunity in Applications and link the person's name/source in Notes. The current product does not yet provide a structured many-to-many people/opportunity relation, automated contact enrichment or outreach generation queue. Do not guess email addresses or mark someone as a warm introduction without evidence.

For a cold approach, use a short specific opening tied to the source, one truthful sentence about relevant experience, and one low-effort question. Ask who owns hiring or whether the team expects relevant openings; do not imply a job exists. For alumni, lead with the real shared connection and ask for perspective before asking for a referral. For a founder, refer to the actual problem their team described. The user reviews and sends messages; this worker sends none.

## Next adapter work

1. Expand verified employer boards, especially smaller firms aligned with saved preferences. Do not infer company size from a job-board vendor.
2. Add imported post/newsletter signals with source/date/confidence and an explicit 'opportunity unconfirmed' stage.
3. Link each signal to contacts and opportunities, then generate evidence-backed outreach drafts and track replies/follow-ups.
4. Add authorised mailbox integration to reconcile application and networking replies.
5. Introduce supported search/data APIs only with clear source coverage, budget and provider configuration; never relabel search links as connected accounts.
