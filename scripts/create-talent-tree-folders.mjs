// One-time: groups the `talents` compendium pack into a Foundry Folder per distinct
// `system.talentTree` value, to make browsing/leveling-up easier. Every talent already has
// exactly one `talentTree` string (confirmed via a full-pack scan - no comma-separated
// multi-tree values exist today); this does not attempt to detect or fix real-world talents
// that legitimately belong to more than one tree but only have one document - that needs a
// manual cross-check against the actual tabletop talent-tree tables first (see the plan).
//
// Usage:
//   node scripts/create-talent-tree-folders.mjs --dry-run
//   node scripts/create-talent-tree-folders.mjs
import {readFileSync, writeFileSync, readdirSync} from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const DIR = path.join(REPO_ROOT, "packs", "_source", "talents");

const dryRun = process.argv.includes("--dry-run");

const ID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
function randomId() {
    let id = "";
    for (let i = 0; i < 16; i++) id += ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)];
    return id;
}

const files = readdirSync(DIR).filter(f => f.endsWith(".json"));
const docs = files.map(f => ({file: f, doc: JSON.parse(readFileSync(path.join(DIR, f), "utf8"))}));

const treeNames = [...new Set(docs.map(({doc}) => doc.system.talentTree).filter(Boolean))].sort();

console.log(`${dryRun ? "[dry-run] " : ""}${docs.length} talents, ${treeNames.length} distinct talent trees.`);

const folderIdByTree = {};
for (const name of treeNames) {
    folderIdByTree[name] = randomId();
}

let assigned = 0;
let skipped = 0;
for (const {file, doc} of docs) {
    const tree = doc.system.talentTree;
    if (!tree) {
        skipped++;
        continue;
    }
    doc.folder = folderIdByTree[tree];
    assigned++;
    if (!dryRun) {
        writeFileSync(path.join(DIR, file), JSON.stringify(doc, null, 2) + "\n");
    }
}

console.log(`${assigned} talents assigned to a folder, ${skipped} skipped (no talentTree value).`);

if (!dryRun) {
    for (const name of treeNames) {
        const id = folderIdByTree[name];
        const folderDoc = {
            name,
            sorting: "a",
            folder: null,
            type: "Item",
            _id: id,
            description: "",
            sort: 0,
            color: null,
            flags: {},
            _stats: {
                compendiumSource: null,
                duplicateSource: null,
                coreVersion: "14.365",
                systemId: "swse",
                systemVersion: "13.2.4",
                createdTime: Date.now(),
                modifiedTime: Date.now(),
                lastModifiedBy: null
            },
            _key: `!folders!${id}`
        };
        const safeName = name.replace(/[^a-zA-Z0-9]+/g, "_");
        writeFileSync(path.join(DIR, `_folder_${safeName}_${id}.json`), JSON.stringify(folderDoc, null, 2) + "\n");
    }
    console.log(`${treeNames.length} folder documents written.`);
} else {
    console.log("Re-run without --dry-run to write changes, then recompile via: node scripts/pack-tools.mjs pack --pack=talents");
}
