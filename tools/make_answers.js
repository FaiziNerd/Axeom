// Builds answers.json from the verified engine output + hand-curated narrative.
// Numbers come from the engine (single source of truth); stories quote the data.
const fs = require("fs"), path = require("path");
eval(fs.readFileSync(path.join(__dirname, "..", "app", "js", "engine.js"), "utf8"));

const dir = path.join(__dirname, "..", "data");
const files = ["bookings.csv", "invoices.csv", "payments.csv", "leads.csv", "production_board.csv", "messages.txt", "team.csv", "costs.csv"];
const data = {};
files.forEach(f => { data[f.replace(/\.(csv|txt)$/, "")] = fs.readFileSync(path.join(dir, f), "utf8"); });
const rep = Axeom.computeReport(data);

const C = rep.clients;
const byKey = k => C.find(c => c.key === k);
const inv = no => rep.invoices.find(x => x.invoice_no === no);

/* ---------- clients (email-first identity; aliases across all 8 files) ---------- */
const CLIENT_ROWS = [
  ["ABC Home Care", ["Ivy Khan"], ["ivy@abchomecare.com"], ["817-555-0156"]],
  ["Bloom Family Therapy", ["Bloom Therapy", "Hannah Becker", "Dr. Hannah Becker"], ["hbecker@bloomfamilytherapy.com"], ["817-555-0139"]],
  ["Bold & Brave Podcast", ["Bold and Brave", "B&B Podcast", "Megan Ramirez"], ["megan@boldandbrave.fm", "megan.ramirez.mail@gmail.com"], ["972-555-0115"]],
  ["Brightwater", ["Brightwater Church", "Brightwater DFW", "Brightwater Media Team", "Andre Moore", "Pastor Andre Moore"], ["media@brightwaterdfw.org"], ["214-555-0161"]],
  ["Brooks Auto Detailing", ["Brooks Auto", "Brooks Detailing", "Carlos Brooks"], ["carlos.brooks.detail@gmail.com"], ["817-555-0176"]],
  ["Copperline Physical Therapy", ["Copperline PT", "Angela Ortiz"], ["aortiz@copperlineptdallas.com"], ["214-555-0134"]],
  ["Cypress Gym", ["Cypress", "Cypress Gym TX", "Jared Lee"], ["jared@cypressgym.co"], ["817-555-0193"]],
  ["Delgado Insurance Group", ["Delgado Insurance", "Delgado Ins", "Victor Delgado", "Grace Delgado"], ["victor@delgadoinsures.com", "grace@delgadoinsures.com"], ["214-555-0190", "469-555-0141"]],
  ["Evergreen Builders", ["Evergreen", "Evergreen & Co Builders", "Evergreen Builders LLC", "Greg Adeyemi"], ["greg@evergreen.build"], ["972-555-0187"]],
  ["Fischer Dental", ["Fischer Dental PLLC", "Ivy Fischer", "Dr. Ivy Fischer", "Dr Fischer"], ["ivy@fischerdental.com", "ivy@fischerdental.con"], ["972-555-0132"]],
  ["Fischer Family Law", ["Fischer Law", "Fischer Family Law PLLC", "Simone Fischer"], ["sfischer@fischerfamilylaw.com"], ["469-555-0137"]],
  ["Fischer's Auto Spa", ["Fischer's Auto", "Sam Fischer"], ["sam@fischersautospa.com"], ["817-555-0197"]],
  ["Glow Wealth Partners", ["Glow WP", "Alan Whitfield"], ["awhitfield@glowwp.com"], ["817-555-0124"]],
  ["Hector's Roofing", ["Hectors Roofing", "Hector's Roofing LLC", "Hector Whitfield", "Hector Adeyemi"], ["hector@hectorsroofingtx.com"], ["214-555-0171", "214-555-0195"]],
  ["Hillcrest Athletics", ["Hillcrest", "Hillcrest Fit", "Hillcrest Fitness", "Mia Romero"], ["mia@hillcrestathletics.com", "mia@hillcrestfit.co"], ["817-555-0151"]],
  ["Kim Dental", ["Kim Dental PLLC", "Dana Kim", "Dr. Dana Kim", "Dr Kim"], ["office@kimdental.com"], ["972-555-0175"]],
  ["Malik Law Firm", ["Malik", "Malik Law", "Malik Law Firm PLLC", "Hector Malik"], ["hmalik@maliklaw.com"], ["214-555-0104"]],
  ["Metroplex Makers Podcast", ["Metroplex Makers", "Derek Cho"], ["derek@metroplexmakers.fm"], ["214-555-0183"]],
  ["Oak Cliff Realty", ["Oak Cliff Realty LLC", "Lucia Kim"], ["lucia@oakcliffrealty.com"], ["817-555-0135"]],
  ["Oakcliff Realty Group", ["Oakcliff RG", "Alan Delgado"], ["alan@oakcliffrg.com"], ["817-555-0171"]],
  ["Parkside Builders", ["Parkside", "Parkside & Co Builders", "Parkside Builders LLC", "Hector Whitfield"], ["hector@parkside.build"], ["469-555-0169"]],
  ["Ridgeway Barbershop", ["Ridgeway Barbers", "Ethan Becker"], ["ethan@ridgewaybarbers.com"], ["817-555-0106"]],
  ["Riverbend Coffee Roasters", ["Riverbend Coffee", "Riverbend Roasters", "Simone Chen"], ["simone@riverbendcoffee.com"], ["972-555-0131"]],
  ["Rosewood Pediatrics", ["Rosewood Peds", "Maria Zamora"], ["mzamora@rosewoodpeds.com"], ["972-555-0161"]],
  ["Sage Bridal Boutique", ["Sage Bridal", "Rosa Fischer"], ["rosa@sagebridal.com"], ["214-555-0168"]],
  ["Silverleaf Chiropractic", ["Silverleaf Chiro", "Dr. Moore", "Reggie Moore"], ["drmoore@silverleafchiro.com"], ["817-555-0192"]],
  ["The Keystone Lab", ["Keystone Lab", "Keystonelab Coffee", "Maria Daniels"], ["maria@thekeystonelab.coffee"], ["817-555-0152"]],
  ["Trinity Med Spa", ["Trinity", "Trinity Medspa", "Trinity Med Spa - Frisco", "Trinity Med Spa - Plano", "Renee Nguyen"], ["renee@trinitymedspa.com"], ["972-555-0167"]],
  ["Vista Med Spa", ["Vista", "Vista Medspa", "Vista Med Spa - Frisco", "Vista Med Spa - Plano", "Rosa Castillo"], ["rosa@vistamedspa.com"], ["469-555-0144"]]
];

