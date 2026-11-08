/* Jev classifier harness — the "learn something new, fast" deliverable.
 *
 * JOB: classify every message in messages.txt so requests reach the video board
 *      and churn/billing signals reach the owner. This is the exact pipeline step
 *      whose absence produced the lost requests (requests arrived on 5 channels
 *      and nothing ever labeled them "needs the editor").
 *
 * WHY JEV: the studio needs typed decisions it can route on, not essays.
 * Choice questions return a category (7 options) ; Noul returns probability
 * the message expresses frustration. Low-confidence or low-probability answers
 * route to a human — matching the brief's "suggest, never act".
 *
 * MEASURE: hand-labeled ground truth (every 4th of the 202 messages = 51).
 * Accuracy printed for (a) category, (b) frustration, (c) per-class confusion.
 *
 * RUN: set TYPESAFE_API_KEY (from https://console.typesafe.ai/keys), then
 *      node tools/jev.js
 * Writes tools/jev_results.json.
 */
const fs = require("fs");
const path = require("path");

/* ---------- ground truth: every 4th message, labeled by hand ---------- */
const LABELS = [
  ["other", 0], ["request", 0], ["request", 0], ["request", 0],
  ["request", 0], ["request", 0], ["request", 0], ["request", 0],
  ["schedule", 0], ["request", 0], ["billing", 0], ["churn", 1],
  ["request", 0], ["request", 0], ["request", 0], ["complaint", 1],
  ["other", 0], ["request", 0], ["request", 0], ["schedule", 0],
  ["request", 0], ["request", 0], ["request", 1], ["request", 0],
  ["request", 0], ["request", 0], ["complaint", 1], ["complaint", 1],
  ["complaint", 1], ["request", 0], ["request", 0], ["request", 0],
  ["request", 0], ["lead", 0], ["other", 0], ["request", 0],
  ["request", 1], ["request", 0], ["request", 0], ["request", 0],
  ["request", 0], ["request", 0], ["spam", 0], ["request", 0],
  ["request", 0], ["request", 0], ["schedule", 0], ["request", 0],
  ["request", 0], ["request", 0], ["request", 1]
];

const CRITERIA = {
  request: "Asks for a change to a video: cut/remove/blur/add line, colors, music/captions, other shot",
  complaint: "Repeats a previously-stated request or expresses dissatisfaction ('still not fixed', 'second time I ask', 'did anyone see')"
  ,
  billing: "About money: invoices, payment, refunds, price quotes, billing requests",
  churn: "Pauses, cancels a relationship, or wants to talk about the contract/whether they continue",
  lead: "Asks about hiring the studio or buying more services for the first time",
  schedule: "Shoot logistics: timing, rescheduling, confirmations, cancellations of a session",
  spam: "Scam/junk/promotional: fake verification, SEO pitch, followers, attachments like invoice.zip, crypto",
  other: "Social or neutral: thanks, greeting, 'see you tomorrow', studio notes back to a client"
};

