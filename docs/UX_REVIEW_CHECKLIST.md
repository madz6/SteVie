# UX review checklist (CV Audit app)

Internal discipline for manual QA of the local app. No telemetry — run through this before a release or major UI change.

## Critical paths

1. **First visit** — Landing/upload screen loads; mode toggle works (Quality vs Full JD match).
2. **Upload** — CV required; JD paste area visible in both modes; optional JD file zone.
3. **Run** — Processing screen shows layer progress via SSE; no silent hang on failure.
4. **Results** — Scores, run context strip, Overview tab first; tabs switch correctly.
5. **Export** — Download JSON and Markdown produce files when `lastResult` exists.
6. **History** — List loads; clicking an entry restores results; **Compare** two audits calls `/api/diff` and shows deltas.

## Edge cases

| Case | Expected |
|------|----------|
| Missing CV | Inline error near run control (no blocking `alert`). |
| JD match without JD text/file | Inline error; POST should not proceed. |
| SSE / network failure | User returns to upload or sees error banner; button re-enabled. |
| Wrong host/port | Documented in README; browser shows fetch error. |
| Old history row (no `score_breakdown`) | Overview shows legacy message; totals still visible in header. |

## Accessibility spot checks

- Tab order: upload fields → Run → results tabs → export → history buttons.
- Tabs: `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls` / `aria-labelledby` on panels.
- File drop zones: keyboard **Enter** / **Space** activates file picker where implemented.
- Visually hidden labels on file inputs (`sr-only`) so screen readers get names.
- Contrast on score zone pills and severity chips in both light theme states.

## Content clarity

- **Quality audit** — Scores CV structure, bullets, competencies (100 pt quality). Optional JD paste does not run full Layer 5 JD scoring until mode is **Full JD match**.
- **Full JD match** — Adds JD relevance (100 pt) when JD text/file is provided.
- Tooltips / `title` on dense metrics (optional): align wording with this doc.

## Developer QA

- Append **`?debug=1`** to the app URL to log SSE timing and result `audit_id` in the console (no CV content).
