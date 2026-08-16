// One-time cleanup: removes wholly wiki-invented "Homebrew Content" (Star Wars Saga Edition wiki
// community content bundled into the base compendium) - distinct from tovec's homebrew rules,
// which this fork is deliberately built around and stays untouched, and distinct from official
// content that merely carries a homebrew *alteration* bolted onto its description (e.g. Autofire
// Sweep - a real Legacy Era Campaign Guide feat with a "Homebrew Autofire Sweep Data" balance-tweak
// addendum; deleting those would destroy real official content over a banner that only applies to
// the addendum).
//
// Every candidate must contain the exact banner sentence the wiki stamps on unreviewed pages
// ("This Homebrew Content has not been reviewed in a meaningful manner..."). That alone isn't
// enough - the wiki tags entire subsystems as "unreviewed" regardless of whether the specific page
// is official or fan content (confirmed: a bare substring match or the isHomebrew changes-key alone
// flagged "The New Republic" affiliation, vehicle systems, all talents). A second, per-pack signal
// distinguishes "official base + homebrew addendum" (keep) from "wholly wiki-invented" (delete):
//
//   - species (kept as originally shipped, not retroactively changed): banner position alone -
//     what fraction of the (tag-stripped) description precedes the banner. A late banner means real
//     species fluff/stats came first (Aqualish's banner sits under a "Homebrew Aqualish Subspecies"
//     sub-heading at 65% through the page, after the real Species Traits section); an early banner
//     (202 of 391 species at ~0%) means the whole page - fluff and game stats both - is
//     wiki-authored from the top (e.g. Chevin: real/recognizable species, fan-written SWSE crunch
//     since WotC never officially statted it). Bryan confirmed deleting both real-species-fan-crunch
//     and wholly-fabricated races rather than scoping to a canon cross-check.
//   - default (every other pack): keep if EITHER (a) a genuine pre-banner "Reference Book:"
//     citation exists - NOT "Homebrew Reference Book:", the wiki's own label for attributing where
//     a wholly-invented page's *idea* came from (often a fan sourcebook); no fixed book-title
//     whitelist, trusting the wiki's own convention generalizes better (confirmed: legacy-weapon's
//     "Stealth Blaster Carbine" cites "Dawn of Defiance," a real official web-series never seen in
//     the feats pack - a feats-derived whitelist would have wrongly deleted it) - OR (b) the
//     *effective* banner position (see below) is ≥5% through the page.
//     Plain banner position isn't reliable enough alone here, unlike species: equipment's "Utility
//     Belt" (real Core Rulebook item) has genuine stats before a "Homebrew Notes" heading discussing
//     a fan-speculated errata fix, no formal Reference Book citation - but equipment's "Polarized
//     Lenses" has "Homebrew Reference Book: Clone Wars Saga Edition Fan Sourcebook" sitting directly
//     before the banner, which inflates its raw position (11%) despite being wholly invented. Fix:
//     find the nearest standalone "Homebrew" marker within 150 chars before the banner (catches
//     "Homebrew Reference Book:" and "Homebrew ___ Notes/Data/Subspecies" headings alike) and
//     measure position from THAT point instead of the raw banner index - Polarized Lenses correctly
//     drops to 0%, Utility Belt stays at 30% (its "Homebrew Notes" heading comes well after the real
//     item stats). This still isn't perfect: legacy-weapon's "Chain" and "Composite Homing Laser"
//     are disambiguation notices ("You may be looking for the Core Rulebook item of the same name")
//     that also mention "Homebrew" early, so their effective position (10%/7%) still clears the
//     threshold - caught those two by hand-reading instead, not algorithmically. Anything the
//     effective-position check flags as a keep candidate should still be spot-read before trusting
//     it, same as this class of item was every time so far.
//
// Usage:
//   node scripts/delete-homebrew-content.mjs --dry-run   (also runs the reference check)
//   node scripts/delete-homebrew-content.mjs             (deletes for real)
import {readFileSync, readdirSync, unlinkSync} from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const SOURCE_DIR = path.join(REPO_ROOT, "packs", "_source");

const TARGET_PACKS = ["feats", "species", "legacy-weapon", "equipment", "affiliations",
    "force-powers", "force-regimens", "force-regimes", "force-techniques", "hazard",
    "implant", "starship-maneuvers", "templates", "upgrade", "vehicle-systems"];

// Packs known to need manual review before deletion (see report at the bottom) - dry-run always
// computes and reports these. All packs below were reviewed and approved by Bryan; nothing is
// currently held. Re-populate this set before scoping a new pack in the future.
const HOLD_FOR_REVIEW = new Set([]);

// The raw HTML wraps both "Homebrew Content" and "Untested" in <a> tags, so the banner sentence
// is never a contiguous substring of the raw description - strip tags first (matches the visible
// text a wiki reader would actually see, links included) before matching.
const BANNER = "This Homebrew Content has not been reviewed in a meaningful manner. If you wish to review this content yourself, then see Untested for more details.";