const clients = CLIENT_ROWS.map(([name, aliases, emails, phones]) => ({
  name,
  other_names_used_in_the_data: aliases,
  emails, phones
}));
if (clients.length !== rep.counts.clients_total) {
  throw new Error("clients list (" + clients.length + ") != engine count (" + rep.counts.clients_total + ")");
}

/* ---------- overdue (engine list is already correct: void excluded) ---------- */
const overdue = rep.overdue_list.map(o => ({
  client: o.client, invoice: o.invoice, amount_owed: o.amount_owed, days_late: o.days_late
}));
const overdue_total = rep.overdue_total;

/* ---------- we owe ---------- */
const we_owe = rep.we_owe.map(w => ({ client: w.client, amount: w.amount, why: w.why }));

/* ---------- never billed ---------- */
const never_billed = rep.never_billed.map(n => ({ client: n.client, booking_id_or_month: n.booking_id_or_month, amount: n.amount }));
const never_billed_total = rep.never_billed_total;

/* ---------- billing tool is wrong (curated: each with bank-level proof) ---------- */
const paidButUnpaid = [1065, 1070, 1082, 1085, 1088, 1105].map(no => inv("INV-" + no));
const tool = [
  ...paidButUnpaid.map(iv => ({
    invoice: iv.invoice_no,
    tool_says: "unpaid",
    truth: "really paid — the money is in the bank",
    how_you_know: iv.allocation
      .map(pid => { const p = rep.payments.find(p => p.payment_id === pid); return p.payment_id + " (" + p.date + ", " + (p.method || "") + ")"; })
      .join(" + ") + " lands on exactly " + iv.bill_to + " for $" + iv.amount_n.toFixed(2) + (iv.memo ? " (" + iv.memo + ")" : "") + "; the tool never flipped the status."
  })),
  {
    invoice: "INV-1094",
    tool_says: "paid",
    truth: "no payment on record — the money never arrived (this is the worst debt: 49 days overdue)",
    how_you_know: "No payment in payments.csv references INV-1094, and no blank-referenced Cypress Gym payment matches $900; meanwhile the invoice is marked paid, hiding a real $900 debt until it got 49 days late."
  },
  {
    invoice: "INV-1160",
    tool_says: "void invoice, but still shown in the open-invoice ledger as an active $1,500 bill",
    truth: "destructive double-numbering: it is a duplicate of INV-1043, which was paid via P5047 on 2026-06-12",
    how_you_know: "INV-1043 and INV-1160 are both Fischer Dental PLLC, both $1,500, issued 2026-06-10, due 2026-06-24; INV-1043 carries payment P5047. Any 'total owed' including INV-1160 overstates debt by $1,500."
  },
  {
    invoice: "INV-1091",
    tool_says: "paid in full at $2,250",
    truth: "the August retainer was under-billed by $250 — every other month (INV-1034, 1062, 1122, 1154) bills $2,500, so $250 of delivered retainer work was never invoiced",
    how_you_know: "All five 'Monthly retainer' invoices compare side by side: June/July/Sep/Oct are $2,500, August alone is $2,250 (P5089 paid $2,250)."
  }
];
if (!rep.billing_tool_is_wrong.some(t => t.invoice === "INV-1091" && /under-billed/.test(t.truth))) {
  throw new Error("engine did not produce the August retainer gap");
}
// INV-1149 and INV-1153 share a memo, but B154 and B155 are two shoots that day.
// Identical wording is not a double bill, so it stays out of this list.

