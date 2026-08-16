// Fixes a systemic data-import artifact: description/textDescription HTML scraped from
// swse.fandom.com dropped whitespace immediately around inline <a>/<b>/<i>/<span>/<strong>/<sup>
// tags. E.g. "any<a href=...>Force Power</a>that" instead of "any <a href=...>Force Power</a> that"
// - renders in the sheet as "anyForce Powerthat", words visibly run together.
//
// Scoped to only three, unambiguous typography rules (derived from grep-sampling ~3000 affected
// files across packs - see plan doc for the full reasoning):
//   1. A word char, or a "closing-style" punctuation mark (,;:.)']) that attaches to the END of
//      the preceding word, immediately followed by an opening inline tag -> insert a space before
//      the tag. Deliberately excludes '(' / '-' / '>' / '"' before the tag: opening-parens and
//      hyphenated-word-continuations are correct with no space ("(Term)", "non-Term"), '>' means
//      markup-to-markup adjacency (e.g. "<b><a...", already correct), and '"' is excluded entirely
//      because it's ambiguous with the JSON string's own opening delimiter, not real prose.
//   2. A closing inline tag immediately followed by a word char or an opening paren -> insert a
//      space after the tag. Deliberately excludes ,.;:)-"'&< after the tag: those are all cases
//      where no space belongs there in real typography (comma/period/semicolon/colon/close-paren
//      attach to the end of the preceding word with no leading space; '-' is a hyphenated-word
//      continuation; '&' starts an HTML entity like &nbsp;; '<' is the start of the next tag).
//   3. Two inline tags directly touching with no text between at all (e.g. "Immobilizing</a><a
//      href=...>Hazards</a>") - neither rule 1 nor 2 fires here since the boundary character on
//      each side is itself a tag delimiter (> then <), not a trigger char.
//
// &nbsp; is protected via placeholder swap before any rule runs, so nothing can ever insert a
// second space next to an entity that's already a space itself.
//
// Only touches system.description / system.textDescription - never runs over the whole raw
// file, so it can't touch a JSON key name or a URL inside an href value.

import fs from "node:fs";
import path from "node:path";

const TARGET_PACKS = ["talents", "upgrade", "vehicle-systems", ...process.argv.slice(2).includes("--npcs")
    ? fs.readdirSync("packs/_source").filter(p => p.startsWith("units-cl-"))
    : []];
const DRY_RUN = !process.argv.includes("--write");

const INLINE_TAGS = "a|b|i|span|strong|sup";
const ADJACENT_RE = new RegExp(`</(${INLINE_TAGS})><(${INLINE_TAGS})([ >])`, "g");
const OPEN_RE = new RegExp(`([A-Za-z0-9,;:.)'\\]])<(${INLINE_TAGS})([ >])`, "g");
const CLOSE_RE = new RegExp(`</(${INLINE_TAGS})>([A-Za-z0-9(])`, "g");
const NBSP_PLACEHOLDER = " NBSP ";

function fixText(text) {
    if (!text || !text.includes("<")) return {fixed: text, changed: false};
    let working = text.split("&nbsp;").join(NBSP_PLACEHOLDER);
    working = working.replace(ADJACENT_RE, "</$1> <$2$3");
    working = working.replace(OPEN_RE, "$1 <$2$3");
    working = working.replace(CLOSE_RE, "</$1> $2");
    working = working.split(NBSP_PLACEHOLDER).join("&nbsp;");
    return {fixed: working, changed: working !== text};
}

let totalFiles = 0, totalChanged = 0, totalInsertions = 0;
const samples = [];

for (const pack of TARGET_PACKS) {
    const dir = path.join("packs/_source", pack);
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter(f => f.endsWith(".json"));
    let packChanged = 0;

    for (const file of files) {
        const filePath = path.join(dir, file);
        const raw = fs.readFileSync(filePath, "utf8");
        const doc = JSON.parse(raw);
        totalFiles++;

        let fileChanged = false;
        // units-cl-* are actor files: fix the actor's own system.description (rare) plus every
        // embedded item's system.description/textDescription (the actual affected content -
        // baked-in copies of talents/feats granted at build time).
        const allTargets = doc.system ? [doc, ...(doc.items || [])] : (doc.items || []);

        for (const target of allTargets) {
            if (!target.system) continue;
            for (const field of ["description", "textDescription"]) {
                const original = target.system[field];
                if (typeof original !== "string") continue;
                const {fixed, changed} = fixText(original);
                if (changed) {
                    const insertions = fixed.length - original.length;
                    totalInsertions += insertions;
                    fileChanged = true;
                    if (samples.length < 15) samples.push({file, field, name: target.name, before: original.slice(0, 400), after: fixed.slice(0, 400)});
                    if (!DRY_RUN) target.system[field] = fixed;
                }
            }
        }

        if (fileChanged) {
            totalChanged++;
            packChanged++;
            if (!DRY_RUN) fs.writeFileSync(filePath, JSON.stringify(doc, null, 2) + "\n", "utf8");
        }
    }
    console.log(`${pack}: ${packChanged}/${files.length} files changed`);
}

console.log(`\nTotal: ${totalChanged}/${totalFiles} files changed, ${totalInsertions} spaces inserted`);
console.log(DRY_RUN ? "\n(dry run - pass --write to apply)" : "\nWritten.");

if (DRY_RUN) {
    console.log("\n--- Sample diffs ---");
    for (const s of samples) {
        console.log(`\n[${s.file}] ${s.name} (${s.field})`);
        console.log("BEFORE:", s.before);
        console.log("AFTER: ", s.after);
    }
}
