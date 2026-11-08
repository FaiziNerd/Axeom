/* Label every inbox line with Groq. This is the completed stand-in for Jev.
 * Reuses the 51 lines already measured in tools/free_results.json.
 * Reads GROQ_API_KEY from the environment and never writes the key.
 *
 *   node tools/label_inbox.js
 *
 * Writes app/js/labels.js and tools/inbox_labels.json.
 */
const fs = require("fs");
const path = require("path");

const CATS = ["request", "complaint", "billing", "churn", "lead", "schedule", "spam", "other"];
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
const MODEL = "openai/gpt-oss-20b";
const partialPath = path.join(__dirname, "inbox_partial.json");

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function ask(key, msg) {
  const criteria = CATS.map(k => k + ": " + CRITERIA[k]).join("\n");
  const body = {
    model: MODEL,
    temperature: 0,
    messages: [
      { role: "system", content: "You label one inbox line for a video studio. Reply with JSON only.\n" + criteria },
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
    console.error("GROQ_API_KEY is not set.");
    process.exit(2);
  }
  const lines = fs.readFileSync(path.join(__dirname, "..", "data", "messages.txt"), "utf8")
    .split(/\r?\n/).map(l => l.trim()).filter(l => /^\[20\d\d-/.test(l));
  const known = {};
  const prev = JSON.parse(fs.readFileSync(path.join(__dirname, "free_results.json"), "utf8"));
  prev.results.forEach(r => { known[r.line.trim()] = { category: r.category, frustrated: !!r.frustrated }; });

  let done = {};
  if (fs.existsSync(partialPath)) done = JSON.parse(fs.readFileSync(partialPath, "utf8"));

  let called = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (done[line]) continue;
    if (known[line]) {
      done[line] = known[line];
      continue;
    }
    const got = await ask(key, line);
    done[line] = { category: got.category, frustrated: !!got.frustrated };
    called++;
    fs.writeFileSync(partialPath, JSON.stringify(done));
    console.log((i + 1) + "/" + lines.length, got.category);
    await sleep(2100);
  }

  const missing = lines.filter(l => !done[l]);
  if (missing.length) throw new Error("unlabeled lines: " + missing.length);

  const ordered = {};
  lines.forEach(l => { ordered[l] = done[l]; });
  const js = "window.AXEOM_LABELS = " + JSON.stringify(ordered) + ";\n";
  fs.writeFileSync(path.join(__dirname, "..", "app", "js", "labels.js"), js);
  fs.writeFileSync(path.join(__dirname, "inbox_labels.json"), JSON.stringify({
    provider: "groq",
    model: MODEL,
    replaces: "jev",
    labeled: lines.length,
    reused_measured_sample: Object.keys(known).length,
    fresh_calls: called
  }, null, 2));
  if (fs.existsSync(partialPath)) fs.unlinkSync(partialPath);
  console.log("labeled", lines.length, "fresh calls", called);
}

main().catch(e => { console.error(e.message || e); process.exit(1); });
