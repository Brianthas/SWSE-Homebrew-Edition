// One-off rename: "Advanced Melee Weapons" -> "Advanced Melee" across every packs/_source JSON
// file (weapon subtype values, proficiency/prerequisite text, embedded NPC copies, etc).
// Exact literal string replace only - confirmed no separate singular "Advanced Melee Weapon"
// form exists anywhere that could be mismatched.
// Usage: node scripts/rename-advanced-melee.mjs [--write]
import fs from "node:fs";
import path from "node:path";

const WRITE = process.argv.includes("--write");
const SOURCE_DIR = "packs/_source";
const FROM = "Advanced Melee Weapons";
const TO = "Advanced Melee";

let filesChanged = 0;
let totalReplacements = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (entry.name.endsWith(".json")) processFile(p);
  }
}

const touchedFiles = [];
function processFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  if (!raw.includes(FROM)) return;
  const count = raw.split(FROM).length - 1;
  const updated = raw.split(FROM).join(TO);
  filesChanged++;
  totalReplacements += count;
  touchedFiles.push(filePath);
  if (WRITE) fs.writeFileSync(filePath, updated);
}

walk(SOURCE_DIR);
console.log(`${WRITE ? "Applied" : "[dry-run]"}: ${totalReplacements} replacements across ${filesChanged} files.`);
const packs = [...new Set(touchedFiles.map(f => f.split(path.sep)[2]))].sort();
console.log("Touched packs:", packs.join(", "));
