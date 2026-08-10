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
  "Force Intuition (Force Warrior Talent Tree)": ["skillSubstitutionAlways", "Initiative:Use the Force"],
  "Force Intuition (Jedi Guardian Talent Tree)": ["skillSubstitutionAlways", "Initiative:Use the Force"],
  "Watchful Step":                               ["skillSubstitutionAlways", "Initiative:Perception"],

  // --- Prompted, whole skill ---
  "Computer Language":       ["skillSubstitution", "Use Computer:Persuasion"],
  "Fluidity":                ["skillSubstitution", "Acrobatics:Use the Force"],
  "Force Deception":         ["skillSubstitution", "Deception:Use the Force"],
  "Force Persuasion":        ["skillSubstitution", "Persuasion:Use the Force"],
  "Force Pilot":             ["skillSubstitution", "Pilot:Use the Force"],
  "Machine Empathy":         ["skillSubstitution", "Mechanics:Use the Force"],
  "One Word, Two Meanings":  ["skillSubstitution", "Persuasion:Deception"],
  "SpyNet Agent":            ["skillSubstitution", "Knowledge (Galactic Lore):Gather Information"],
  "Cut the Red Tape":        ["skillSubstitution", "Gather Information:Knowledge (Bureaucracy)"],
  "Informer":                ["skillSubstitution", "Gather Information:Perception"],
  "Force Stealth":           ["skillSubstitution", "Stealth:Use the Force"],
  "White Current Adept":     ["skillSubstitution", "Stealth:Use the Force"],
  "Force Treatment (Force Adept Talent Tree)":  ["skillSubstitution", "Treat Injury:Use the Force"],
  "Force Treatment (Jedi Healer Talent Tree)":  ["skillSubstitution", "Treat Injury:Use the Force"],

  // --- Prompted, scoped to some applications ---
  "Blend In (Spy Talent Tree)":  ["skillSubstitution", "Deception:Stealth:Deceptive Appearance only"],
  "Electronic Forgery":          ["skillSubstitution", "Deception:Use Computer:forged documents only"],
  "Illusionary Disguise":        ["skillSubstitution", "Deception:Use the Force:Deceptive Appearance only"],
  "Feign Harmlessness":          ["skillSubstitution", "Deception:Persuasion:to Feint"],
  "Charm Beast (Beastwarden Talent Tree)":       ["skillSubstitution", "Persuasion:Use the Force:change a beast's Attitude"],
  "Charm Beast (Dathomiri Witch Talent Tree)":   ["skillSubstitution", "Persuasion:Use the Force:change a beast's Attitude"],
  "Charm Beast (Felucian Shaman Talent Tree)":   ["skillSubstitution", "Persuasion:Use the Force:change a beast's Attitude"],
  "Deception Awareness":         ["skillSubstitution", "Perception:Use the Force:Sense Deception / Sense Influence"],
  "Force Perception":            ["skillSubstitution", "Perception:Use the Force:surprise, notice enemies, sense deception/influence"],
  "Force Track":                 ["skillSubstitution", "Survival:Use the Force:to Track"],
  "Hotwire":                     ["skillSubstitution", "Use Computer:Mechanics:Improve Access only"],
  "Instinctive Astrogation":     ["skillSubstitution", "Use Computer:Use the Force:to Astrogate"],
  "Folded Space Mastery":        ["skillSubstitution", "Use Computer:Use the Force:as though Astrogating"],
  "Insight of the Force":        ["skillSubstitution", "Knowledge:Use the Force:untrained Knowledge skills only"],
  "Bioengineering":              ["skillSubstitution", "Mechanics:Treat Injury:Build Object only"],
  "Poisoncraft":                 ["skillSubstitution", "Mechanics:Treat Injury:Build Object, poisons only"],
};

let tagged = 0, notFound = [], alreadyTagged = 0;
const seen = new Set();

for (const dir of DIRS) {
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".json")) continue;
    const p = path.join(dir, f);
    const doc = JSON.parse(fs.readFileSync(p, "utf8"));
    if (!doc?.system) continue;
    const tag = TAGS[doc.name];
    if (!tag) continue;
    seen.add(doc.name);

    const [key, value] = tag;
    const changes = Array.isArray(doc.system.changes) ? doc.system.changes : [];
    if (changes.some(c => c.key === key && c.value === value)) { alreadyTagged++; continue; }

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
