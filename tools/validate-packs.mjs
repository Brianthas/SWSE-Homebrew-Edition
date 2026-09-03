#!/usr/bin/env node
/**
 * Validate packs/_source before it is built into compendia.
 *
 * 5273 hand-authored JSON documents with nothing checking them. Every data bug that has reached the
 * table came from this directory and none of them were the kind a reader catches: 196 beasts that
 * all read 10 current hit points, 34 shared attack items built from one sample each, a save table
 * one too high at every level. A reviewer cannot see those. Three lines of arithmetic can.
 *
 * Checks only invariants that are true of the data as it stands, so a failure means something
 * changed rather than something was always odd. Where a rule has known accepted exceptions they go
 * in ACCEPTED below, with a reason, so the exception is a decision on the record.
 *
 * Usage: node tools/validate-packs.mjs [--quiet]
 * Exits non-zero if anything fails, so it can gate a build or CI.
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const quiet = process.argv.includes("--quiet");

// --source lets the test point this at a fixture tree of deliberately broken documents. Without it
// the only observation available is "it said everything was fine", which is also what a validator
// with a typo in every predicate says.
const sourceFlag = process.argv.indexOf("--source");
const sourceRoot = sourceFlag !== -1 && process.argv[sourceFlag + 1]
  ? process.argv[sourceFlag + 1]
  : join(repoRoot, "packs", "_source");

/**
 * Known, deliberate exceptions. An empty list is the honest default: nothing is excused until
 * somebody decides to excuse it, in writing, here.
 * @type {{check: string, match: (f: string, d: object) => boolean, reason: string}[]}
 */
const ACCEPTED = [];

const problems = [];
const fail = (check, file, detail) => problems.push({ check, file, detail });

/** Every string value in a document, with a dotted path, so a finding names where it lives. */
function* walkStrings(value, path = "") {
  if (typeof value === "string") {
    yield [path || "(root)", value];
  } else if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) yield* walkStrings(value[i], path + "[" + i + "]");
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) yield* walkStrings(v, path ? path + "." + k : k);
  }
}

/** Every .json under a directory, recursively. */
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (entry.endsWith(".json")) out.push(p);
  }
  return out;
}

if (!existsSync(sourceRoot)) {
  console.error("No packs/_source at " + sourceRoot);
  process.exit(1);
}

// The system declares which document class each pack holds, and which subtypes exist for that
// class. Read both rather than hardcoding: a new subtype should not need this file edited.
const system = JSON.parse(readFileSync(join(repoRoot, "system.json"), "utf8"));
const template = JSON.parse(readFileSync(join(repoRoot, "template.json"), "utf8"));

const packClass = new Map(); // directory name under _source -> "Item" | "Actor" | "Macro" | ...
for (const pack of system.packs ?? []) {
  packClass.set(pack.path.replace(/^packs[\\/]/, ""), pack.type);
}

const validTypes = new Map(); // document class -> Set of declared subtypes
for (const [documentClass, section] of Object.entries(template)) {
  if (documentClass === "Item" || documentClass === "Actor") {
    validTypes.set(documentClass, new Set(section.types ?? []));
  }
}

const files = walk(sourceRoot);
const byPack = new Map();

for (const file of files) {
  const rel = relative(sourceRoot, file).replace(/\\/g, "/");
  const pack = rel.split("/")[0];
  const raw = readFileSync(file, "utf8");

  // 1. Parses. Catches a file mangled by a regex edit, which took the whole system down once.
  let doc;
  try {
    doc = JSON.parse(raw);
  } catch (error) {
    fail("json", rel, String(error.message).split("\n")[0]);
    continue;
  }

  // 2. No invisible control characters in any string VALUE. RULES.md rule 17: a stray escape becomes
  // a byte that is invisible in the file, in grep, and in a pattern's own source, and it has cost
  // hours three times.
  //
  // Scanned after parsing, not before. A raw control byte inside a JSON string is already illegal
  // and check 1 catches it; the dangerous case is the legal one, where the file holds a tidy `\b`
  // escape, parses without complaint, and hands back a value carrying U+0008. Scanning the raw text
  // finds nothing there, which is how the first version of this check passed its own test.
  for (const [path, value] of walkStrings(doc)) {
    const control = [...value].filter((c) => c.charCodeAt(0) < 0x20 && !"\t\n\r".includes(c));
    if (control.length) {
      const codes = [...new Set(control.map((c) => "U+" + c.charCodeAt(0).toString(16).padStart(4, "0")))];
      fail("control-chars", rel, path + " holds " + codes.join(" "));
    }
  }

  // 3. The three fields Foundry needs to place a document at all.
  for (const field of ["_id", "name", "type"]) {
    if (!doc[field]) fail("missing-field", rel, "no " + field);
  }

  // 4. The subtype must be one the system actually registers. An unregistered type makes the
  // document invalid, and an invalid document is absent from its collection entirely - so this
  // fails silently at runtime and looks like missing content rather than bad data.
  //
  // Route on `_key`, not on the pack's declared class. A pack holds more than one kind of document:
  // 197 of these files are Folders, whose `type` names the document class they CONTAIN, so a folder
  // in an Item pack correctly reads "Item". Checking those against the Item subtype list reported
  // all 197 as broken data when nothing was wrong with them.
  const collection = /^!([a-z]+)!/.exec(doc._key ?? "")?.[1];
  if (collection === "items" || collection === "actors") {
    const documentClass = collection === "items" ? "Item" : "Actor";
    const allowed = validTypes.get(documentClass);
    if (allowed && doc.type && !allowed.has(doc.type)) {
      fail("unknown-type", rel, "type " + JSON.stringify(doc.type) + " is not a declared " +
        documentClass + " subtype");
    }
  } else if (collection === "folders") {
    // A folder's type names a document class, so it must not be a subtype name.
    if (doc.type && validTypes.get("Item")?.has(doc.type)) {
      fail("folder-type", rel, "folder type " + JSON.stringify(doc.type) +
        " is an Item subtype; a folder's type names the document class it holds");
    }
  } else if (!collection) {
    fail("no-key", rel, "no _key, so its collection cannot be determined");
  }

  if (!byPack.has(pack)) byPack.set(pack, []);
  byPack.get(pack).push({ rel, doc });
}

