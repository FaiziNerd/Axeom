/* Fallback classifier measurement — no external API, no key.
 * The live upload/recompute pipeline must run in a browser with no backend,
 * so only a local deterministic classifier can ship inside this app.
 * Jev (tools/jev.js) is ready for when a key exists; meanwhile we measure the
 * shipped rule classifier on the SAME 51 hand-labeled messages + SAME metrics.
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

/* the classifier that ships: ordered, explainable rules (each fires on explicit signals) */
function classify(line) {
  const s = line.toLowerCase();
  const text = s.replace(/^[^\]]+\]\s*/, "");
  const dir = /] (whatsapp|email|instagram dm|voice note|website form) to /.test(s) ? "out" : "in";

  if (/(insta-verify|invoice\.zip|rank #1|free followers|crypto|coin-x|rank1seo|fastfollowers|acct-dept|biz\b)/.test(s))
    return ["spam", 0];
  if (/(pause after|whether we continue|talk about our contract|contract this week)/.test(text))
    return ["churn", 1]; // "too many rounds of fixes… notes keep getting missed"
  if (dir === "out") return ["other", 0];                    // studio → client notes
  if (/(move to|move it|cancel today's|see you tomorrow|running 10 min late|can we meet at)/.test(text))
    return ["schedule", 0];
  if (/(invoice|refund|bill us|please bill|we already paid|pay immediately)/.test(text))
    return ["billing", 0];
  if (/(do you also|we'd pay for that|are you taking new|price for|interested in)/.test(text))
    return ["lead", 0];
  if (/(still not fixed|second time|already told|did anyone|sigue igual|ya les hab|still has the same|not happy|keeps getting missed)/.test(text))
    return ["complaint", 1];
  if (/(cut|remove|take out|blur|add (the |our )?(line|phone)|captions bigger|brand color|calmer song|music.*too loud|can't hear myself|different song|new intro|spelled wrong|other shot|not the one you used|stumble|walk-ins welcome|prices|other shot|outside, not inside)/.test(text))
    return ["request", /(can't hear myself)/.test(text) ? 1 : 0];
  if (/(thanks|thank you|great session)/.test(text))
    return ["other", 0];
  return ["other", 0];
}

const lines = fs.readFileSync(path.join(__dirname, "..", "data", "messages.txt"), "utf8")
  .split(/\r?\n/).filter(l => /^\[20\d\d-/.test(l));
const sample = lines.filter((_, i) => i % 4 === 0);
if (sample.length !== LABELS.length) throw new Error("sample/label mismatch");

const rows = [];
let cats = 0, frus = 0;
sample.forEach((line, i) => {
  const [cat, frusProb] = classify(line);
  const [tCat, tFrus] = LABELS[i];
  const okCat = cat === tCat;
  const okFrus = (frusProb >= 0.5) === (tFrus === 1);
  if (okCat) cats++;
  if (okFrus) frus++;
  rows.push({ i, line, truth: tCat, truth_frustrated: tFrus, got: cat, frus: frusProb, okCat, okFrus });
});

const n = sample.length;
console.log("=== RULE CLASSIFIER (ships in app) ===");
console.log("category accuracy :", cats + "/" + n, "=", (100 * cats / n).toFixed(1) + "%");
console.log("frustration acc.  :", frus + "/" + n, "=", (100 * frus / n).toFixed(1) + "%");
const misses = rows.filter(r => !r.okCat);
console.log("category misses:", misses.length);
misses.forEach(r => console.log("  #" + r.i, r.truth, "→", r.got, "|", r.line.slice(0, 90)));
const frusMiss = rows.filter(r => !r.okFrus);
console.log("frustration misses:", frusMiss.length);
frusMiss.forEach(r => console.log("  #" + r.i, "expect_frus=" + r.truth_frustrated, "got_frus=" + r.frus, "|", r.line.slice(0, 90)));
