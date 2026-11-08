# How I found each answer

Every number comes from `app/js/engine.js`. `tools/test.js` checks that function against a separate count from the raw files. Today in the data is 6 Oct 2026.

Real clients: **29**. Match email first, then a known alias. An email the pack has never used becomes its own client, which is how a new file still shows up. Fieldhouse Marketing is not one of the 29. On 10 Jun, Ivy wrote to bill Fieldhouse for Rosewood Pediatrics and Copperline Physical Therapy. Those shoots and videos stay on the two practices. Fieldhouse is the payer who is not a client.

Overdue: **$11,650** on 9 invoices. Payments are day-first. P5092 is dated 14/08/2026, which is only a real date read that way. A named invoice is paid first. A blank reference, including Megan's $1,200 "july sessions", fills the oldest open invoices. INV-1094 says paid and no cash arrived. Void INV-1160 is the twin of paid INV-1043 and stays out of the total.

We owe Vista **$900**. P5091 and P5092 both pay INV-1079.

Never billed: **$2,700**. Riverbend B058 and B130, and Fischer Family Law B153, are completed and have no invoice.

The billing tool is wrong on **9** invoices. Six say unpaid and the bank already paid them. INV-1094 says paid and the money never came. INV-1160 should not be in any total. Malik's August retainer, INV-1091, is $2,250 while the other four months are $2,500, so $250 of work was never invoiced. INV-1149 and INV-1153 use the same memo, but B154 and B155 are two shoots on 29 Sep, so that is not a double bill.

Lost requests got worse from **July 2026**. The 12 rows in `answers.json` are the threads with a quoted escalation. Delgado Insurance is the most likely to leave: Grace wrote on 30 Sep and again on 3 Oct about the contract, and neither note was answered. INV-1120 is 21 days late.

Best channel on gross profit: **LinkedIn**, $17,556 left from $31,750 collected after $14,194 of studio time at $40/hour and editor time. Referral closes more often (8 of 11) but profit is only $11,312. The files have no ad invoices, so this is not return on ad spend.

# How the system works

The site is static files. Cost is **$0/month**. No server, no login. The same function drives the phone page and `answers.json`.

Today shows three suggestions: call Delgado, refund Vista $900, chase INV-1094 (49 days). Yes and Not now stay on the phone. Nothing is sent. Money holds the chart, the debt, and the tool errors. Clients holds each practice, including Rosewood and Copperline when the booking email is Fieldhouse's, and the 14 unanswered leads.

New files replace one dataset, chosen by the header, and every total recomputes. Reset puts the original pack back. A bad upload does not stick.

# What does not work yet

"The one we shot last week" can still land on the wrong video. An upload replaces a whole file. It does not merge a handful of new rows into the old one. No login is what the brief asked for, and it would be the wrong habit for a real bank export.

# Jev

The job is to label each inbox line as a request, complaint, billing note, churn risk, lead, schedule change, spam, or other, and to mark frustration. That is the step between the five inboxes and the video board.

TypeSafe has no free Jev key, so Groq's free plan did this job. The model is `openai/gpt-oss-20b`. On 51 hand-labeled lines, every 4th message, the category was right **47 of 51** times and the frustration mark was right **49 of 51** times. The four category misses were a schedule note called other, a lead called a request, a neutral line called spam, and a spam line called billing.

Every original inbox line now shows that label on the client sheet. The money totals still come from the invoices and the bank. A newly uploaded file is not sent to Groq, because the key is not in the website.

# Next 2 weeks

Call Delgado before the contract conversation. Refund the $900, bill the $2,700, correct INV-1091, and collect the $11,650 from the oldest invoice down. One inbox writes a video id onto the board and does not close until the client says the fix is in. Keep LinkedIn. Do not buy more Meta ads until those 14 silent leads get a human reply.
