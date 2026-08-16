// Homebrew (tovec.wikidot.com/episode-vii):
//   "Block and Deflect is now one talent called Dueling Stance."
//   "Redirect Shot and Riposte now merge into a new talent called Redirection Stance. This allows
//    one free counter-attack per turn, assuming you manage to negate the attack."
//
// Creates the two merged talents, deletes the four they replace, and rewrites every prerequisite
// across talents/feats that referenced the old ones. Prereqs need real rewriting rather than a
// string swap: several read "Block or Deflect" or "Block talent, and Deflect talent", which both
// collapse to a single Dueling Stance requirement once merged.
//
// Usage: node scripts/merge-lightsaber-stance-talents.mjs [--write]
import fs from "node:fs";
import path from "node:path";

const WRITE = process.argv.includes("--write");
const TALENTS = "packs/_source/talents";
const FEATS = "packs/_source/feats";

const MERGE = {
  "Block": "Dueling Stance",
  "Deflect": "Dueling Stance",
  "Redirect Shot": "Redirection Stance",
  "Riposte": "Redirection Stance",
};

const randomId = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({length: 16}, () => chars[Math.floor(Math.random() * chars.length)]).join("");
};

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const writeJson = (p, d) => { if (WRITE) fs.writeFileSync(p, JSON.stringify(d, null, 2) + "\n"); };

function findByName(dir, name) {
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".json")) continue;
    const p = path.join(dir, f);
    if (readJson(p).name === name) return p;
  }
  return null;
}

// ---- 1. build the two merged talents, cloning Block for structure ----------------------------
const blockPath = findByName(TALENTS, "Block");
const template = readJson(blockPath);

function makeTalent({name, description, changes, prerequisite}) {
  const doc = foundryClone(template);
  const id = randomId();
  doc._id = id;
  doc._key = `!items!${id}`;
  doc.name = name;
  doc.sort = 0;
  doc.system.finalName = "";
  doc.system.description = `<p><i>Homebrew Talent (tovec.wikidot.com/episode-vii)</i></p><p>${description}</p>`;
  doc.system.textDescription = description;
  doc.system.changes = changes;
  doc.system.prerequisite = prerequisite;
  return doc;
}
function foundryClone(o) { return JSON.parse(JSON.stringify(o)); }

const duelingStance = makeTalent({
  name: "Dueling Stance",
  description: "Block and Deflect are combined into this single talent. You may use both the Block and Deflect reactions.",
  // Both reaction rolls the original two talents each granted.
  changes: [
    {mode: 2, value: "block", key: "rollable"},
    {mode: 2, value: "deflect", key: "rollable"},
  ],
  prerequisite: null,
});

const redirectionStance = makeTalent({
  name: "Redirection Stance",
  description: "Redirect Shot and Riposte are combined into this single talent. This allows one free counter-attack per turn, assuming you manage to negate the attack.",
  changes: [],
  prerequisite: {
    children: [
      {text: "Dueling Stance talent", requirement: "Dueling Stance", type: "TALENT"},
      {text: "Base Attack Bonus 5", requirement: "5", type: "BASE ATTACK BONUS"},
    ],
    text: "Dueling Stance talent, and Base Attack Bonus 5",
    type: "AND",
  },
});

// ---- 2. rewrite prerequisites that referenced the merged-away talents ------------------------
// Returns {node, changed}. Anything not actually affected by the merge is returned byte-identical
// - prerequisite `text` is hand-written prose ("Any two Talents from the Sabotage Talent Tree",
// "Medium or larger size") that regenerating from children would destroy, so text is only rebuilt
// on nodes whose own subtree really changed.
function rewritePrereq(node) {
  if (!node || typeof node !== "object") return {node, changed: false};

  if (Array.isArray(node.children)) {
    const results = node.children.map(rewritePrereq);
    if (!results.some(r => r.changed)) return {node, changed: false};

    let children = results.map(r => r.node).filter(Boolean);
    // Block+Deflect (or Redirect Shot+Riposte) in the same group collapse to one requirement.
    const seen = new Set();
    children = children.filter(c => {
      const k = `${c.type}::${c.requirement}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    if (children.length === 0) return {node: null, changed: true};
    if (children.length === 1) return {node: children[0], changed: true};
    const joiner = node.type === "OR" ? " or " : ", and ";
    return {node: {...node, children, text: children.map(c => c.text).join(joiner)}, changed: true};
  }

  if (node.type === "TALENT" && MERGE[node.requirement]) {
    const merged = MERGE[node.requirement];
    return {node: {...node, requirement: merged, text: `${merged} talent`}, changed: true};
  }
  return {node, changed: false};
}

let prereqEdits = [];
for (const dir of [TALENTS, FEATS]) {
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".json")) continue;
    const p = path.join(dir, f);
    const doc = readJson(p);
    if (!doc?.system) continue; // a few pack files aren't item documents
    if (Object.keys(MERGE).includes(doc.name)) continue; // about to be deleted
    const original = doc.system.prerequisite ?? null;
    const {node: after, changed} = rewritePrereq(original);
    if (changed) {
      doc.system.prerequisite = after;
      writeJson(p, doc);
      prereqEdits.push(`${doc.name}: ${original?.text ?? "-"}  ->  ${after?.text ?? "-"}`);
    }
  }
}

// ---- 3. write the new talents, delete the four originals -------------------------------------
for (const doc of [duelingStance, redirectionStance]) {
  const file = path.join(TALENTS, `${doc.name.replace(/[^A-Za-z0-9]+/g, "_")}_${doc._id}.json`);
  writeJson(file, doc);
}
let deleted = [];
for (const name of Object.keys(MERGE)) {
  const p = findByName(TALENTS, name);
  if (p) { if (WRITE) fs.unlinkSync(p); deleted.push(name); }
}

console.log(`${WRITE ? "Applied" : "[dry-run]"}`);
console.log(`created: Dueling Stance (${duelingStance._id}), Redirection Stance (${redirectionStance._id})`);
console.log(`deleted: ${deleted.join(", ")}`);
console.log(`prerequisites rewritten (${prereqEdits.length}):`);
prereqEdits.forEach(e => console.log("  " + e));
