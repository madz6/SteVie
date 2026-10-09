# Scheduled career scouting

The recurring Codex chat searches at 09:00, 14:00 and 19:00 Europe/Dublin. It uses web access to research current postings. SteVie itself does not run an embedded web crawler. Keep the laptop awake, Codex open and SteVie running. A run can be delayed by offline state or provider allowance; inspect the last-run record instead of assuming execution.

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
