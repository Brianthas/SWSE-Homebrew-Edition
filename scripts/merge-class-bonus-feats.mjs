// Homebrew: "There is no longer a list of feats per class. Characters may choose to train in any
// feat they qualify for when gaining a non-specified feat from any source."
//
// Base classes grant a feat at every even level (2/4/6/8/...). In the vanilla data those grants
// feed a separate per-class pool ("Jedi Bonus Feats", "Soldier Bonus Feats", ...) because vanilla
// restricted them to a class-specific feat list. Under the homebrew that restriction is gone, so
// the split is meaningless - and actively misleading, because the sheet then reports e.g.
// "General Feats: 5" and "Jedi Bonus Feats: 3" instead of the 8 feats the character can actually
// take. This repoints those grants at the shared "General Feats" pool.
//
// Prestige classes are untouched: they don't grant even-level feats at all.
// Usage: node scripts/merge-class-bonus-feats.mjs [--write]
import fs from "node:fs";
import path from "node:path";

const WRITE = process.argv.includes("--write");
const DIR = "packs/_source/classes";

let filesChanged = 0, grantsChanged = 0;

for (const f of fs.readdirSync(DIR)) {
  if (!f.endsWith(".json")) continue;
  const p = path.join(DIR, f);
  const doc = JSON.parse(fs.readFileSync(p, "utf8"));

  const changes = Array.isArray(doc.system.changes)
    ? doc.system.changes
    : Object.values(doc.system.changes || {});
  const isPrestige = changes.find(c => c && c.key === "isPrestige")?.value;
  if (isPrestige === true || isPrestige === "true") continue;

  let touched = false;
  for (const effect of doc.effects || []) {
    for (const ch of effect.system?.changes || []) {
      if (ch.key === "provides" && /^.+ Bonus Feats$/.test(ch.value ?? "")) {
        ch.value = "General Feats";
        grantsChanged++;
        touched = true;
      }
    }
  }

  if (touched) {
    filesChanged++;
    if (WRITE) fs.writeFileSync(p, JSON.stringify(doc, null, 2) + "\n");
  }
}

console.log(`${WRITE ? "Applied" : "[dry-run]"}: ${grantsChanged} level-grants repointed to "General Feats" across ${filesChanged} base classes.`);
