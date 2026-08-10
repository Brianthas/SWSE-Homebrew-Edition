// The original wiki scrape dumped whole pages into the description slot of skillReRoll changes.
// A skillReRoll value is "skill:condition:description" - the parser splits on ":" so these still
// "work", but the description is thousands of characters of unrelated talent-tree prose, which
// ends up in skill tooltips and bloats the packs.
//
// Rebuilds the description from the item's OWN rules text: the sentence that actually talks about
// rerolling. Falls back to the item name if no such sentence is found, so nothing is left holding
// a scraped page. skill/condition are preserved exactly.
//
// Usage: node scripts/fix-skillreroll-descriptions.mjs [--write] [--threshold=300]
import fs from "node:fs";
import path from "node:path";

const WRITE = process.argv.includes("--write");
const THRESHOLD = Number((process.argv.find(a => a.startsWith("--threshold=")) || "--threshold=300").split("=")[1]);
const SOURCE = "packs/_source";

const strip = (html) => (html || "")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/g, " ")
  .replace(/&[a-z]+;/g, " ")
  .replace(/\s+/g, " ")
  .trim();

// The item's own reroll rule, preferring a sentence that mentions rerolling.
function deriveDescription(doc) {
  const text = strip(doc.system?.description);
  if (!text) return null;
  const sentences = text.split(/(?<=\.)\s+/);
  const reroll = sentences.filter(s => /\brerol|\bre-rol/i.test(s));
  const picked = (reroll.length ? reroll : sentences).slice(0, 2).join(" ").trim();
  if (!picked || picked.length > 400) return picked ? picked.slice(0, 400).trim() : null;
  return picked;
}

let scanned = 0, fixed = 0, unfixable = [];

for (const dirName of fs.readdirSync(SOURCE)) {
  const dir = path.join(SOURCE, dirName);
  if (!fs.statSync(dir).isDirectory()) continue;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".json")) continue;
    const p = path.join(dir, f);
    let doc;
    try { doc = JSON.parse(fs.readFileSync(p, "utf8")); } catch { continue; }
    const changes = Array.isArray(doc.system?.changes) ? doc.system.changes : null;
    if (!changes) continue;

    let touched = false;
    for (const c of changes) {
      if (c.key !== "skillReRoll") continue;
      const value = String(c.value ?? "");
      if (value.length <= THRESHOLD) continue;
      scanned++;

      const parts = value.split(":");
      const skill = parts[0] ?? "any";
      const condition = parts[1] ?? "unknown";
      const derived = deriveDescription(doc);
      if (!derived) { unfixable.push(`${dirName}/${doc.name}`); continue; }

      c.value = `${skill}:${condition}:${derived}`;
      touched = true;
      fixed++;
    }
    if (touched && WRITE) fs.writeFileSync(p, JSON.stringify(doc, null, 2) + "\n");
  }
}

console.log(`${WRITE ? "Applied" : "[dry-run]"}: ${fixed} of ${scanned} oversized skillReRoll descriptions rebuilt (threshold ${THRESHOLD} chars).`);
if (unfixable.length) {
  console.log(`No usable rules text (left unchanged): ${unfixable.length}`);
  unfixable.slice(0, 10).forEach(u => console.log("  " + u));
}
