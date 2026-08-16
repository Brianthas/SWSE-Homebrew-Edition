// One-off migration: mark every units-cl-* actor as system.settings.isNPC = true. These are all
// pre-built NPC/creature stat blocks (that's the entire purpose of the units-cl-* packs), but the
// flag was never set on import - which caused two problems: (1) the PC-leveling-budget validator
// in characterdata.mjs's #_reduceAvailable wrongly checked these actors' bulk-attached talents/feats
// against a slot budget they were never built through, spamming console.error + phantom "Items
// remaining" warnings; (2) token auto-link behavior (actor.mjs ~146-158) treats isNPC as the signal
// for whether a token should auto-link, so unlinked-by-default NPC tokens weren't behaving correctly.
// Usage: node scripts/set-npc-flag.mjs [--write]
import fs from "node:fs";
import path from "node:path";

const WRITE = process.argv.includes("--write");

let filesChanged = 0;

for (let cl = 0; cl <= 20; cl++) {
  const dir = `packs/_source/units-cl-${cl}`;
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".json")) continue;
    const filePath = path.join(dir, f);
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

    data.system.settings = data.system.settings ?? {};
    if (data.system.settings.isNPC === true) continue;

    data.system.settings.isNPC = true;
    filesChanged++;
    if (WRITE) fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
  }
}

console.log(`${WRITE ? "Applied" : "[dry-run]"}: ${filesChanged} actors updated.`);