// 5. Ids must be unique inside a pack; two documents sharing one collide in the compiled compendium.
for (const [pack, docs] of byPack) {
  const seen = new Map();
  for (const { rel, doc } of docs) {
    if (!doc._id) continue;
    if (seen.has(doc._id)) fail("duplicate-id", rel, "shares _id " + doc._id + " with " + seen.get(doc._id));
    else seen.set(doc._id, rel);
  }
}

// 6. A field that should vary but does not. This is the shape of the 196-beasts-all-10-HP bug: the
// data looked fine document by document and was only wrong in aggregate. Flags a numeric field
// carrying one value across more than 90% of a pack, where the pack has enough documents to mean
// something. Reported, not failed - a genuinely uniform field is possible and a human should look.
const warnings = [];
for (const [pack, docs] of byPack) {
  if (docs.length < 20) continue;
  const fields = new Map();
  for (const { doc } of docs) {
    for (const path of ["system.health.value", "system.health.max", "system.cost", "system.weight"]) {
      const value = path.split(".").reduce((o, k) => (o == null ? o : o[k]), doc);
      if (typeof value !== "number") continue;
      if (!fields.has(path)) fields.set(path, new Map());
      const counts = fields.get(path);
      counts.set(value, (counts.get(value) || 0) + 1);
    }
  }
  for (const [path, counts] of fields) {
    const total = [...counts.values()].reduce((a, b) => a + b, 0);
    const [value, n] = [...counts].sort((a, b) => b[1] - a[1])[0];
    if (total >= 20 && n / total > 0.9 && counts.size > 0) {
      warnings.push(pack + ": " + path + " is " + value + " on " + n + " of " + total +
        " documents. Verify that is real and not a fill.");
    }
  }
}

// 7. Beast hit points: current equals maximum on all 196 today. A beast written with a current
// below its maximum is almost certainly a data entry slip rather than a wounded creature.
for (const { rel, doc } of byPack.get("beasts") ?? []) {
  const health = doc.system?.health;
  if (!health || typeof health.value !== "number" || typeof health.max !== "number") continue;
  if (health.value !== health.max) {
    fail("beast-health", rel, "health.value " + health.value + " != health.max " + health.max);
  }
}

const excused = problems.filter((p) =>
  ACCEPTED.some((a) => a.check === p.check && a.match(p.file, p.detail)));
const real = problems.filter((p) => !excused.includes(p));

const byCheck = new Map();
for (const p of real) {
  if (!byCheck.has(p.check)) byCheck.set(p.check, []);
  byCheck.get(p.check).push(p);
}

// Report what was examined, not only what failed. RULES.md rule 22: few findings is a claim about
// the files read, never about the data.
console.log("Examined " + files.length + " documents across " + byPack.size + " packs.");

for (const [check, list] of byCheck) {
  console.log("\n" + check + ": " + list.length);
  const show = quiet ? 3 : 10;
  for (const p of list.slice(0, show)) console.log("  " + p.file + " - " + p.detail);
  if (list.length > show) console.log("  ...and " + (list.length - show) + " more");
}

if (warnings.length) {
  console.log("\nWarnings (not failures):");
  for (const w of warnings) console.log("  " + w);
}

if (excused.length) console.log("\nExcused by ACCEPTED: " + excused.length);

console.log("");
if (real.length === 0) {
  console.log("All checks pass.");
  process.exit(0);
}
console.log(real.length + " problem" + (real.length === 1 ? "" : "s") + " in " +
  new Set(real.map((p) => p.file)).size + " files.");
process.exit(1);
