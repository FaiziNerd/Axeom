# ai_log.md — how AI was used, what it got wrong

## Tools

| Tool | Used for |
| --- | --- |
| GLM (via the OpenCode agent harness) — Claude/Anthropic-style coding agent | The whole build ran pair-programming style: I (the human) set the questions and the truths; the agent wrote engine/UI/tests/docs, and iterated on my corrections. |
| Agent's own terminal (Node) | Test harnesses `tools/test.js`, `tools/smoke.js`; report snapshot; `answers.json` generation. |
| Python (pypdf) | Extracted the two brief PDFs (CJK-ligature PDF text didn't copy-paste cleanly). |
| Jev (TypeSafe) | Message classification harness (`tools/jev.js`) — docs studied, 51-message labeled ground truth, Choice/Noul integration ready; runs the moment `TYPESAFE_API_KEY` exists. See writeup **Jev job** for why it wasn't the shipped measurement (no key in the window) and how the shipped rule classifier was measured instead. |

## Key prompts / how I drove it

1. "Read all files in D:\\Internship first, then make plan.md: what each file says, what the 6 questions need, what to build, how to deploy, and edge cases (date formats, name collisions, void invoices)." — the plan-first prompt. Everything after this was heavily corrected, not delegated.
2. Truth-before-code: "Hand-derive the money answers from the raw CSVs *first*, then write the engine. The test and the engine must be two separate derivations." (This caught the agent's own code and my own numbers, twice.)
3. "Write the UI as 4 tabs, suggest-only actions persisted locally, and an upload flow the judges will attack with unseen files — plus a fake-DOM smoke test in Node that renders every tab and uploads a modified payments.csv."
4. "Fill answers.json from the engine but hand-curated: quote client sentences verbatim, every date must exist in the files."

## Where the AI was wrong — and how I caught it

0. **The final-measurement miss (Day 4).** The rule classifier's first measured run had 6 identical category misses: my request-vocabulary regex didn't include the studio's actual phrase "take out the part… where I talk about prices". The miss list (`tools/measure_rules.js`) surfaced all 6 instantly and they fixed the vocabulary before the number was published.
1. **The dashboard was blank by design.** The agent generated `data.js` with dataset keys like `"bookings.csv"` while the engine reads `bookings`; the pure-engine tests passed because they fed their own extension-less keys. The UI believed the data existed and rendered an empty shell. **Catch:** a fake-DOM smoke test asserting rendered content (`owed to us` KPI text, 30 client rows, "$11,650" total) — 0 rows found. **Fix:** key normalization at the UI boundary + regenerating data.js + asserts added permanently to smoke.js. Lesson: any cross-file contract (here: dataset keys) needs a boundary test, not just unit tests of each side.
2. **A missing function would have crashed the app on first paint.** The agent called `setView()` four times and never defined it, while a parallel rendering path (`$view.innerHTML = ...`) made some pages work "by accident". **Catch:** same smoke test — the Today tab rendered but the Clients tab's `setView` call threw. **Fix:** defined it once and removed the parallel path.
3. **Wrong "truth" numbers in the test harness.** The agent asserted overdue = $12,550; my own hand-count said $11,650. Found I was double-counting INV-1051 (P5046 already pays it) inside the *test*. So the AI "wrongness" here was mutual: the agent's engine was right, its test-writing violated my own derivation rules and I had to correct *my* number after re-deriving from payments.csv. This is recorded because it's exactly the failure mode an interviewer should fear: an LLM can sound confident while inventing "truth" numbers — both sides need separate derivations.
4. **Escalation count off-by-one and misattributed cause.** The agent classified "music is too loud, I can't hear myself" (6/13) as a *repeat* complaint for Delgado, giving 3 escalations; messages.txt shows it's a first ask, and "Not happy" (9/11) is the second escalation — Delgado has **2**. **Catch:** re-reading the 8 Delgado messages end to end.
5. **Invented a discount.** An earlier agent summary claimed Bold & Brave's studio price had dropped to "$225 from June". Measured: all 20 B&B invoices in every month are $300.00. **Catch:** pulled every invoice row for the client and read amounts column. Recorded here as the concrete example of the rule: never let a summary claim survive — only rows do.
