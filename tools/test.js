// Node test harness: loads engine.js raw data, computes the report,
// and asserts numbers against hand-derived truth derived from the pack.
const fs = require("fs");
const path = require("path");

const engineSrc = fs.readFileSync(path.join(__dirname, "..", "app", "js", "engine.js"), "utf8");
eval(engineSrc);

let passed = 0, failed = 0;
function check(name, actual, expected) {
  const ok = typeof expected === "number" ? Math.abs(actual - expected) < 0.01 : String(actual) === String(expected);
  if (ok) { passed++; console.log("PASS", name, "=>", actual); }
  else { failed++; console.log("FAIL", name, "=> got", JSON.stringify(actual), "want", JSON.stringify(expected)); }
}

const dataDir = path.join(__dirname, "..", "data");
const files = ["bookings.csv", "invoices.csv", "payments.csv", "leads.csv", "production_board.csv", "messages.txt", "team.csv", "costs.csv"];
const data = {};
files.forEach(f => { data[f.replace(/\.(csv|txt)$/, "")] = fs.readFileSync(path.join(dataDir, f), "utf8"); });

const rep = Axeom.computeReport(data);

console.log("=== counts ===");
check("clients_total", rep.counts.clients_total, 29);
check("invoices_total", rep.counts.invoices_total, 160);
check("bookings_total", rep.counts.bookings_total, 174);
check("payments_total", rep.counts.payments_total, 128);
check("videos_total", rep.counts.videos_total, 364);
check("leads_total", rep.counts.leads_total, 101);
check("messages_total", rep.counts.messages_total, 202);

console.log("=== money ===");
check("overdue_total", rep.overdue_total, 11650);
check("overdue_items", rep.overdue_list.length, 9);
check("we_owe_total", rep.we_owe_total, 900);
check("never_billed_total", rep.never_billed_total, 2700);
check("never_billed_items", rep.never_billed.length, 3);

console.log("=== overdue rows ===");
rep.overdue_list.forEach(o => console.log(" ", o.invoice, o.client, "$" + o.amount_owed, o.days_late + "d |", o.note));

console.log("=== we owe ===");
rep.we_owe.forEach(w => console.log(" ", w.client, "$" + w.amount, "|", w.why));

console.log("=== never billed ===");
rep.never_billed.forEach(n => console.log(" ", n.client, n.booking_id_or_month, "$" + n.amount_owed));

console.log("=== billing tool wrong ===");
rep.billing_tool_is_wrong.forEach(t => console.log(" ", t.invoice, "|", t.tool_says, "|", t.truth));

console.log("=== lost requests ===", rep.lost_requests.length);
rep.lost_requests.forEach(l =>
  console.log(" ", l.video_id || "??", l.client, l.request_date, l.came_by, "->", l.escalation_date));
check("started_getting_worse_in", rep.lost_requests_started_getting_worse_in, "2026-07");

console.log("=== never replied ===", rep.never_replied_leads.join(", "));
check("never_replied_count", rep.never_replied_leads.length, 14);
check("spam_leads", rep.spam_leads.join(","), "L010,L017,L059,L095");

console.log("=== channels ===");
rep.channels.forEach(c => console.log(" ", c.source, "rev $" + c.revenue, "won", c.won, "/" , c.leads, "lost", c.lost, "win%", c.win_rate + "%"));

console.log("=== escalations by month ===", JSON.stringify(rep.escalation_months));

console.log("\n=== client spot checks ===");
const byKey = k => rep.clients.find(c => c.key === k);
console.log("Rosewood payer:", byKey("Rosewood Pediatrics").payer);
check("rosewood_payer", byKey("Rosewood Pediatrics").payer, "Fieldhouse Marketing");
check("rosewood_shoots", byKey("Rosewood Pediatrics").bookings >= 4, true);
check("copperline_shoots", byKey("Copperline Physical Therapy").bookings >= 4, true);
check("fieldhouse_not_a_client", !byKey("Fieldhouse Marketing"), true);
check("retainer_gap", rep.billing_tool_is_wrong.some(t => t.invoice === "INV-1091" && /under-billed/.test(t.truth)), true);
check("no_false_double_bill", !rep.billing_tool_is_wrong.some(t => t.invoice === "INV-1153"), true);
check("delgado_is_leave_risk", rep.most_likely_to_leave && rep.most_likely_to_leave.client, "Delgado Insurance Group");
check("best_profit_channel", rep.channels[0] && rep.channels[0].source, "LinkedIn");
check("delgado_escalations_gte2", (byKey("Delgado Insurance Group").escalations >= 2 && byKey("Delgado Insurance Group").lost_requests >= 2), true);

const openBookings = data.bookings.replace(/\s*$/, "") + "\nB999,11/02/2026,Northwind Dental,hello@northwind.example,Content Day,completed,1500\n";
const openData = Object.assign({}, data, { bookings: openBookings });
const openRep = Axeom.computeReport(openData);
check("unseen_email_becomes_client", openRep.counts.clients_total, 30);
check("unseen_email_named", openRep.clients.some(c => c.key === "Northwind Dental"), true);
console.log("Delgado:", JSON.stringify(byKey("Delgado Insurance Group")));
console.log("Glow:", JSON.stringify(byKey("Glow Wealth Partners")));

console.log(`\n${passed} passed, ${failed} failed.`);
if (failed) process.exit(1);
