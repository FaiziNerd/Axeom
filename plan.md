# Plan.md — Axeom Challenge (Pack 205)

## 1. What the files are saying (data dictionary)

| File | What it is | Size | Key quirks / traps |
|---|---|---|---|
| `Axeom Challenge.pdf` | The brief: 72h challenge. 3 parts: (1) analyze data & fill answers.json, (2) build a live tool that connects the data & accepts new files, (3) learn Jev (docs.typesafe.ai) for one job. Scored on truth (40), working system (25), thinking (20), learning speed (15). | — | Nobody finishes everything. Prioritize. No interviews done — answers.json IS the answer sheet. Data "today" = **2026-10-06**. |
| `Axeom Challenge - What to send.pdf` | Scoring clarifications. Daily-log template, ai_log.md requirements (must show AI being wrong at least once), submission = zip/folder before deadline. Private-browser link test before sending. | — | Strongly recommend ai_log.md. Check every link in incognito. |
| `PACK.txt` | "Your pack number is 205. Put it in answers.json as pack_id." | 2 lines | answers.json currently has placeholder text — first fix is quite literally filling `pack_id: "205".` |
| `answers.json` | **The answer template** — every field we can possibly be scored on: `pack_id`, `your_name/email`, `live_link/video_link/code_or_files_link`, `client_count` + `clients[]` (with `other_names_used_in_the_data`), `payers_who_are_not_clients`, `overdue[]` + `overdue_total`, `we_owe[]`, `never_billed[]` + total, `billing_tool_is_wrong[]`, `lost_requests[]` + `lost_requests_root_causes` + `lost_requests_started_getting_worse_in`, `never_replied_leads[]`, `most_likely_to_leave`, `best_marketing_channel`, `what_this_data_cannot_tell_us`, `monday_top_3`. | 51 lines | Leave a field empty rather than guess. Template hints how each answer is graded against "what's really in the data". |
| `data/bookings.csv` | 173 shoots (Apr 1–Oct 19), `booking_id,date,client_name,email,service,status,price`. Services: Podcast Studio 2hr ($300), 4hr ($550), Content Day ($1,500), Reels Pack ($900), Retainer Shoot ($0). Status: mostly `completed`, 1 `cancelled` (B146), several `upcoming` after Oct 6. | 175 lines | Names wildly misspelled (`Bold & Brave` / `Bold and Brave` / `B&B Podcast` / `Megan Ramirez`); dates are **MM/DD/YYYY**; some emails have typos (`ivy@fischerdental.con`); Brightwater prices $300 → $225 from June (25% community discount promised in messages.txt). |
| `data/invoices.csv` | 159 invoices INV-1001..INV-1160 from "the billing tool": `invoice_no,bill_to,email,issued,due,amount,status,memo`. | 161 lines | Dates ISO. Statuses: paid / unpaid / partial / void (INV-1160 is a void duplicate of INV-1043 — classic billing-tool mistake). Several memos link invoices to bookings (B###), most don't. |
| `data/payments.csv` | 128 payments P5001..P5129: `payment_id,date,payer,payer_email,amount,method,reference`. | 129 lines | **Dates are DD/DD/YYYY** here — inconsistent with invoices! strangers to map by reference OR amount+email. Ted twist: emails sometimes blank, reference blank, payers shoften later, payer names in CAPS. |
| `data/leads.csv` | 100 leads L001..L101 (Mar 24–Oct 1): `lead_id,created,name,business,email,phone,source,first_reply,status`. Statuses: Won / Lost / Talking / New. Sources: Meta ad, Website form, Instagram, LinkedIn, Google, Referral. | 102 lines | Many `New` leads have empty `first_reply` = never replied. 4 spam/bot rows (L010 crypto, L017 "asdf" a@a.co, L059 seo, L095 free followers) must be flagged as junk, not real leads. |
| `data/production_board.csv` | 364 videos V001..V364: `video_id,client,title,editor,stage,notes_on_board,revisions,editor_hours,client_approved_on,shoot_booking`. Stages: Delivered / In revision / In review / In edit. Editors: Ali ($35/h), Rita ($30/h), Eli ($22/h, joined Jun 2026), Dev (freelance $40/h, joined Sep 2026). | 365 lines | Notes like "Remove prices part" duplicate client fix requests; `client_approved_on` only sometimes filled. |
| `data/messages.txt` | 201 timestamped customer comunicação: Email / WhatsApp / Voice note (with transcript!) / Instagram DM / Website Form — plus spam/scam messages to ignore. Lots of Spanish messages from Rosa (multilingual trap). | 202 lines | Key business signals buried here: Brightwater 25% discount promised, Glow "we'll pause after this month", Fieldhouse pays for 2 other brands monthly, Kim Dental referral, recurring "Still not fixed / second time I ask / Did anyone see my message" = the lost-request story. |
| `data/team.csv` | 5 people. Zaid Owner (no pay listed), Ali/Rita/Eli/Dev editors with hourly rates. | 6 lines | Needed to cost-out editor time for `what_this_data_cannot_tell_us` / profitability. |
| `data/costs.csv` | Studio time $40/h (Content Day 6h, Reels Pack 3h, Retainer Shoot 4h, podcast sessions = booked hours). Editor time → team.csv; editor_hours already include revisions. | 3 lines | Lets us compute service cost → true profit per service/channel. |

## 2. What we need to do (the 6 deliverables)

1. **answers.json** — filled completely, `pack_id: "205"`, `live_link`, `video_link`, `code_or_files_link`.
2. **Live web tool** — a real URL, works on phone, no login (hard-to-guess path), "Add new files" button that ingests the same schemas, one unified client view, a 10-second "what to do first" dashboard, and suggest-only action cards.
3. **writeup.md / PDF** — 2 pages max: how each answer was found (proof), how the system works, cost/month, what doesn't work, the Jev job + measured accuracy, next-2-weeks plan.
4. **assumptions.md** — every question we would've asked + assumption we made instead.
5. **daily_log.md** — written as we go (their exact heading template).
6. **ai_log.md** (strongly recommended) — prompts, links, and one documented AI mistake + how we caught it.
7. **Video (5–10 min)** with transcript (free via Loom) — show tool working, then 3 raw answers.

## 3. What to implement (Part 1 — the analysis findings)

### Logic to build, derived from the data

- **a. Client identity resolution (the backbone).** Anchor each client to their **email domain/mailbox**, not name. Confirmed clusters (email is the join key, plus domain): Brightwater (`media@brightwaterdfw.org` — Brightwater Media Team / Brightwater DFW / Brightwater Church / Andre Moore all same), Bold & Brave (`megan@boldandbrave.fm` + stray `megan.ramirez.mail@gmail.com`), Fischer Dental (`ivy@fischerdental.com` + typo `.con` and L046 Fischer Dental), Fischer Family Law (`sfischer@fischerfamilylaw.com` — beware Fischer's Auto & Rosa/Simone Fischer are DIFFERENT businesses), Hector's Roofing (`hector@hectorsroofingtx.com` = Hector Whitfield/Adeyemi; also pays `Parkside Builders` — two businesses one owner), Hillcrest (`mia@hillcrestfit.co` then rebranded to `hillcrestathletics.com` in Aug), SAC = `triinitymedspa.com` (Plano/Frisco/Trinity variants), etc. Count "real clients" ≈ 30; payers-who-are-not-clients = Fieldhouse Marketing (pays for Rosewood Pediatrics + Copperline PT).
- **b. Who owes us (overdue).** Map payments→invoices; anything still unpaid after `due` date as of 2026-10-06 = overdue; compute `amount_owed` (respect the 50%-paid case: P5119 $450 "half now half later") and `days_late`.
- **c. Do we owe anyone?** Look for: double/duplicate payments (Vista paid INV-1079 twice: P5091 + P5092 both $900 → we owe $900 refund), refunds for the cancelled booking (B146 Lucia Kim "we already paid"), unused studio credits.
- **d. Work but never billed.** Compare completed bookings → invoices by booking_id memo + email + amount. Strong suspects: earlier Retainer Shoot periods, months missed when switching names, Brightwater's June 25%-off sessions getting misbilled, and any completed shoots with no memo/invoice match.
- **e. Where is the billing tool wrong?** Predictable dataset traps: INV-1160 void duplicate; Brightwater billed $300 after the June discount started; partial status INV-1126 shows only partially paid; invoices issued for cancelled bookings (INV-1139 memo B146 paid-but-cancelled); double payments.
- **f. Lost request forensics.** Parse messages.txt into: client, request type, date, channel. Cross-reference each fix request vs production_board `notes_on_board` + revisions + approval date. Flag "still broken" threads ("still not fixed", "second time I ask", "did anyone see my message", "sigue igual", "ya les había dicho") → these are lost requests. Compute complaint volume per month → `lost_requests_started_getting_worse_in`. Root causes list: requests coming via 5 untracked channels (WhatsApp/voice/IG/email), no ticket system, no twinning to the production board, voice notes requiring translation, revision loop without closure confirmation.
- **g. Churn risk.** Grace Delgado's website form: "we want to talk about whether we continue" (sent twice, unanswered) is #1 (with Victor/Delgado relationship damage from repeated naming mistakes as the underlying evidence). Alan Delgado (Glow Realty) also paused after "too many rounds of fixes" — earlier churn warning Glow Wealth Partners. `what_to_do_this_week`: call Grace today.
- **h. Best marketing channel.** Join leads( Won ) → bookings → payments → profit-vs-cost. Referral & Instagram look strongest; Meta ads → tons of Lost. Must also state what the data CANNOT tell us (retention economics, which videos were posted, CAC by channel, LTV, staff bandwidth).
- **i. monday_top_3** (own judgment, but must be backed): likely #1 "Call Grace Delgado now (contract)", #2 "Resolve double-paid $900 Vista refund", #3 "Set up single inbox for all client requests".
- **j. Spam filtering.** Ignore L010/L017/L059/L095, insta-verify DM, domain-renewals email, invoice.zip scam, seo email. Voice notes & Instagram messages in Spanish are counted as real requests.

### answers.json building order
1. `pack_id` (2 min) → 2. `client_count` + full clients[] with all alias names if data ever uses "other names used in the data" → 3. `overdue[]` + total → 4. `we_owe[]` → 5. `never_billed[]` → 6. `billing_tool_is_wrong[]` → 7. `lost_requests[]` + root causes + start date → 8. churn → 9. channel → 10. `monday_top_3`.

## 4. How we're gonna push this off (Part 2 — the live system)

### Architecture (chosen strategy: zero-backend, pure-static)
- **Tech:** single-file (or small) React + Tailwind app using `react-router-dom` for a hash of routes; or plain HTML+JS if speed demands. All CSV parsing in-browser with `papaparse`.
- **Data flow:** All 8 files ship embedded as static assets at `/data/*`; on first load they're parsed. "Add new files" accepts any matching schema (`bookings.csv`, `invoices.csv`, `payments.csv`, `production_board.csv`, `leads.csv`, `messages.txt`, …) and **replaces** that dataset — so when the interviewers upload new files you've never seen, everything recomputes live with no code changes. Partial uploads are okay (only the files they send are replaced, everything else stays PUT).
- **Client resolution module** used uniformly by every screen: normalize emails (case-insensitive, fix known typos, gmail→boldandbrave.fm dedupe), nickname table per client, "Parkside Builders pays Hector" transient mapping. Build this ONCE and export for both the UI and answers.json (one source of truth, no copy/paste drift).
- **Pages (mobile-first):**
  1. **Dashboard / "What to do first"** — prioritized action cards. Suggest-only: "INV-1150 is 24 days late — send reminder?" / "Vista paid twice — issue refund?" / "Grace wants to talk contract — call her". Owner taps ✅ / ❌. Nothing sends anything automatically.
  2. **Clients** — 1 card per resolved client (30ish), tap → the ONE page showing their bookings, invoices, payments, videos in revision, outstanding messages.
  3. **Upload** — big button, drag/drop, accepts any subset of the 8 file schemas. After parse, shows "5 new invoices added; 2 new payment mismatches found."
  4. **Reports** — overdue table, never-billed table, lost-requests list, channel profitability chart.
- **Hosting:** Netlify Drop (free, drag & drop, no build needed) with a hard-to-guess path like `/axeom-lessons-7931ᵢnpx`. Fallback: GitHub Pages or Vercel. Test on the phone over LTE before submitting.
- **Est. monthly cost:** $0 (Netlify free tier + static files). Mention in writeup.

### Jev job (Part 3)
- **Job choice:** uses Jev (docs.typesafe.ai) to classify `messages.txt` entries automatically: is this (a) an edit request for video X, (b) a payment question, (c) a schedule change, (d) spam, plus confidence. 201 messages are exactly the kind of messy multi-language mixed-channel text NLP shines on.
- **Measure accuracy:** hand-label ~40 messages, run Jev same set, report "hand check: 40, Jev agreed on 36 (90%)." Document why we chose it + where it failed (e.g., nuanced baskets or Spanish slang).

## 5. Edge cases to get right (checklist before shipping)

**Data-parsing edge cases**
1. `payments.csv` dates are **DD/MM/YYYY**; `bookings.csv` is **MM/DD/YYYY**; invoices are ISO. One payment (P5002 `17/04/2026`) ONLY parses as day-first — naive MM/DD parsing will corrupt ~35% of payments.
2. `P5086` payment_id is **missing** — number jumps P5085→P5087. Tolerate missing IDs.
3. Money strings: `$1,500` (with $ and comma) vs `1500` vs `550` vs `$0`. prices can be 0 ($0 Retainer Shoot isn't free — it's billed monthly 2500).
4. 1 day-spanning date issue: 2026-10-06 is "today" — everything after must be excluded from "overdue" math; `upcoming` bookings aren't work done.
5. `pack_id` must be "205" exactly, not 205.0.

**Money edge cases**
6. Invoice INV-1160 is `void` — exclude from totals but note as a billing-tool error.
7. Invoice INV-1126 is `partial` — full 900 not owed, but 450 was paid (matches P5119 "half now half later"). `amount_owed` = 450 not 900.
8. INV-1085 shows `unpaid` but P5071 paid it — the **billing tool didn't mark it paid** — prime `billing_tool_is_wrong` evidence.
9. Double payment: P5091 + P5092 both match INV-1079 ($900 Vista Medspa) — one is a duplicate → `we_owe`.
10. Invoice `INV-1123` Ivy Khan / ABC Home Care — past due + they email "we'll pay once videos are posted" (that's #1 churn + #1 overdue).
11. Volume: INV-1103 Oakcliff `unpaid` but P5126 P5128 pay Lucia Kim the invoices (1148 vs 1103 don't match-up) — cross-reference by payer_email amount.
12. Fieldhouse pays aggregated batches for **other brands** ("Fieldhouse Jun invoices", "$2700 = Jul invoices ×3") — must not count as Fieldhouse's own revenue.
13. Megan's payment P5082 ($1200, ref "july sessions", no invoice ref) — must be matched to her 4 × $300 unpaid July invoices manually; that's exactly 1200. If we don't do this we get a wrong overdue total.
14. Glow Wealth Partners inwes June 19 "we'll pause after this month" — meaning July PGunpie-shoot (B016/B043) completed but potentially never invoiced.
15. Never-billed check: `bookings` completed with price > 0 but no matching invoice by email+amount (and booking_id not in any invoice memo). Example to verify: Brightwater studio sessions after June 25% discount being billed $300 instead of $225.

**Identity edge cases**
16. `ivy@fischerdental.con` in B126 = typo domain of `fischerdental.com` — must not create a new client.
17. Two different Fischer law/auto businesses + Rosa Fischer = Sage Bridal owner + Simone Fischer = Fischer Family Law — names collide; email is the ONLY safe anchor.
18. Hillcrest rebrand mid-August (fitness → athletics, new email) — 1 client, 2 names, 2 emails, `other_names_used_in_the_data` must list all.
19. Brightwater = Church + Media Team + DFW + Andre Moore — 1 client (church-related?) with 4 aliases, but the messages say "Brightwater church" + discount at "Brightwater" → single legal entity, safe to merge by email.
20. Trinity Med Spa is physically in Frisco/Plano but rosa@sage… no — Trinity = renee@trinitymedspa.com, branches are location suffixes, 1 client.
21. Victor Delgado same email as L049 "victor99@gmail" → never merge gmail leads with company domain leads.
22. Payer name mismatch in payments ("PASTOR ANDRE MOORE", "ROSA CASTILLO", "HECTOR WHITFIELD") — must resolve by email, not by name.

**Messages / leads edge cases**
23. Spanish messages (Rosa 3× (Sage Bridal styling tips), "sigue igual", "ya les había dicho") — count toward still-broken + lost-request; that's the "voice notes insta unterstützen multilingual" trap; Jev can translate.
24. Voice note: only 2 exist — but they have transcripts, so they're parseable like text. Note one from Reggie = Rosewood edit request.
25. IG DM from `@brooksautodetailin` (typo handle) is the actual lead that became Brooks Auto Detailing; the IG DM from `@parksidebuildersdfw` is a real request also logged on the board.
26. Spam to exclude: L010, L017, L059, L095, insta-verify scam, domain-renewal, `growth@rank1seo.biz`, `promo@fastfollowers.io`, billing@acct-dept.co invoice.zip. Counting any of these as leads corrupts `never_replied_leads`.
27. `never_replied_leads`: leads with `first_reply` empty AND status New — L011, L034, L037, L045, L053, L070, L071(replied July 26 but status New — check), L073, L088, L089, L091, L093, L095(spam), L100. Careful: L071 Trinity already a client with a different email — dedupe it out of the lost list.
28. Message → video matching must handle client's vague references: "the one we shot last week", "this", "the video" — map via shoot_booking + nearest prior booking date + email.

**UI/system edge cases**
29. "Add new files" must survive: extra columns, different row order, quoting/CRLF differences, new client names we've never seen, files uploaded in any order.
30. Uploading a file that arrives at the exact boundary (e.g., only `payments.csv`) must not corrupt other datasets.
31. Duplicate upload of the same file must not double-record payments.
32. Never act alone — every "act" card requires Yes/No and logs the owner's click (leave "history" mini-log, useful for video).
33. The 10-second test: homepage shows 3–5 max actions + ONE bottom bar. Zero jargon, giant tap targets.
34. Everything must work **offline-capable / on a data-sullied phone** on first paint — data is embedded, not fetch-blocking.

**Submission edge cases**
35. Test all links (live link, video, folder) in incognito before sending.
36. daily_log.md must look written-over-3-days, not one sitting — space the timestamps.
37. ai_log needs ≥1 concrete AI error we caught (e.g., AI mis-mapped P5082 $1200 or suggested auto-sending reminders — document the catch).
38. zip must contain all 6 items + file naming exact: writeup.md, assumptions.md, daily_log.md, ai_log.md, answers.json, video link (in answers.json too).

## 6. Suggested order of attack (72h worth = ~24-30 productive hours)

1. **Hour 0–2:** packed_id fix; start daily_log.md; parse all CSVs in one Python/JS pass.
2. **Hour 2–8:** Build the resolve-client engine + money engine; compute overdue/never_billed/we_owe/billing_wrong; start filling answers.json (leave unknowns blank).
3. **Hour 8–14:** Lost-request forensics from messages.txt → root causes.
4. **Hour 14–22:** Build the web app (dashboard-first), deploy to Netlify Drop, mobile test.
5. **Hour 22–26:** Jev job + writeup.md + assumptions.md.
6. **Hour 26–30:** Record video with transcript; final edge-case sweep; incognito link test; zip; daily log entries.
   (Cut scope from the app in that order: 4th card, Reports page, charts — never from Part 1 answers.)

## 7. Known unknowns → go in assumptions.md NOT blindly guessed
- Are Brightwater = one entity or many? Assumption: one (same email).
- Is "Retainer Shoot $0" truly billable? Assumption: yes, billed monthly, 2500.
- What was the July→Aug-31 time boundary for "sessions together at the start of August" (Megan)? Assumption: pay-all by 8/10 (which she did, $1200).
- Is the Grace/contract relationship Delgado Insurance Group (Victor) or another Delgado? Grace shares delgadoinsures.com domain → same company.
- Whether the discount is 25% off the $300 podcast price or $225 flat? Messages say "25% off studio sessions from June on" → price shows 225 (= 300×0.75) for studio sessions only.
