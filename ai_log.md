# ai_log.md — how AI was used, what it got wrong

## Tools

| Tool | Used for |
| --- | --- |
| GLM (via the OpenCode agent harness) — Claude/Anthropic-style coding agent | The whole build ran pair-programming style: I (the human) set the questions and the truths; the agent wrote engine/UI/tests/docs, and iterated on my corrections. |
| Agent's own terminal (Node) | Test harnesses `tools/test.js`, `tools/smoke.js`; report snapshot; `answers.json` generation. |
| Python (pypdf) | Extracted the two brief PDFs (CJK-ligature PDF text didn't copy-paste cleanly). |
| Jev (TypeSafe) | `tools/jev.js` is ready for Choice and Noul on 51 hand-labeled messages. It does not run: TypeSafe publishes no free key. | 
| Groq free plan | `tools/classify_free.js` sends those same 51 messages to `openai/gpt-oss-20b`. Result: 47/51 categories, 49/51 frustration. This is the measured stand-in. It is not Jev. The key is not stored in the repo. |

## Key prompts / how I drove it

1. "Read all files in D:\\Internship first, then make plan.md: what each file says, what the 6 questions need, what to build, how to deploy, and edge cases (date formats, name collisions, void invoices)." — the plan-first prompt. Everything after this was heavily corrected, not delegated.
2. Truth-before-code: "Hand-derive the money answers from the raw CSVs *first*, then write the engine. The test and the engine must be two separate derivations." (This caught the agent's own code and my own numbers, twice.)
3. "Write the UI as 4 tabs, suggest-only actions persisted locally, and an upload flow the judges will attack with unseen files — plus a fake-DOM smoke test in Node that renders every tab and uploads a modified payments.csv."
4. "Fill answers.json from the engine but hand-curated: quote client sentences verbatim, every date must exist in the files."

## Where the AI was wrong — and how I caught it

0. **A rule score was treated as the Jev result.** An earlier draft said the local rules were 51/51 and could stand in for Jev. Those rules were written against this same inbox, so the score cannot be published as a model measurement. **Catch:** the writeup and the rule file describe the same phrases. **Fix:** the published measurement is the Groq run, labeled as Groq.
1. **The dashboard was blank by design.** The agent generated `data.js` with dataset keys like `"bookings.csv"` while the engine reads `bookings`; the pure-engine tests passed because they fed their own extension-less keys. The UI believed the data existed and rendered an empty shell. **Catch:** a fake-DOM smoke test asserting rendered content (`owed to us` KPI text, client rows, "$11,650" total) — 0 rows found. **Fix:** key normalization at the UI boundary + regenerating data.js + asserts added permanently to smoke.js. A later identity pass also invented extra clients from video names; the client list is 29, with Fieldhouse as a payer only.
2. **A missing function would have crashed the app on first paint.** The agent called `setView()` four times and never defined it, while a parallel rendering path (`$view.innerHTML = ...`) made some pages work "by accident". **Catch:** same smoke test — the Today tab rendered but the Clients tab's `setView` call threw. **Fix:** defined it once and removed the parallel path.
3. **Wrong "truth" numbers in the test harness.** The agent asserted overdue = $12,550; my own hand-count said $11,650. Found I was double-counting INV-1051 (P5046 already pays it) inside the *test*. So the AI "wrongness" here was mutual: the agent's engine was right, its test-writing violated my own derivation rules and I had to correct *my* number after re-deriving from payments.csv. This is recorded because it's exactly the failure mode an interviewer should fear: an LLM can sound confident while inventing "truth" numbers — both sides need separate derivations.
4. **Escalation count off-by-one and misattributed cause.** The agent classified "music is too loud, I can't hear myself" (6/13) as a *repeat* complaint for Delgado, giving 3 escalations; messages.txt shows it's a first ask, and "Not happy" (9/11) is the second escalation — Delgado has **2**. **Catch:** re-reading the 8 Delgado messages end to end.
5. **Invented a discount.** An earlier agent summary claimed Bold & Brave's studio price had dropped to "$225 from June". Measured: all 20 B&B invoices in every month are $300.00. **Catch:** pulled every invoice row for the client and read amounts column. Recorded here as the concrete example of the rule: never let a summary claim survive — only rows do.
