/**
 * Remove the age-category traits (Child / Young adult / Adult / Middle age / Old / Venerable)
 * from the game entirely.
 *
 * Why: species granted all six at once as providedItems, each carrying an AGE prerequisite that
 * never resolved - `meetsPrerequisites` reads `target.system.age`, but the field was migrated to
 * `system.details.age` long ago, so the gate never selected a single age band. The traits were
 * granted regardless and every one of their ability modifiers applied simultaneously, totalling
 * STR -10, CON -10, DEX -8, INT/WIS/CHA +1 on any character of an affected species. The
 * age-selection dialog that was meant to drive this has no entry point on the current sheet.
 *
 * Run with --write to apply; dry-run by default.
 */
import fs from "fs";
import path from "path";

const AGE_TRAITS = ["Child", "Young adult", "Adult", "Middle age", "Old", "Venerable"];
const SOURCE = path.join(process.cwd(), "packs", "_source");
const WRITE = process.argv.includes("--write");

/** Age trait files are matched by their `name`, not the filename, to avoid catching look-alikes. */
function ageTraitFiles() {
    const dir = path.join(SOURCE, "traits");
    return fs.readdirSync(dir)
        .map(f => ({file: f, doc: JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"))}))
        .filter(({doc}) => AGE_TRAITS.includes(doc.name));
}

function stripFromSpecies() {
    const dir = path.join(SOURCE, "species");
    let changedFiles = 0, removedEntries = 0;
    for (const file of fs.readdirSync(dir)) {
        const full = path.join(dir, file);
        const doc = JSON.parse(fs.readFileSync(full, "utf8"));
        const provided = doc.system?.providedItems;
        if (!Array.isArray(provided)) continue;

        // Only drop entries that are BOTH a trait and an age name - a species could legitimately
        // provide something else that happens to share a name with an age band.
        const kept = provided.filter(p => !(p.type === "trait" && AGE_TRAITS.includes(p.name)));
        if (kept.length === provided.length) continue;

        removedEntries += provided.length - kept.length;
        changedFiles++;
        doc.system.providedItems = kept;
        if (WRITE) fs.writeFileSync(full, JSON.stringify(doc, null, 2) + "\n");
    }
    return {changedFiles, removedEntries};
}

const traits = ageTraitFiles();
const species = stripFromSpecies();

console.log(`${WRITE ? "APPLIED" : "DRY RUN"}`);
console.log(`  species updated:      ${species.changedFiles} (${species.removedEntries} grants removed)`);
console.log(`  age trait items:      ${traits.length} to delete`);
for (const {file, doc} of traits) {
    const mods = (doc.system.changes || []).map(c => `${c.key.replace("Bonus", "")} ${c.value}`).join(", ");
    console.log(`    - ${doc.name.padEnd(12)} ${mods || "(no modifiers)"}`);
    if (WRITE) fs.unlinkSync(path.join(SOURCE, "traits", file));
}
if (!WRITE) console.log("\nRe-run with --write to apply.");
