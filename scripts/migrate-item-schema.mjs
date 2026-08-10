// Promotes generic system.changes entries onto real typed schema fields for a given item
// type, per the Item Schema & Sheet Overhaul plan (Track A). Reuses PROMOTED_FIELDS/
// UNIVERSAL_ITEM_FIELDS from module/item/default-changes.mjs as the single source of truth
// shared with the runtime defaultChanges dispatcher — so what gets migrated here is exactly
// what defaultChanges will synthesize back at runtime.
//
// Only touches each item's own top-level system.changes array — never effects[].system.changes
// (mode/form-switching weapons like the Amphistaff keep their per-mode overrides untouched).
//
// Usage:
//   node scripts/migrate-item-schema.mjs --type=weapon [--dry-run]
import {readFileSync, writeFileSync, readdirSync} from "node:fs";
import path from "node:path";
import {PROMOTED_FIELDS, UNIVERSAL_ITEM_FIELDS} from "../module/item/default-changes.mjs";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const SOURCE_DIR = path.join(REPO_ROOT, "packs", "_source");

// Which item types' packs to touch, and which promoted keys should be concatenated (not
// warned about) when an item legitimately has more than one entry for that key, plus the
// separator to join with:
//  - specialQualities: e.g. the Amphistaff has two separate top-level "special" notes (venom
//    spit + weapon-form switching) — these are read as prose, so join with paragraph breaks.
//  - damageType: dual-damage-type weapons are a real, common pattern (many lightsabers deal
//    both "Energy" and "Slashing", confirmed 47 legacy weapons have exactly this shape) — the
//    existing runtime reader already does attributes.join(', ') for display (attack.mjs
//    get type()), so match that separator here.
const MIGRATIONS = {
    weapon: {
        packs: ["weapon", "legacy-weapon"],
        joinOnConflict: {specialQualities: "\n\n", damageType: ", "}
    },
    armor: {
        packs: ["armor"],
        joinOnConflict: {}
    },
    equipment: {
        packs: ["equipment"],
        joinOnConflict: {specialQualities: "\n\n"}
    },
    upgrade: {
        packs: ["upgrade"],
        joinOnConflict: {}
    },
    implant: {
        packs: ["implant"],
        joinOnConflict: {}
    },
    "droid system": {
        packs: ["droid-system"],
        joinOnConflict: {}
    },
    vehicleSystem: {
        packs: ["vehicle-systems"],
        joinOnConflict: {}
    }
};

const [, , ...rawArgs] = process.argv;
const flags = Object.fromEntries(rawArgs.filter(a => a.startsWith("--")).map(a => {
    const [k, v] = a.slice(2).split("=");
    return [k, v ?? true];
}));

const type = flags.type;
const dryRun = !!flags["dry-run"];

if (!type || !MIGRATIONS[type]) {
    console.error(`Usage: node scripts/migrate-item-schema.mjs --type=<${Object.keys(MIGRATIONS).join("|")}> [--dry-run]`);
    process.exit(1);
}

const config = MIGRATIONS[type];
const promoteMap = PROMOTED_FIELDS[type] || {};
// changeKey -> systemField, reverse of PROMOTED_FIELDS' systemField -> changeKey
const changeKeyToField = Object.fromEntries(Object.entries(promoteMap).map(([field, key]) => [key, field]));
const joinSeparators = config.joinOnConflict || {};

let filesChanged = 0;
let totalPromoted = 0;
let totalStripped = 0;
const conflicts = [];

for (const packName of config.packs) {
    const packDir = path.join(SOURCE_DIR, packName);
    const files = readdirSync(packDir).filter(f => f.endsWith(".json"));

    for (const fileName of files) {
        const filePath = path.join(packDir, fileName);
        const raw = readFileSync(filePath, "utf8");
        const doc = JSON.parse(raw);
        const changes = doc.system?.changes;
        if (!Array.isArray(changes) || changes.length === 0) {
            continue;
        }

        const keep = [];
        // changeKey -> [values...] for every key this migration cares about
        const byKey = new Map();
        for (const change of changes) {
            const isUniversal = UNIVERSAL_ITEM_FIELDS.includes(change.key);
            const isPromoted = change.key in changeKeyToField;
            if (isUniversal || isPromoted) {
                if (!byKey.has(change.key)) byKey.set(change.key, []);
                byKey.get(change.key).push(change.value);
            } else {
                keep.push(change);
            }
        }

        if (byKey.size === 0) {
            continue;
        }

        let fileChanged = false;
        const summary = [];

        for (const [changeKey, values] of byKey) {
            const systemField = UNIVERSAL_ITEM_FIELDS.includes(changeKey) ? changeKey : changeKeyToField[changeKey];
            let finalValue = values[0];

            if (values.length > 1) {
                const unique = [...new Set(values.map(v => JSON.stringify(v)))];
                if (unique.length === 1) {
                    // identical duplicates, harmless
                } else if (systemField in joinSeparators) {
                    finalValue = values.join(joinSeparators[systemField]);
                } else {
                    conflicts.push({file: fileName, key: changeKey, values});
                    continue; // leave the raw entries alone, don't promote a guess
                }
            }

            doc.system[systemField] = finalValue;
            summary.push(`${changeKey} -> system.${systemField}`);
            totalPromoted++;
            fileChanged = true;
        }

        if (fileChanged) {
            const removedCount = changes.length - keep.length;
            totalStripped += removedCount;
            doc.system.changes = keep;
            filesChanged++;
            if (dryRun) {
                console.log(`[dry-run] ${packName}/${fileName}: ${summary.join(", ")} (stripped ${removedCount} change entries)`);
            } else {
                writeFileSync(filePath, JSON.stringify(doc, null, 2) + "\n");
            }
        }
    }
}

console.log(`\n${dryRun ? "[dry-run] " : ""}${filesChanged} files ${dryRun ? "would be" : "were"} changed, ${totalPromoted} fields promoted, ${totalStripped} change entries stripped.`);

if (conflicts.length) {
    console.log(`\n${conflicts.length} conflicts found (multiple differing values for the same key, left untouched — resolve by hand):`);
    for (const c of conflicts) {
        console.log(`  ${c.file}: "${c.key}" has ${c.values.length} differing values: ${JSON.stringify(c.values)}`);
    }
}

if (dryRun) {
    console.log(`\nRe-run without --dry-run to write changes, then recompile via: node scripts/pack-tools.mjs pack --pack=<name>`);
}