async function main() {
  const key = process.env.TYPESAFE_API_KEY;
  if (!key) {
    console.error("TYPESAFE_API_KEY not set. Get a key at https://console.typesafe.ai/keys then:");
    console.error("  $env:TYPESAFE_API_KEY = \"js_...\"   (PowerShell)");
    console.error("  node tools/jev.js");
    process.exit(2);
  }

  const lines = fs.readFileSync(path.join(__dirname, "..", "data", "messages.txt"), "utf8")
    .split(/\r?\n/).filter(l => /^\[20\d\d-/.test(l));
  const sample = lines.filter((_, i) => i % 4 === 0);
  if (sample.length !== LABELS.length) {
    throw new Error("sample/label mismatch: " + sample.length + " vs " + LABELS.length);
  }

  const results = [];
  let cats = 0, frus = 0, i = 0;

  for (const msg of sample) {
    const body = {
      state: msg,
      model: "jev-latest",
      questions: {
        category: {
          type: "choice",
          instructions: "What is this studio-inbox message asking for? Sender context (channel, direction, name/phone/email) is part of the state.",
          criteria: CRITERIA
        },
        frustrated: {
          type: "noul",
          instructions: "This message expresses real frustration or annoyance (repeat complaint, 'can't hear myself', 'did anyone see', scam suspicion) — beyond a polite first-time request."
        }
      }
    };

    const t0 = Date.now();
    let out, okMsg;
    try {
      const r = await fetch("https://api.typesafe.ai/v1/systemone", {
        method: "POST",
        headers: { "Authorization": "Bearer " + key, "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!r.ok) throw new Error("HTTP " + r.status + " " + (await r.text()).slice(0, 200));
      out = await r.json();
      okMsg = true;
    } catch (e) {
      okMsg = false;
      console.error("call failed:", e.message);
    }

    const truth = LABELS[i];
    const rec = { i, label_index: LABEL_INDEX[i], line: msg, ok: okMsg };
    if (okMsg) {
      const a = out.answers;
      rec.category = a.category.choice;
      rec.category_conf = a.category.confidence;
      rec.dist = a.category.probabilities;
      rec.frustrated = a.frustrated.noul;
      rec.correct = a.category.choice === truth[0];
      rec.frustrated_correct = (a.frustrated.noul >= 0.5) === !!(truth[1]);
      rec.ms = Date.now() - t0;
      rec.tokens = out.usage;
      if (rec.correct) cats++;
      if (rec.frustrated_correct) frus++;
    }
    results.push(rec);
    process.stdout.write((rec.correct ? "." : "X") + (rec.frustrated_correct ? "" : "!") + " (" + (i + 1) + "/" + sample.length + ")\r");
    i++;
  }
  console.log("\n");

  const okCount = results.filter(r => r.ok).length;
  console.log("=== JEV RESULTS ===");
  console.log("state size:", sample.length, "messages");
  console.log("category accuracy:", cats + "/" + okCount, "=", (100 * cats / Math.max(1, okCount)).toFixed(1) + "%");
  console.log("frustration accuracy:", frus + "/" + okCount, "=", (100 * frus / Math.max(1, okCount)).toFixed(1) + "%");

  // confusion matrix (where does it fail?)
  const confusion = {};
  results.filter(r => r.ok && !r.correct).forEach(r => {
    const k = truthLabel(LABELS, r.i, 0) + " → " + r.category;
    confusion[k] = (confusion[k] || 0) + 1;
  });
  console.log("confusion:", JSON.stringify(confusion, null, 2));

  const perClass = {};
  Object.keys(CRITERIA).forEach(k => {
    const mine = () => results.filter(r => r.ok && truthLabel(LABELS, r.i, 0) === k);
    if (mine().length) {
      perClass[k] = mine().filter(r => r.correct).length + "/" + mine().length;
    }
  });
  console.log("per-class:", JSON.stringify(perClass, null, 2));

  fs.writeFileSync(path.join(__dirname, "jev_results.json"), JSON.stringify({
    date: new Date().toISOString(), model: "jev-latest",
    sample_size: okCount, category_accuracy: cats / Math.max(1, okCount),
    frustration_accuracy: frus / Math.max(1, okCount), confusion, perClass, results
  }, null, 2));
  console.log("written tools/jev_results.json");
  process.exit(0);
}
function truthLabel(labels, i, idx) { return labels[i][idx]; }
// label indexes in the original 202-line file for traceability
const LABEL_INDEX = (function () {
  const lines = fs.readFileSync(path.join(__dirname, "..", "data", "messages.txt"), "utf8").split(/\r?\n/).filter(l => /^\[20\d\d-/.test(l));
  const idxAll = [];
  lines.forEach((l, i) => idxAll.push(i % 4 === 0 ? i : null));
  // build per-sample: index in original list where i%4==0 — ordering preserved
  const perSample = [];
  lines.forEach((l, i) => { if (i % 4 === 0) perSample.push(i); });
  return perSample;
})();

main().catch(e => { console.error(e); process.exit(1); });