/* ---------- lost requests (the cleanest, hand-verified threads) ---------- */
const lost_requests = [
  {
    video_id: "V006", request_date: "2026-04-26", came_by: "whatsapp",
    why_it_was_lost: "Fischer Dental's stream of asks crossed three videos and two channels: 4/26 WhatsApp ('take out the part in why floss matters where I talk about prices'), 4/28 email ('add our phone number at the end of the one we shot last week' — never resolvable to a video), then on 5/6 'Still not fixed on first visit tour. A little frustrated honestly.' The earliest request of the whole year is the template for everything that follows."
  },
  {
    video_id: "V100", request_date: "2026-05-01", came_by: "email",
    why_it_was_lost: "Hector's Roofing emailed 5/1 'cut the first 3 seconds of the one we shot last week' — a video name he doesn't give; 74 days later (7/14) he wrote 'Did anyone see my message about storm damage tips? It's not fixed', and on 9/14 had to ask a third time. The vague references were never re-resolved to the actual video on the board."
  },
  {
    video_id: "V056", request_date: "2026-05-03", came_by: "whatsapp",
    why_it_was_lost: "Trinity Med Spa WhatsApped 5/3 'use our brand color teal on the one we shot last week' — again, no video named; on 7/28 the client concluded 'This is the second time I ask. hydrafacial reveal is still wrong.' WhatsApp input and vague references are the worst combination: neither the request nor the video ever got pinned."
  },
  {
    video_id: "V027", request_date: "2026-05-16", came_by: "whatsapp",
    why_it_was_lost: "Malik Law WhatsApped on 5/16 'use our brand color navy on divorce timeline' — the request eventually appears as a bare board note ('Brand color navy' on V027) but the video kept being shipped wrong; on 10/4 they escalated 'Divorce timeline still has the same problem. I already told you about this' — 141 days open."
  },
  {
    video_id: "V094", request_date: "2026-06-17", came_by: "email",
    why_it_was_lost: "Rosewood Pediatrics emailed 'take out the part in back pain myths where I talk about prices'; on 6/26 'Still not fixed… frustrated', and on 8/20 again asking to blur an unreleased client's face (which only became a bare note 'Blur client face'). Billed via Fieldhouse Marketing, so the world of their feedback lives in a personal inbox that never reaches the board."
  },
  {
    video_id: "V089", request_date: "2026-06-16", came_by: "whatsapp",
    why_it_was_lost: "Delgado Insurance WhatsApped on 6/16 asking for 'a calmer song' on client story; on 6/28 'Client story still has the same problem. I already told you about this.' The video's board row (V089) has no note about music at all."
  },
  {
    video_id: "V105", request_date: "2026-06-28", came_by: "email",
    why_it_was_lost: "Ridgeway Barbershop asked about the sale-promo video on 6/28; on 7/6 they escalated 'Sale promo still has the same problem. I already told you about this.'"
  },
  {
    video_id: "V046", request_date: "2026-06-29", came_by: "email",
    why_it_was_lost: "Sage Bridal asked about styling tips on 6/29, escalated 7/6, and AGAIN on 7/31 in Spanish — 'Sale promo sigue igual. Ya les había dicho.' (and again 9/28). Spanish-language requests were never acknowledged, so the fix could never close."
  },
  {
    video_id: "V131", request_date: "2026-07-23", came_by: "email",
    why_it_was_lost: "Cypress Gym reported 7/23 that the class-schedule video is still wrong; on 8/3 'This is the second time I ask. class schedule is still wrong' — and on 8/22 a third escalation on member story."
  },
  {
    video_id: "V168", request_date: "2026-07-24", came_by: "email",
    why_it_was_lost: "The Keystone Lab asked on 7/24 to 'use the other shot, the one outside, not inside' on the bean-origin-story video; on 8/6 'Did anyone see my message about bean origin story? It's not fixed' — the default editor failure-silence had to be broken twice more (9/15 WhatsApp, 9/25 'latte art' repeat)."
  },
  {
    video_id: "V173", request_date: "2026-07-25", came_by: "instagram",
    why_it_was_lost: "Fischer's Auto Spa's fix requests were scattered across email (ceramic coating 7/25), Instagram DM (7/26 Tesla detail) and WhatsApp (8/9); none exist on the board for those videos, so on 8/9 Sam had to repeat himself on WhatsApp: 'still has the same problem. I already told you about this.'"
  },
  {
    video_id: "V185", request_date: "2026-07-29", came_by: "email",
    why_it_was_lost: "Fischer Family Law asked 7/29 about the divorce timeline; on 8/3 'second time I ask. divorce timeline is still wrong', on 9/22 a new repeat about meet-the-attorney, and on 10/4 again — three escalations on the same law firm in one quarter."
  }
];

