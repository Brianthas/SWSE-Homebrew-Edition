// Sync compendium content between the live Foundry test-folder LevelDB packs and
// this repo's git-tracked JSON source (packs/_source). gulpfile.js can't host this:
// its top-level `require('node-sass')` throws on Node 24/Windows (no prebuilt binding
// for this runtime), so gulp itself doesn't load at all right now. Plain script instead.
//
// Usage:
//   node scripts/pack-tools.mjs unpack [--pack=<name>] [--src=<path>]
//   node scripts/pack-tools.mjs pack   [--pack=<name>]
import {compilePack, extractPack} from "@foundryvtt/foundryvtt-cli";
import {readdirSync, mkdirSync, rmSync} from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const PACKS_DIR = path.join(REPO_ROOT, "packs");
const SOURCE_DIR = path.join(PACKS_DIR, "_source");
const DEFAULT_LIVE_PACKS = "C:\\Users\\bryan\\AppData\\Local\\FoundryVTT\\Data\\systems\\swse\\packs";

const [mode, ...rest] = process.argv.slice(2);
const flags = Object.fromEntries(rest.filter(a => a.startsWith("--")).map(a => {
    const [k, v] = a.slice(2).split("=");
    return [k, v ?? true];
}));

function packNames(dir) {
    return readdirSync(dir, {withFileTypes: true})
        .filter(d => d.isDirectory() && d.name !== "_source")
        .map(d => d.name);
}

async function unpack() {
    const liveDir = flags.src || process.env.FOUNDRY_DATA_PATH || DEFAULT_LIVE_PACKS;
    const names = flags.pack ? [flags.pack] : packNames(liveDir);
    for (const name of names) {
        const src = path.join(liveDir, name);
        const dest = path.join(SOURCE_DIR, name);
        try {
            // extractPack only adds/overwrites — it never removes JSON left behind by
            // documents since deleted or renamed in the live pack, so wipe first for a
            // clean 1:1 mirror of current state.
            rmSync(dest, {recursive: true, force: true});
            mkdirSync(dest, {recursive: true});
            await extractPack(src, dest, {log: true});
            console.log(`unpacked ${name}`);
        } catch (e) {
            console.error(`FAILED unpack ${name}: ${e.message}`);
        }
    }
}

async function pack() {
    const names = flags.pack ? [flags.pack] : packNames(SOURCE_DIR);
    for (const name of names) {
        const src = path.join(SOURCE_DIR, name);
        const dest = path.join(PACKS_DIR, name);
        try {
            mkdirSync(dest, {recursive: true});
            await compilePack(src, dest, {log: true});
            console.log(`packed ${name}`);
        } catch (e) {
            console.error(`FAILED pack ${name}: ${e.message}`);
        }
    }
}

if (mode === "unpack") await unpack();
else if (mode === "pack") await pack();
else {
    console.error("Usage: node scripts/pack-tools.mjs <unpack|pack> [--pack=<name>] [--src=<path>]");
    process.exit(1);
}
