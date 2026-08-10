// Fills Dueling Stance / Redirection Stance with the full rules text of the talents they replaced,
// recovered from git history (the originals were deleted when they were merged).
//
// References to the removed talents are rewritten as part of this - the text repeatedly says
// things like "every time you have used Block or Deflect", which no longer names anything once
// both are one talent.
//
// Usage: node scripts/merge-stance-descriptions.mjs [--write]
import fs from "node:fs";
import path from "node:path";

const WRITE = process.argv.includes("--write");
const TALENTS = "packs/_source/talents";
const RECOVER = ".recover";

const src = (f) => JSON.parse(fs.readFileSync(path.join(RECOVER, f), "utf8")).system.description;

const BLOCK = src("Block_llNxcXXNap23CNWB.json");
const DEFLECT = src("Deflect_wSFbXqb0F5E0SLxy.json");
const REDIRECT = src("Redirect_Shot_UXhgZRVJNxpePGjE.json");
const RIPOSTE = src("Riposte_ZlLAxQ4dKuW79pjQ.json");

// Block and Deflect are now one talent, so the shared cumulative penalty is per-Dueling-Stance.
const fixDueling = (html) => html
  .replaceAll("<b>Block</b> or <b>Deflect</b>", "<b>Dueling Stance</b>")
  .replaceAll("the <b>Block</b> Talent", "<b>Dueling Stance</b>")
  .replaceAll("the <b>Deflect</b> Talent", "<b>Dueling Stance</b>");

// Redirect Shot / Riposte keyed off Deflect and Block respectively; both are Dueling Stance now.
const fixRedirection = (html) => fixDueling(html)
  .replaceAll("you successfully <b>Deflect</b> a blaster bolt", "you successfully deflect a blaster bolt with <b>Dueling Stance</b>")
  .replaceAll("negated using the <b>Block</b> Talent", "negated using <b>Dueling Stance</b>")
  .replaceAll("successfully negated using <b>Dueling Stance</b>", "successfully negated using <b>Dueling Stance</b>");

const HOMEBREW = (line) =>
  `<p><i>Homebrew Talent (tovec.wikidot.com/episode-vii)</i></p><p>${line}</p>`;

const DUELING = [
  HOMEBREW("Block and Deflect are combined into this single talent — you may use both reactions. The cumulative -5 penalty is shared between them."),
  `<h4>Block <span style="font-weight:normal"><i>(melee)</i></span></h4>`,
  fixDueling(BLOCK),
  `<h4>Deflect <span style="font-weight:normal"><i>(ranged)</i></span></h4>`,
  fixDueling(DEFLECT),
].join("");

const REDIRECTION = [
  HOMEBREW("Redirect Shot and Riposte are combined into this single talent. It allows one free counter-attack per turn, assuming you manage to negate the attack."),
  `<h4>Redirect Shot <span style="font-weight:normal"><i>(after negating a ranged attack)</i></span></h4>`,
  fixRedirection(REDIRECT),
  `<h4>Riposte <span style="font-weight:normal"><i>(after negating a melee attack)</i></span></h4>`,
  fixRedirection(RIPOSTE),
].join("");

const plain = (html) => html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

const targets = {"Dueling Stance": DUELING, "Redirection Stance": REDIRECTION};
let updated = [];

for (const f of fs.readdirSync(TALENTS)) {
  if (!f.endsWith(".json")) continue;
  const p = path.join(TALENTS, f);
  const doc = JSON.parse(fs.readFileSync(p, "utf8"));
  const html = targets[doc.name];
  if (!html) continue;
  doc.system.description = html;
  doc.system.textDescription = plain(html);
  if (WRITE) fs.writeFileSync(p, JSON.stringify(doc, null, 2) + "\n");
  updated.push(`${doc.name}: ${html.length} chars html, ${plain(html).length} chars text`);
}

console.log(`${WRITE ? "Applied" : "[dry-run]"}`);
updated.forEach(u => console.log("  " + u));
