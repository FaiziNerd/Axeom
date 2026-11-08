// Probe: print everything needed to hand-curate answers.json from engine output.
const fs = require("fs"), path = require("path");
eval(fs.readFileSync(path.join(__dirname, "..", "app", "js", "engine.js"), "utf8"));

const dir = path.join(__dirname, "..", "data");
const files = ["bookings.csv", "invoices.csv", "payments.csv", "leads.csv", "production_board.csv", "messages.txt", "team.csv", "costs.csv"];
const data = {};
files.forEach(f => { data[f.replace(/\.(csv|txt)$/, "")] = fs.readFileSync(path.join(dir, f), "utf8"); });
const rep = Axeom.computeReport(data);

console.log("=== CLIENT IDENTITY TABLE ===");
const per = {};
const collect = (key, nameKey, emailKey, phoneKey) => rows => rows.forEach(r => {
  const c = r.client; if (!c) return;
  per[c] = per[c] || { names: {}, emails: {}, phones: {} };
  if (r[nameKey]) per[c].names[String(r[nameKey]).trim()] = 1;
  if (emailKey && r[emailKey]) per[c].emails[String(r[emailKey]).trim().toLowerCase()] = 1;
  if (phoneKey && r[phoneKey]) per[c].phones[r[phoneKey]] = 1;
});
collect("b", "client_name", "email")(rep.bookings);
collect("i", "bill_to", "email")(rep.invoices);
collect("p", "payer", "payer_email")(rep.payments);
collect("l", "name", "email", "phone")(rep.leads);
// messages: names + sender emails + phones
rep.messages.forEach(m => {
  const c = m.client; if (!c) return;
  per[c] = per[c] || { names: {}, emails: {}, phones: {} };
  if (m.name && m.name.length > 3) per[c].names[String(m.name).trim()] = 1;
  if (/@/.test(m.sender || "")) per[c].emails[m.sender.toLowerCase()] = 1;
  if (m.phone) per[c].phones[m.phone] = 1;
});
Object.keys(per).sort().forEach(k => console.log(
  k + "\n  names: " + Object.keys(per[k].names).join(" | ") +
  "\n  emails: " + Object.keys(per[k].emails).join(" | ") +
  "\n  phones: " + Object.keys(per[k].phones).join(" | ")
));

console.log("\n=== LEADS remaining (unresolved names) ===");
rep.leads.filter(l => !l.client).forEach(l => console.log(l.lead_id, "|", l.name, "|", l.business, "|", l.email, "|", l.phone, "|", l.status));

console.log("\n=== SPECIFIC INVOICES ===");
["INV-1065","INV-1070","INV-1082","INV-1085","INV-1088","INV-1091","INV-1094","INV-1105","INV-1149","INV-1153","INV-1160","INV-1043","INV-1079","INV-1120"].forEach(no => {
  const iv = rep.invoices.find(x => x.invoice_no === no);
  if (!iv) { console.log(no, "NOT FOUND"); return; }
  console.log(no, "|", iv.client, "| bill_to:", iv.bill_to, "| $" + iv.amount_n, "| issued", iv.issued, "due", iv.due, "| status", iv.status, "| paid", iv.paid_total, "| alloc", iv.allocation.join(","), "| memo:", (iv.memo || "").slice(0, 60));
});

console.log("\n=== NEVER BILLED ===");
rep.never_billed.forEach(n => console.log(JSON.stringify(n)));

console.log("\n=== WE OWE ===");
rep.we_owe.forEach(w => console.log(JSON.stringify(w)));

console.log("\n=== LOST REQUESTS (engine, all) ===");
rep.lost_requests.slice().sort((a, b) => a.request_date < b.request_date ? -1 : 1)
  .forEach(l => console.log(l.video_id, "|", l.client, "| req", l.request_date, l.came_by, "| esc", l.escalation_date, "| booking", l.booking_id));

console.log("\n=== ESCALATIONS + FRUSTRATION MESSAGES ===");
rep.messages.filter(m => m.frustrated && !m.spam).forEach(m =>
  console.log(m.date, m.channel, "|", m.client, "|", m.text.slice(0, 100).replace(/\n/g, " ")));

console.log("\n=== CHANNELS ===");
rep.channels.forEach(c => console.log(JSON.stringify(c)));

console.log("\n=== ESCALATION MONTHS ===", JSON.stringify(rep.escalation_months));

console.log("\n=== NEVER-REPLIED LEAD DETAILS ===");
rep.never_replied_leads.forEach(id => {
  const l = rep.leads.find(x => x.lead_id === id);
  console.log(id, "|", l.name, "|", l.business, "|", l.email, "|", l.source, "|", l.date, "|", (l.notes || "").slice(0, 70));
});

console.log("\n=== GRACE / DELGADO MESSAGES ===");
rep.messages.filter(m => m.client === "Delgado Insurance Group" && !m.spam).forEach(m =>
  console.log(m.date, m.channel, m.dir, "|", (m.name || ""), "|", m.text.slice(0, 110).replace(/\n/g, " ")));

console.log("\n=== GLOW PAUSE EMAIL (root cause of Jul retainer) ===");
rep.messages.filter(m => /glow/i.test(String(m.client)) || /awhitfield/.test(m.sender)).slice(0, 12).forEach(m =>
  console.log(m.date, m.channel, m.dir, "|", m.text.slice(0, 110).replace(/\n/g, " ")));