function normalizeDescription(desc) {
    return (desc || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

// Fraction of the description that must precede the (effective, for non-species packs) banner
// position to count as official-base-plus-addendum (keep). Calibrated against real data: species'
// 5 genuine keeps (Aqualish 65%, Gorax 5%, Rakata 92%, Shard 72%, Teek 6%) all clear this; the
// other 202 species sit at ~0%. Reused as the default-branch threshold too (see header comment).
const LATE_BANNER_THRESHOLD = 0.05;

const dryRun = process.argv.includes("--dry-run");

function changesArray(doc) {
    const changes = doc.system?.changes;
    if (!changes) return [];
    return Array.isArray(changes) ? changes : Object.values(changes);
}

// Nearest standalone "Homebrew" marker within 150 chars before the banner (catches "Homebrew
// Reference Book:" and "Homebrew ___ Notes/Data/Subspecies" headings) - see header comment.
function effectiveBannerIndex(norm, bannerIdx) {
    const searchStart = Math.max(0, bannerIdx - 150);
    const window = norm.slice(searchStart, bannerIdx);
    let idx = -1, searchPos = 0;
    while (true) {
        const found = window.indexOf("Homebrew", searchPos);
        if (found === -1) break;
        idx = found;
        searchPos = found + 1;
    }
    return idx === -1 ? bannerIdx : searchStart + idx;
}

function isWhollyInvented(doc, pack) {
    const norm = normalizeDescription(doc.system?.description);
    const bannerIdx = norm.indexOf(BANNER);
    if (bannerIdx === -1) return false;
    const before = norm.slice(0, bannerIdx);

    if (pack === "species") {
        return (bannerIdx / norm.length) < LATE_BANNER_THRESHOLD;
    }

    if (/(?<!Homebrew )Reference Book:/.test(before)) return false;
    const effIdx = effectiveBannerIndex(norm, bannerIdx);
    return (effIdx / norm.length) < LATE_BANNER_THRESHOLD;
}

function allPackDirs() {
    return readdirSync(SOURCE_DIR, {withFileTypes: true})
        .filter(d => d.isDirectory())
        .map(d => d.name);
}

const candidates = []; // {pack, file, name, filePath}
for (const pack of TARGET_PACKS) {
    const dir = path.join(SOURCE_DIR, pack);
    for (const f of readdirSync(dir)) {
        const filePath = path.join(dir, f);
        const doc = JSON.parse(readFileSync(filePath, "utf8"));
        if (isWhollyInvented(doc, pack)) {
            candidates.push({pack, file: f, name: doc.name, filePath});
        }
    }
}

const candidateNames = new Set(candidates.map(c => c.name));

// Scan EVERY pack for any reference to a candidate's name, so we can report what breaks -
// informational only, deletion proceeds regardless (Bryan confirmed accepting the fallout).
const references = [];

const NAME_REFERENCING_PREREQ_TYPES = new Set([
    "FEAT", "TALENT", "TRAIT", "SPECIES", "TEMPLATE", "CLASS", "TRADITION",
    "FORCE POWER", "FORCE SECRET", "FORCE TECHNIQUE", "BEAST_ATTACK"
]);

function checkReferences(doc, pack, file) {
    const hits = [];
    const providedItems = doc.system?.providedItems;
    const providedItemsList = providedItems ? (Array.isArray(providedItems) ? providedItems : Object.values(providedItems)) : [];
    for (const pi of providedItemsList) {
        if (pi?.name && candidateNames.has(pi.name)) hits.push({referencedName: pi.name, via: "providedItems"});
    }
    const walkPrereq = (prereq) => {
        if (!prereq) return;
        if (prereq.requirement && NAME_REFERENCING_PREREQ_TYPES.has(prereq.type) && candidateNames.has(prereq.requirement)) {
            hits.push({referencedName: prereq.requirement, via: `prerequisite.requirement (${prereq.type})`});
        }
        if (prereq.child) walkPrereq(prereq.child);
        if (Array.isArray(prereq.children)) prereq.children.forEach(walkPrereq);
        else if (prereq.children) Object.values(prereq.children).forEach(walkPrereq);
    };
    walkPrereq(doc.system?.prerequisite);
    for (const change of changesArray(doc)) {
        if (change.key === "provides" && candidateNames.has(change.value)) {
            hits.push({referencedName: change.value, via: "changes.provides"});
        }
    }
    for (const hit of hits) {
        references.push({referencingPack: pack, referencingFile: file, referencingName: doc.name, ...hit});
    }
}

for (const pack of allPackDirs()) {
    const dir = path.join(SOURCE_DIR, pack);
    for (const f of readdirSync(dir)) {
        const filePath = path.join(dir, f);
        const doc = JSON.parse(readFileSync(filePath, "utf8"));
        checkReferences(doc, pack, f);
    }
}

const candidateFileSet = new Set(candidates.map(c => `${c.pack}/${c.file}`));
const realReferences = references.filter(r => !candidateFileSet.has(`${r.referencingPack}/${r.referencingFile}`));

console.log(`${dryRun ? "[dry-run] " : ""}${candidates.length} candidates for deletion:`);
const byPack = {};
for (const c of candidates) byPack[c.pack] = (byPack[c.pack] || 0) + 1;
for (const [pack, count] of Object.entries(byPack)) console.log(`  ${pack}: ${count}`);

if (realReferences.length) {
    console.log(`\n${realReferences.length} references found (non-deleted item -> a candidate being deleted) - these will go dangling:`);
    for (const r of realReferences) {
        console.log(`  ${r.referencingPack}/${r.referencingFile} ("${r.referencingName}") -> "${r.referencedName}" via ${r.via}`);
    }
} else {
    console.log(`\nNo references found from surviving content into the deletion candidates.`);
}

if (!dryRun) {
    const onHold = candidates.filter(c => HOLD_FOR_REVIEW.has(c.pack));
    const toDelete = candidates.filter(c => !HOLD_FOR_REVIEW.has(c.pack));
    if (onHold.length) {
        console.log(`\n${onHold.length} candidates skipped - pack(s) held for manual review, not yet approved: ${[...new Set(onHold.map(c => c.pack))].join(", ")}`);
    }
    for (const c of toDelete) {
        unlinkSync(c.filePath);
    }
    console.log(`\nDeleted ${toDelete.length} files.`);
} else {
    console.log(`\nRe-run without --dry-run to delete (packs held for review are skipped even then: ${[...HOLD_FOR_REVIEW].join(", ")}).`);
}
