# Daily log

*(Times approximate — the honest part is the what/why, not the clock.)*

## Day 1 (Thu, Nov 5)

- 10:00 to 13:00. What I did: read all 8 data files twice end to end before deciding anything; listed every name-spelling variant I could find (Malik ×5 spellings, Fischer ×4 businesses, two Oak Cliffs, three Delgados cross-referenced by email); chose the stack: **static files, zero dependencies**, engine in one JS file that runs in browser AND Node, because "free, live, no login, works on a phone" + "judges will upload unseen files" points hard at a single pure-function engine I can test without a browser.
- What I changed my mind about, and why: started planning to hand-color a spreadsheet "dashboard" for speed; dropped it the moment I realized the unseen-file requirement makes every answer disposable — the value is the *pipeline* (parse → reconcile → score), and a paste-up would break the first time a judge uploads a file.
- What went wrong, and how I fixed it: misread payments.csv as month-first like bookings; the first reconciliation had payments landing *before invoices existed*. Fixed by tracing P5046 vs INV-1051 and re-reading all 128 payment dates.
- Where the AI was wrong, and how I caught it: my agent's first plan assumed one date format everywhere; I made it prove each format from cross-file constraints instead of guessing (see assumptions.md #1).

## Day 2 (Fri, Nov 6)

- 10:00 to 13:00. What I did: wrote the identity-resolution rules and the money engine; two-pass payment allocation; hand-derived the truth table separately before running the engine (client count 30, overdue $11,650 / 9 invoices, we-owe $900, never-billed $2,700, 8 tool-wrong invoices ×2 later findings).
- What I changed my mind about, and why: my first test-writer claimed overdue $12,550 — I then found I had *double-counted* INV-1051 in the test truth (P5046 already clears it) and had my message count off by one (the file really has 202 message lines). Corrected the **test**, not the engine — the engine was right and the hand-answer was wrong. Good sign that the engine and the test are two independent paths.
- What went wrong, and how I fixed it: the first engine draft let the **void duplicate INV-1160** enter the overdue total and created a fake "we owe" at the wrong level. Fixed by treating voids as tool-error rows only, and moving duplicate-payment detection to payment level (Vista P5092) instead of invoice level.
- Where the AI was wrong, and how I caught it: the AI's first pass marked Malik Law's August retainer $250 *underbilled* as "they owe us $250"; the files actually show the invoice is *paid in full at $2,250* — the error is that the studio **invoiced too little**, not that money is missing. I caught it by checking P5089's amount against INV-1091 before letting the claim into answers.json.

## Day 3 (Sat, Nov 7)

- 10:00 to 13:00. What I did: built the dashboard (4 tabs: Today / Clients / Money / New files), phone-first layout, suggest-only action cards with local memory, complaint-trend chart bar by month, client sheets linking bookings+invoices+production rows+messages, and the upload flow with header-sniffing schema detection + old→new totals.
- What I changed my mind about, and why: included 3 hot-lead cards for L091/L076/L100 only, after first trying to list all 14 unanswered leads on the Today screen — decision: the Today tab owns the 10-second test; the full list lives in answers.json and the Clients/Money tabs.
- What went wrong, and how I fixed it: the dashboard rendered a blank HUD in my browser test — `data.js` keyed datasets as `"bookings.csv"` while the engine reads `bookings`. The key mismatch was invisible in the pure-engine tests (they fed their own keys). I added schema-key normalization in the UI and a fake-DOM smoke test (`tools/smoke.js`, 22 checks) that renders every tab, opens a client sheet, approves an action, and uploads a real modified payments file — asserting overdue drops 11,650 → 10,150 live. Also caught via smoke: a missing `setView()` helper would have crashed the app on first paint.
- Where the AI was wrong, and how I caught it: the AI asserted "Delgado Insurance has 3 escalations" from a regex count; the actual file shows **2** ("Not happy" on 9/11 + the 6/28 repeat — the 6/13 "music too loud" is a first ask, not a repeat). One count, one check via messages.txt: fixed.

## Day 4 (Sun, Nov 8)

- 10:00 to 13:00. What I did: filled `answers.json` from the engine; published the phone page on GitHub Pages; corrected the client count to 29 after Fieldhouse was kept as a payer only; dropped INV-1153 as a double bill once B154 and B155 showed two real 29 Sep shoots; scored channels by cash collected minus studio and editor cost, which made LinkedIn the profit winner.
- What I changed my mind about, and why: an earlier count of 30 clients treated Fieldhouse Marketing as a client. Ivy's 10 Jun email says Fieldhouse pays for Rosewood and Copperline, so Fieldhouse is not one of the 29. The Monday list was also rewritten so it matches the three cards on the phone: call Delgado, refund Vista $900, chase INV-1094.
- What went wrong, and how I fixed it: TypeSafe has no free Jev key. A local rule list scored the same 51 lines, but those rules were tuned on this file, so that score is not a Jev result and is not the number in the writeup. The measured stand-in is Groq's free plan, model openai/gpt-oss-20b, in `tools/classify_free.js`: 47 of 51 categories and 49 of 51 frustration marks on the same 51 labels. That number is not a Jev score. `tools/jev.js` stays ready if a TypeSafe key appears.
- Where the AI was wrong, and how I caught it: see ai_log.md. The first identity pass invented extra clients such as "Dana Kim DDS" by creating a client from a video name before the booking was checked. Counting the client list against the bookings caught it, and the count went back to 29.
