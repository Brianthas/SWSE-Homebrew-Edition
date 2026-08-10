// One-off migration: replace legacy prerequisite-gated "droidUnarmedDamage" entries on the
// standard droid limb items (Probe/Instrument/Tool/Claw/Hand) with the single-key
// "droidUnarmedDamageScalable" entry, matching item.mjs's own resolveWarning
// "cleanup-droidUnarmedDamage" button exactly. Verified via classify-droid-limbs.js that this is
// lossless: every affected item's per-size resolved value is identical before/after.
// Usage: node scripts/migrate-droid-unarmed-damage.mjs [--write]
import fs from "node:fs";
import path from "node:path";

const WRITE = process.argv.includes("--write");

const MEDIUM_DIE_BY_NAME = {Probe: "1", Instrument: "1d2", Tool: "1d3", Claw: "1d4", Hand: "1d3"};
function mediumDieFor(name) {
  return MEDIUM_DIE_BY_NAME[name] ?? "1d6";
}

let filesChanged = 0;
let itemsChanged = 0;

for (let cl = 0; cl <= 20; cl++) {
  const dir = `packs/_source/units-cl-${cl}`;
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".json")) continue;
    const filePath = path.join(dir, f);
    const raw = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(raw);
    let fileTouched = false;

    for (const item of data.items ?? []) {
      if (!["Probe", "Instrument", "Tool", "Claw", "Hand"].includes(item.name)) continue;
      const changes = item.system?.changes;
      if (!Array.isArray(changes)) continue;
      if (!changes.some(c => c.key === "droidUnarmedDamage")) continue;

      const kept = changes.filter(c => c.key !== "droidUnarmedDamage");
      kept.push({key: "droidUnarmedDamageScalable", value: mediumDieFor(item.name), mode: 2});
      item.system.changes = kept;

      fileTouched = true;
      itemsChanged++;
    }

    if (fileTouched) {
      filesChanged++;
      if (WRITE) {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
      }
    }
  }
}

console.log(`${WRITE ? "Applied" : "[dry-run]"}: ${itemsChanged} items changed across ${filesChanged} files.`);
