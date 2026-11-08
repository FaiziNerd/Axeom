# Deploy in 2 minutes (free, no login for viewers)

The dashboard is 100% static files (`app/`) — nothing to build, no npm, no keys.

## Netlify Drop (easiest)

1. Open https://app.netlify.com/drop (log in or create a free account — only YOU need an account; viewers/owner never do).
2. Drag the `app` folder (or `axeom-dashboard.zip`) onto the page.
3. Netlify gives a random URL like `https://sparkling-luminescence-1a2.netlify.app` — that's your live link. In Site configuration → Site details you can rename it to something harder to guess (the honest data is fake, but keep it obscure anyway), e.g. `axeom-os-9941.netlify.app`.
4. Open the link **on a phone in a private/incognito browser window** before sending (brief requirement).

## What to test on the phone (30 seconds)

- Today tab: 3 money KPIs ($11,650 / $900 / $2,700), complaint-trend bar, first cards.
- Clients tab: search "Delgado", open the sheet.
- Money tab: overdue table + tool-wrong cards.
- **New files tab: pick any one pack file (e.g. payments.csv) and re-upload it**; "Updated" + recalculated totals must appear. Then try a random non-CSV file: it must be skipped with a warning.

## Local test (no deploy)

- Double-click `app/index.html` — it works from `file://` too (data is embedded).
- Or: `python -m http.server 8000` inside `app/` → http://localhost:8000.

## After deploying

Put the live URL into `answers.json` (`live_link`), record the Loom video, paste `video_link` into `answers.json`, add your name/email, and round up the submission folder per the brief.
