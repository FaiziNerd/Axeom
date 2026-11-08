/* Free-plan classifier measurement. This is not Jev.
 *
 * Same job as tools/jev.js: 51 hand-labeled inbox lines, category plus frustration.
 * Calls Groq's free plan (openai/gpt-oss-20b) with a forced JSON schema.
 * The key is read from GROQ_API_KEY and is never written to disk.
 *
 *   $env:GROQ_API_KEY = "gsk_..."
 *   node tools/classify_free.js
 *
 * Writes tools/free_results.json.
 */
const fs = require("fs");
const path = require("path");

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
  complaint: "Repeats a previously-stated request or expresses dissatisfaction ('still not fixed', 'second time I ask', 'did anyone see')",
  billing: "About money: invoices, payment, refunds, price quotes, billing requests",
  churn: "Pauses, cancels a relationship, or wants to talk about the contract/whether they continue",
  lead: "Asks about hiring the studio or buying more services for the first time",
  schedule: "Shoot logistics: timing, rescheduling, confirmations, cancellations of a session",
  spam: "Scam/junk/promotional: fake verification, SEO pitch, followers, attachments like invoice.zip, crypto",
  other: "Social or neutral: thanks, greeting, 'see you tomorrow', studio notes back to a client"
};

const CATS = Object.keys(CRITERIA);
const MODEL = "openai/gpt-oss-20b";

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function ask(key, model, msg) {
  const criteria = CATS.map(k => k + ": " + CRITERIA[k]).join("\n");
  const body = {
    model: model,
    temperature: 0,
    messages: [
      {
        role: "system",
        content: "You label one inbox line for a video studio. Reply with JSON only.\n" + criteria
      },
      { role: "user", content: msg }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "inbox_label",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            category: { type: "string", enum: CATS },
            frustrated: { type: "boolean" }
          },
          required: ["category", "frustrated"]
        }
      }
    }
  };
  let lastErr = "";
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (r.status === 429) {
      const wait = Number(r.headers.get("retry-after") || 3) * 1000;
      await sleep(Math.min(wait, 20000));
      continue;
    }
    const text = await r.text();
    if (!r.ok) {
      lastErr = "HTTP " + r.status + " " + text.slice(0, 240);
      if (r.status >= 500) { await sleep(1500); continue; }
      throw new Error(lastErr);
    }
    const data = JSON.parse(text);
    const raw = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    const parsed = JSON.parse(raw);
    if (!CATS.includes(parsed.category) || typeof parsed.frustrated !== "boolean") {
      throw new Error("bad schema: " + String(raw).slice(0, 160));
    }
    return parsed;
  }
  throw new Error(lastErr || "rate limited");
}

async function main() {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    console.error("GROQ_API_KEY is not set. Create a free key at https://console.groq.com/keys");
    process.exit(2);
  }
  const lines = fs.readFileSync(path.join(__dirname, "..", "data", "messages.txt"), "utf8")
    .split(/\r?\n/).filter(l => /^\[20\d\d-/.test(l));
  const sample = lines.filter((_, i) => i % 4 === 0);
  if (sample.length !== LABELS.length) {
    throw new Error("sample/label mismatch: " + sample.length + " vs " + LABELS.length);
  }

  const results = [];
  let cats = 0, frus = 0;
  for (let i = 0; i < sample.length; i++) {
    const truth = LABELS[i];
    const got = await ask(key, MODEL, sample[i]);
    const correct = got.category === truth[0];
    const frustratedCorrect = got.frustrated === !!truth[1];
    if (correct) cats++;
    if (frustratedCorrect) frus++;
    results.push({
      i: i,
      line: sample[i],
      truth: truth[0],
      truth_frustrated: truth[1],
      category: got.category,
      frustrated: got.frustrated,
      correct: correct,
      frustrated_correct: frustratedCorrect
    });
    process.stdout.write((correct ? "." : "X") + (frustratedCorrect ? "" : "!") + " (" + (i + 1) + "/" + sample.length + ")\n");
    if (i + 1 < sample.length) await sleep(2100);
  }

  const n = results.length;
  const confusion = {};
  results.filter(r => !r.correct).forEach(r => {
    const k = r.truth + " -> " + r.category;
    confusion[k] = (confusion[k] || 0) + 1;
  });
  const perClass = {};
  CATS.forEach(k => {
    const mine = results.filter(r => r.truth === k);
    if (mine.length) perClass[k] = mine.filter(r => r.correct).length + "/" + mine.length;
  });

  console.log("\n=== GROQ FREE PLAN (not Jev) ===");
  console.log("model:", MODEL);
  console.log("category accuracy:", cats + "/" + n, "=", (100 * cats / n).toFixed(1) + "%");
  console.log("frustration accuracy:", frus + "/" + n, "=", (100 * frus / n).toFixed(1) + "%");
  console.log("confusion:", JSON.stringify(confusion));
  console.log("per-class:", JSON.stringify(perClass));

  const out = {
    date: new Date().toISOString(),
    provider: "groq",
    model: MODEL,
    not_jev: true,
    sample_size: n,
    category_correct: cats,
    frustration_correct: frus,
    category_accuracy: cats / n,
    frustration_accuracy: frus / n,
    confusion: confusion,
    perClass: perClass,
    results: results
  };
  fs.writeFileSync(path.join(__dirname, "free_results.json"), JSON.stringify(out, null, 2));
  console.log("written tools/free_results.json");
}

main().catch(e => { console.error(e.message || e); process.exit(1); });
