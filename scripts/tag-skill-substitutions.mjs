// Tags feats/talents that let one skill stand in for another with the skillSubstitution change
// keys (see SWSEActor#getSkillSubstitutions).
//
//   skillSubstitutionAlways = "Target:Source"         -> replaces outright, no prompt
//   skillSubstitution       = "Target:Source[:scope]" -> offered as a choice when rolling
//
// Initiative substitutions are "always" by decision: Foundry's combat tracker rolls initiative
// itself and never goes through the sheet, so a prompt there would simply never appear.
//
// Ability-for-ability swaps (Battle Precognition, Body Control, Idealist, Fight Through Pain) are
// NOT handled here - those are defense/derived-stat changes and use the existing
// MAX(@X,@Y)-@X bonus pattern that Force of Personality already demonstrates.
//
// Usage: node scripts/tag-skill-substitutions.mjs [--write]
import fs from "node:fs";
import path from "node:path";

const WRITE = process.argv.includes("--write");
const DIRS = ["packs/_source/talents", "packs/_source/feats"];

// name -> [key, value]
const TAGS = {
  // --- Always (no prompt): Initiative ---
  "Force Intuition (Force Warrior Talent Tree)": ["auto", "Initiative:Use the Force"],
  "Force Intuition (Jedi Guardian Talent Tree)": ["auto", "Initiative:Use the Force"],
  "Watchful Step":                               ["auto", "Initiative:Perception"],

  // --- Prompted, whole skill ---
  "Computer Language":       ["auto", "Use Computer:Persuasion"],
  "Fluidity":                ["auto", "Acrobatics:Use the Force"],
  "Force Deception":         ["auto", "Deception:Use the Force"],
  "Force Persuasion":        ["auto", "Persuasion:Use the Force"],
  "Force Pilot":             ["auto", "Pilot:Use the Force"],
  "Machine Empathy":         ["auto", "Mechanics:Use the Force"],
  "One Word, Two Meanings":  ["auto", "Persuasion:Deception"],
  "SpyNet Agent":            ["auto", "Knowledge (Galactic Lore):Gather Information"],
  "Cut the Red Tape":        ["auto", "Gather Information:Knowledge (Bureaucracy)"],
  "Informer":                ["auto", "Gather Information:Perception"],
  "Force Stealth":           ["auto", "Stealth:Use the Force"],
  "White Current Adept":     ["auto", "Stealth:Use the Force"],
  "Force Treatment (Force Adept Talent Tree)":  ["auto", "Treat Injury:Use the Force"],
  "Force Treatment (Jedi Healer Talent Tree)":  ["auto", "Treat Injury:Use the Force"],

  // --- Prompted, scoped to some applications ---
  "Blend In (Spy Talent Tree)":  ["auto", "Deception:Stealth:Deceptive Appearance only"],
  "Electronic Forgery":          ["auto", "Deception:Use Computer:forged documents only"],
  "Illusionary Disguise":        ["auto", "Deception:Use the Force:Deceptive Appearance only"],
  "Feign Harmlessness":          ["auto", "Deception:Persuasion:to Feint"],
  "Charm Beast (Beastwarden Talent Tree)":       ["auto", "Persuasion:Use the Force:change a beast's Attitude"],
  "Charm Beast (Dathomiri Witch Talent Tree)":   ["auto", "Persuasion:Use the Force:change a beast's Attitude"],
  "Charm Beast (Felucian Shaman Talent Tree)":   ["auto", "Persuasion:Use the Force:change a beast's Attitude"],
  "Deception Awareness":         ["auto", "Perception:Use the Force:Sense Deception / Sense Influence"],
  "Force Perception":            ["auto", "Perception:Use the Force:surprise, notice enemies, sense deception/influence"],
  "Force Track":                 ["auto", "Survival:Use the Force:to Track"],
  "Hotwire":                     ["auto", "Use Computer:Mechanics:Improve Access only"],
  "Instinctive Astrogation":     ["auto", "Use Computer:Use the Force:to Astrogate"],
  "Folded Space Mastery":        ["auto", "Use Computer:Use the Force:as though Astrogating"],
  "Insight of the Force":        ["auto", "Knowledge:Use the Force:untrained Knowledge skills only"],
  "Bioengineering":              ["auto", "Mechanics:Treat Injury:Build Object only"],
  "Poisoncraft":                 ["auto", "Mechanics:Treat Injury:Build Object, poisons only"],
};

let tagged = 0, notFound = [], alreadyTagged = 0;
const seen = new Set();

// A substitution that names no scope replaces the skill outright - prompting there is pure
// friction, since there's never a reason to pick the worse modifier. Only substitutions the
// talent limits to particular applications ("to Feint", "Deceptive Appearance only") need asking
// about, because the base skill still applies everywhere else. Derived from the value's own shape
// rather than listed by hand, so the two can't drift apart.
const keyFor = (value) => value.split(":").length > 2 ? "skillSubstitution" : "skillSubstitutionAlways";

for (const dir of DIRS) {
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".json")) continue;
    const p = path.join(dir, f);
    const doc = JSON.parse(fs.readFileSync(p, "utf8"));
    if (!doc?.system) continue;
    const tag = TAGS[doc.name];
    if (!tag) continue;
    seen.add(doc.name);

    const value = tag[1];
    const key = keyFor(value);
    let changes = Array.isArray(doc.system.changes) ? doc.system.changes : [];
    if (changes.some(c => c.key === key && c.value === value)) { alreadyTagged++; continue; }

    // Drop any earlier tagging of the same substitution under the other key.
    changes = changes.filter(c => !(c.key?.startsWith("skillSubstitution") && c.value === value));
    changes.push({mode: 2, value, key});
    doc.system.changes = changes;
    if (WRITE) fs.writeFileSync(p, JSON.stringify(doc, null, 2) + "\n");
    tagged++;
  }
}

notFound = Object.keys(TAGS).filter(n => !seen.has(n));

console.log(`${WRITE ? "Applied" : "[dry-run]"}: ${tagged} tagged, ${alreadyTagged} already tagged.`);
if (notFound.length) {
  console.log(`NOT FOUND (${notFound.length}) - name mismatch, these were skipped:`);
  notFound.forEach(n => console.log("  " + n));
}