const lost_requests_root_causes = [
  "Requests arrive on 5 channels (email, WhatsApp, Instagram DM, voice note, website form) but there is no single inbox — 5 of the 12 thread examples never even entered a tracked place.",
  "Messages are never linked to a video: only a minority of the 364 board rows carry notes, and requests like 'the one we shot last week' are never resolved to a video_id.",
  "Non-English requests (Spanish) were never translated or acknowledged, so a Sage Bridal fix stayed open for a full quarter with zero action.",
  "There is no closed-loop confirmation — nobody ever replies 'done', and silence hid the same broken video for up to 141 days (Malik Law's navy brand color).",
  "Voice notes and Instagram DMs are invisible to editors sitting in the board spreadsheet; WhatsApp/DM threads were consistently the ones still broken at escalation time.",
  "Agency-billed clients (Fieldhouse's Rosewood + Copperline) have a second layer of indirection — their feedback goes to the agency, not the board."
];

/* ---------- never replied ---------- */
const never_replied_leads = rep.never_replied_leads;

/* ---------- most likely to leave ---------- */
const most_likely_to_leave = {
  client: "Delgado Insurance Group",
  evidence: [
    "Grace Delgado filled the website form on 2026-09-30: 'We would like to talk about our contract and whether we continue.'",
    "She followed up on 2026-10-03: 'Following up. We need to talk about the contract this week.' — still no reply to either.",
    "This comes after months of unresolved fixes: Victor recorded a voice note on 9/1 asking for the full name 'Delgado Insurance Group' in captions; the videos STILL read 'Delgado Insurance', and on 9/11 they wrote 'Not happy'.",
    "Their September retainer (INV-1120, $2,500, due 9/15) is 21 days overdue with nothing in the bank."
  ],
  what_to_do_this_week: "Call Grace/Victor today and before the promised 'contract talk this week': acknowledge the name-spelling failure by name, confirm the September retainer is being corrected in the billing tool (it says unpaid), re-deliver the two videos with the full corrected brand name and bigger captions within 48 hours, and ask what would make the contract worth renewing."
};

