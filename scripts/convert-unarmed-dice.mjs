/**
 * Homebrew: Martial Arts I/II/III and the gloves each add a whole DIE of unarmed damage rather
 * than stepping the die size. A Medium brawler runs 1d6 -> 2d6 -> 3d6 -> 4d6, and 5d6 with a
 * pair of gloves on top.
 *
 * Before this, Martial Arts used `bonusUnarmedDamageDieSize` (1d4 -> 1d6 -> 1d8 -> 1d10) and the
 * gloves used `unarmedBonusDamage`, which resolves to a flat numeric bonus — Combat Gloves added
 * "+1", not a die.
 *
 * Per the homebrew Simple Weapons table, each pair of gloves also carries its own damage type:
 * Combat = Physical, Power = Energy, Shock = Stun.
 *
 * Run with --write to apply; dry-run by default.
 */
import fs from "fs";
import path from "path";

const SOURCE = path.join(process.cwd(), "packs", "_source");
const WRITE = process.argv.includes("--write");

// name -> damage type (undefined = a feat, which stacks and doesn't retype the attack)
const TARGETS = {
    "Martial Arts I": undefined,
    "Martial Arts II": undefined,
    "Martial Arts III": undefined,
    "Combat Gloves": "Physical",
    "Power Gloves": "Energy",
    "Shock Gloves": "Stun",
};

// Feats stack, so they sum; gear does not, so it is reduced with MAX and needs its own key.
const FEAT_DIE_KEY = "bonusUnarmedDamageDieCount";
const GEAR_DIE_KEY = "unarmedGearDamageDieCount";

// The keys this replaces — the old die-size step, the old flat bonus, and earlier passes of this
// same script (so it stays re-runnable without piling up duplicates).
const REPLACED_KEYS = ["bonusUnarmedDamageDieSize", "unarmedBonusDamage", "damageType",
    "unarmedDamageType", FEAT_DIE_KEY, GEAR_DIE_KEY];

let changed = 0;
for (const dir of fs.readdirSync(SOURCE)) {
    const dirPath = path.join(SOURCE, dir);
    if (!fs.statSync(dirPath).isDirectory()) continue;

    for (const file of fs.readdirSync(dirPath)) {
        const full = path.join(dirPath, file);
        const doc = JSON.parse(fs.readFileSync(full, "utf8"));
        if (!(doc.name in TARGETS)) continue;

        const changes = doc.system.changes || [];
        const before = JSON.stringify(changes);

        // Drop the old mechanisms, then add exactly one die on the appropriate key.
        const kept = changes.filter(c => !REPLACED_KEYS.includes(c.key));
        const damageType = TARGETS[doc.name];
        kept.push({mode: 2, value: 1, key: damageType ? GEAR_DIE_KEY : FEAT_DIE_KEY});

        // Its own key, not plain `damageType` — a weapon may only retype the wearer's unarmed
        // attack, and `damageType` would also describe the gloves as a weapon in their own right.
        if (damageType) kept.push({mode: 2, value: damageType, key: "unarmedDamageType"});

        doc.system.changes = kept;
        if (before !== JSON.stringify(kept)) changed++;
        console.log(`${dir}/${doc.name}`);
        console.log(`   before: ${before}`);
        console.log(`   after:  ${JSON.stringify(kept)}`);
        if (WRITE) fs.writeFileSync(full, JSON.stringify(doc, null, 2) + "\n");
    }
}

console.log(`\n${WRITE ? "APPLIED" : "DRY RUN"} — ${changed} item(s) changed.`);
if (!WRITE) console.log("Re-run with --write to apply.");
