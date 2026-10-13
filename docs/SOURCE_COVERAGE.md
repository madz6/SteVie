# Discovery coverage and relationship-led opportunities

Status checked 13 October 2026. A supported adapter is not the same as an enabled source, and a saved search is not an automatic connector.

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

Save a relevant person in People with a professional profile link, context and follow-up date. Add one or more hiring signals, each with an exact source URL, observed date, summary and unconfirmed/confirmed/closed status. Confirmation is your own assessment, not an automated check. Link existing Applications using the role picker; a person can link to several roles, and several people can link to the same role. Opening a linked role navigates to its actual record.

Choose Prepare an approach, then select the drafting provider. SteVie queues a short outreach draft from the signals, linked roles, notes, profile and usable career evidence. It excludes unresolved evidence and evidence categories labelled contact/personal. It sends no message and does not fetch saved URLs. Review the checks and evidence, edit the subject/message, then copy or download plain text. Mark reviewed removes that draft from the outstanding review count; changing supporting contact context, referenced evidence or relevant linked-role details makes it stale. Save a conversation status and follow-up date yourself after contacting someone.

The queue uses the chosen provider without fallback, prevents concurrent duplicates for a contact, and counts failed attempts against its separate daily outreach budget (same configured numerical limit as preparation). Up to 20 drafts are retained per contact, with explicit removal. Workspace JSON includes signals, links, drafts and tasks; pending imported tasks remain stopped until explicit retry. Do not guess email addresses or mark someone as a warm introduction without evidence.

For a cold approach, use a short specific opening tied to the source, one truthful sentence about relevant experience, and one low-effort question. Ask who owns hiring or whether the team expects relevant openings; do not imply a job exists. For alumni, lead with the real shared connection and ask for perspective before asking for a referral. For a founder, refer to the actual problem their team described. The user reviews and sends messages; this worker sends none.

## Next adapter work

1. Expand verified employer boards, especially smaller firms aligned with saved preferences. Do not infer company size from a job-board vendor.
2. Add bulk post/newsletter ingestion and standalone company signals; current signals are manually saved under a person.
3. Add automatic professional contact discovery/enrichment and reply reconciliation; current relationships, statuses and follow-ups are user maintained.
4. Add authorised mailbox integration to reconcile application and networking replies.
5. Introduce supported search/data APIs only with clear source coverage, budget and provider configuration; never relabel search links as connected accounts.