/* ---------- channels ---------- */
function usd0(n) { return "$" + Math.round(n).toLocaleString("en-US"); }
const best = rep.channels[0];
const referral = rep.channels.find(c => c.source === "Referral");
const best_marketing_channel = {
  channel: best.source,
  why: best.source + " is the most profitable channel on gross margin: " + usd0(best.profit) + " left after " + usd0(best.cost) + " of studio time ($40/hour) and editor time, on " + usd0(best.revenue) + " actually collected (" + best.won + " of " + best.leads + " leads, " + best.win_rate + "% won). " +
    (referral && referral.source !== best.source
      ? "Referral closes more often (" + referral.won + " of " + referral.leads + ", " + referral.win_rate + "%) and brought " + usd0(referral.revenue) + ", but those clients cost more to produce, so profit is " + usd0(referral.profit) + ". "
      : "") +
    "Website form is the worst closer (" + (rep.channels.find(c => c.source === "Website form") || {}).win_rate + "%). This is not return on ad spend: the files contain no ad invoices, so a free channel could still be the better buy."
};

/* ---------- limits of the data ---------- */
const what_this_data_cannot_tell_us = [
  "Whether the payments.csv export is complete — 'no payment on record' could also mean bank transfers that bypassed whatever tool produced this file.",
  "Why leads never replied: first_reply is blank for 14 leads, but we can't see whether the studio never wrote, wrote and bounced, or replied on an untracked channel.",
  "Actual contract terms for retainers — $2,500/month is inferred from consistency across 5 invoices, not from a contract document; INV-1091's $2,250 could theoretically be a negotiated discount (flagged, not assumed as cash still owed).",
  "Ad spend. Channel profit here is cash collected minus studio hours and editor hours. Without ad invoices, Referral could still beat LinkedIn on return on spend.",
  "Which team member failed which step — messages don't say who read and dropped them, and the board doesn't log who updated notes.",
  "Whether the tool's 'paid' figures match a real bank feed; we only have the payments.csv as proxy for the bank.",
  "Whether refunds/chargebacks happened outside this export window (e.g., Vista's $900 duplicate may already have been refunded off-record).",
  "Anything about video quality or creative satisfaction — ratings on the board average ~4.x but there is no survey data behind them.",
  "Declined/lost-lead reasons: leads.csv has a status but no reason field, so 'lost' ≠ 'rejected us' vs 'never answered them'."
];

/* ---------- monday top 3 ---------- */
const monday_top_3 = [
  "Call Delgado Insurance first thing (Grace promised a 'contract talk this week'): admit the name-caption failure, re-deliver two videos with 'Delgado Insurance Group' + bigger captions within 48h, fix September's retainer handling in the billing tool, and ask Grace what would make renewal make sense.",
  "Sweep the money in one pass: refund Vista's $900 double payment, re-issue the $250 Malik's August retainer was short, keep void INV-1160 out of any total, bill the $2,700 of shoots with no invoice, flip the 6 invoices the tool still calls unpaid, and chase the 9 real overdue invoices ($11,650), oldest first.",
  "Create one request inbox with a 24h SLA: a tiny form (or shared inbox) that siphons email, WhatsApp, Instagram DMs and voice notes into production_BOARD rows keyed by video_id, then closes the loop with the client. Nothing ships without a 'this fix is done' confirmation message — silence is why Glow left in June ('my notes keep getting missed') and Delgado is leaving now."
];

/* ---------- assemble ---------- */
let prev = {};
try { prev = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "answers.json"), "utf8")); } catch (e) {}

const answers = {
  pack_id: "205",
  your_name: prev.your_name || "Faizan Naeem",
  your_email: prev.your_email || "FaizanNaeem7799@gmail.com",

  live_link: prev.live_link || "",
  video_link: prev.video_link || "",
  code_or_files_link: prev.code_or_files_link || "",

  client_count: rep.counts.clients_total,
  clients,
  payers_who_are_not_clients: [
    { name: "Fieldhouse Marketing", pays_for: ["Rosewood Pediatrics", "Copperline Physical Therapy"] }
  ],

  overdue, overdue_total, we_owe, never_billed, never_billed_total,
  billing_tool_is_wrong: tool,
  lost_requests, lost_requests_root_causes,
  lost_requests_started_getting_worse_in: rep.lost_requests_started_getting_worse_in,
  never_replied_leads,
  most_likely_to_leave, best_marketing_channel,
  what_this_data_cannot_tell_us, monday_top_3
};

const out = path.join(__dirname, "..", "answers.json");
fs.writeFileSync(out, JSON.stringify(answers, null, 2) + "\n");
console.log("answers.json written:", out);
console.log("clients:", clients.length, "| overdue:", overdue.length, "($", overdue_total + ") | lost_requests:", lost_requests.length, "| tool wrong:", tool.length, "| leads:", never_replied_leads.length);
