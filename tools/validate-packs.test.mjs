#!/usr/bin/env node
/**
 * Prove validate-packs.mjs can fail.
 *
 * It passed on its first run against all 5273 real documents, which is the least informative result
 * a checker can give: a validator with a typo in every predicate passes too. Each case below plants
 * one specific defect in a fixture tree and asserts that the matching check, and only it, fires.
 *
 * The last case is the one that matters most: 197 Folder documents legitimately carry type "Item",
 * and an earlier version reported every one of them as broken data. A false alarm on good content
 * is worse than no check, because it trains everyone to ignore the output.
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const VALIDATOR = fileURLToPath(new URL("./validate-packs.mjs", import.meta.url));

/** A document that passes every check, to be broken one field at a time. */
const good = (n) => ({
  _id: "id" + String(n).padStart(14, "x"),
  _key: "!items!id" + String(n).padStart(14, "x"),
  name: "Talent " + n,
  type: "talent",
  system: {},
});

function run(build) {
  const dir = mkdtempSync(join(tmpdir(), "packval-"));
  const pack = join(dir, "talents");
  mkdirSync(pack);
  build(pack, dir);
  const r = spawnSync(process.execPath, [VALIDATOR, "--source", dir], { encoding: "utf8" });
  rmSync(dir, { recursive: true, force: true });
  return { out: r.stdout + r.stderr, code: r.status };
}

const write = (pack, name, doc) =>
  writeFileSync(join(pack, name + ".json"), typeof doc === "string" ? doc : JSON.stringify(doc, null, 2));

const cases = [
  ["json", "a file that is not valid JSON", (p) => {
    write(p, "ok", good(1));
    write(p, "broken", '{"name": "Oops", ');
  }],
  ["control-chars", "an invisible U+0008 inside a string", (p) => {
    const d = good(2);
    d.name = "Blaster" + String.fromCharCode(8) + "Rifle";
    write(p, "backspace", d);
  }],
  ["missing-field", "a document with no name", (p) => {
    const d = good(3);
    delete d.name;
    write(p, "nameless", d);
  }],
  ["unknown-type", "an item whose subtype the system never registered", (p) => {
    const d = good(4);
    d.type = "notAThing";
    write(p, "badtype", d);
  }],
  ["duplicate-id", "two documents sharing one _id", (p) => {
    write(p, "first", good(5));
    const d = good(5);
    d.name = "Different name, same id";
    write(p, "second", d);
  }],
  ["beast-health", "a beast whose current HP is below its maximum", (p, dir) => {
    const beasts = join(dir, "beasts");
    mkdirSync(beasts);
    const d = good(6);
    d.type = "beastType";
    d._key = "!items!" + d._id;
    d.system = { health: { value: 10, max: 133 } };
    writeFileSync(join(beasts, "wounded.json"), JSON.stringify(d, null, 2));
  }],
  ["no-key", "a document with no _key to identify its collection", (p) => {
    const d = good(7);
    delete d._key;
    write(p, "keyless", d);
  }],
];

let failed = 0;

for (const [check, label, build] of cases) {
  const { out, code } = run(build);
  const fired = out.includes(check + ":");
  const ok = fired && code === 1;
  if (!ok) failed++;
  console.log((ok ? "  ok  " : "FAIL  ") + check.padEnd(15) + label +
    (ok ? "" : "\n        exit " + code + ", output:\n" + out.split("\n").map((l) => "        " + l).join("\n")));
}

// The false-alarm guard. Folders and a clean item together must produce nothing at all.
const clean = run((p) => {
  write(p, "item", good(20));
  write(p, "_folder_Talent_Tree", {
    _id: "folderxxxxxxxxx1",
    _key: "!folders!folderxxxxxxxxx1",
    name: "Droid Talent Tree",
    type: "Item",
  });
});
const cleanOk = clean.code === 0 && clean.out.includes("All checks pass");
if (!cleanOk) failed++;
console.log((cleanOk ? "  ok  " : "FAIL  ") + "no-false-alarm".padEnd(15) +
  "a Folder typed \"Item\" alongside a good item is not a finding" +
  (cleanOk ? "" : "\n        exit " + clean.code + "\n" + clean.out));

console.log("");
console.log(failed === 0
  ? "all " + (cases.length + 1) + " cases pass"
  : failed + " of " + (cases.length + 1) + " FAILED");
process.exit(failed === 0 ? 0 : 1);
