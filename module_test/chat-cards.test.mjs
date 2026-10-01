import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { summarizeRoll, rollTooltipHtml, signed, naturalD20, rollMathHtml, labeledFormula, modifierChips } from "../module/common/roll-summary.mjs";
import { attackCardView, damageTypeKey, targetView, roundPenaltyText } from "../module/actor/attack/attack-card.mjs";
import { planApplications } from "../module/actor/attack/apply-attack.mjs";
import { resolveDamageTaken } from "../module/common/conditionalHelpers.mjs";
import { resultLineContent, checkTitle, actorSkillNames, abilityName } from "../module/common/chatMessageHelpers.mjs";
import { SkillFunctions } from "../module/actor/data/templates/skills.mjs";

// Term shapes as read off Darth Vader's lightsaber in the test world: a Die, then operator and
// flavored number pairs.
const die = (number, faces, results) => ({number, faces, formula: `${number}d${faces}`, results: results?.map(result => ({result, active: true})), total: results?.reduce((a, b) => a + b, 0)});
const op = operator => ({operator});
const num = (number, flavor) => ({number, options: {flavor}});
const roll = (terms, total) => ({terms, formula: "formula", total, _evaluated: total !== undefined});

const vaderAttack = roll([die(1, 20), op("+"), num(19, "Base Attack Bonus"), op("+"), num(3, "Attribute Modifier"), op("+"), num(1, "Weapon Focus")]);
const vaderDamage = roll([die(3, 8), op("+"), num(9, "Half Heroic Level"), op("+"), num(3, "Attribute Modifier"), op("+"), num(2, "Weapon Specialization")]);

describe("summarizeRoll", () => {
    it("splits dice from signed, labelled modifiers", () => {
        const s = summarizeRoll(vaderAttack);
        assert.deepEqual(s.modifiers, [{value: 19, label: "Base Attack Bonus"}, {value: 3, label: "Attribute Modifier"}, {value: 1, label: "Weapon Focus"}]);
        assert.equal(s.bonus, 23);
        assert.equal(s.complex, false);
    });

    it("reads a minus as a negative modifier", () => {
        const s = summarizeRoll(roll([die(1, 20), op("+"), num(1, "Weapon Focus"), op("-"), num(10, "Dual Weapon")]));
        assert.deepEqual(s.modifiers.map(m => m.value), [1, -10]);
        assert.equal(signed(-10), "−10");
    });

    it("marks a multiplied critical as complex, so the card shows its formula", () => {
        assert.equal(summarizeRoll(roll([{term: "paren"}, op("*"), num(2)])).complex, true);
    });

    it("finds the natural d20", () => {
        const rolled = roll([die(1, 20, [17]), op("+"), num(5, "Base Attack Bonus")], 22);
        assert.equal(naturalD20(summarizeRoll(rolled)), 17);
    });

    it("writes chips label first, as PF2e does", () => {
        assert.deepEqual(modifierChips(summarizeRoll(vaderAttack)).map(c => c.text), ["Base Attack Bonus +19", "Attribute Modifier +3", "Weapon Focus +1"]);
        assert.deepEqual(modifierChips(summarizeRoll(roll([die(1, 20), op("+"), num(20)]))).map(c => c.text), ["+20"]);
    });
});

// What a reader of the card sees: strip the markup, keep the order.
const text = html => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

describe("the arithmetic beside a total", () => {
    it("an attack: the die it rolled, then the bonus", () => {
        const html = rollMathHtml(summarizeRoll(roll([die(1, 20, [8]), op("+"), num(17, "Base Attack Bonus")], 25)));
        assert.equal(text(html), "d20 8 +17");
        assert.match(html, /<span class="swse-die">8<\/span><span class="swse-math-bonus">\+17<\/span>/);
    });

    it("damage: the dice total with its faces on hover, a plus between dice groups, then the bonus", () => {
        const html = rollMathHtml(summarizeRoll(roll([die(3, 8, [6, 4, 7]), op("+"), die(1, 6, [3]), op("+"), num(5, "Half Heroic Level")], 25)));
        assert.equal(text(html), "3d8 17 + d6 3 +5");
        assert.match(html, /title="6 \+ 4 \+ 7">17</);
    });

    it("a natural 20 or 1 colours the die and says so; no bonus shows no bonus", () => {
        const crit = rollMathHtml(summarizeRoll(roll([die(1, 20, [20]), op("+"), num(7)], 27)), {critical: true});
        assert.match(crit, /swse-die is-critical">20</);
        assert.match(text(crit), /Critical$/);
        const miss = rollMathHtml(summarizeRoll(roll([die(1, 20, [1])], 1)), {fail: true, failLabel: "Auto Miss"});
        assert.equal(text(miss), "d20 1 Auto Miss");
        assert.doesNotMatch(miss, /swse-math-bonus/);
    });

    it("a roll that is not a plain sum shows its formula", () => {
        const html = rollMathHtml(summarizeRoll({terms: [{term: "paren"}, op("*"), num(2)], formula: "(3d8 + 5) * 2", total: 30, _evaluated: true}), {critical: true});
        assert.equal(text(html), "(3d8 + 5) * 2 Critical");
    });
});

describe("labelled check formulas", () => {
    it("labels each part, writes a penalty with a minus and leaves out zeros", () => {
        const parts = [{value: 5, label: "Half Level"}, {value: 2, label: "Wisdom"}, {value: 0, label: "Trained"}, {value: -2, label: "Armor Check Penalty"}, {value: undefined, label: "Manual"}];
        assert.equal(labeledFormula("1d20", parts, 5, "1d20 + 5"), "1d20 + 5[Half Level] + 2[Wisdom] - 2[Armor Check Penalty]");
    });

    it("falls back to the plain formula rather than roll a different total", () => {
        assert.equal(labeledFormula("1d20", [{value: 5, label: "Half Level"}], 6, "1d20 + 6"), "1d20 + 6");
        assert.equal(labeledFormula("1d20", [{value: "@HalfLevel", label: "Half Level"}], 5, "1d20 + 5"), "1d20 + 5");
        assert.equal(labeledFormula("1d20", [{value: 3}], 3, "1d20 + 3"), "1d20 + 3");
    });

    // The real producer: configureSkill, as skills.mjs calls it, with bonuses shaped as it builds them.
    it("configureSkill gives a skill a labelled roll and keeps resolvedVariables plain", () => {
        const actor = {cleanSkillName: name => name, resolvedVariables: new Map(), resolvedLabels: new Map()};
        const skill = {};
        const bonuses = [
            {value: 5, description: "Half character level: 5", label: "Half Level"},
            {value: 2, description: "Ability Mod: 2", label: abilityName("wis")},
            {value: 5, description: "Trained Skill Bonus: 5", label: "Trained"}
        ];
        SkillFunctions.prototype.configureSkill.call({}, skill, bonuses, actor, "Perception", 2);
        assert.equal(skill.value, 12);
        assert.equal(skill.rollFormula, "1d20 + 5[Half Level] + 2[Wisdom] + 5[Trained]");
        assert.equal(actor.resolvedVariables.get("@Perception"), "1d20 + 12");
    });
});

describe("check titles in PF2e's wording", () => {
    const skills = ["Perception", "Knowledge (Galactic Lore)", "Initiative", "Use the Force"];

    it("a skill is a Skill Check, initiative is Initiative", () => {
        assert.equal(checkTitle("Perception", skills), "Skill Check: Perception");
        assert.equal(checkTitle("perception", skills), "Skill Check: Perception");
        assert.equal(checkTitle("K. (Galactic Lore)", skills), "Skill Check: Knowledge (Galactic Lore)");
        assert.equal(checkTitle("Initiative", skills), "Initiative");
    });

    it("an ability is an Ability Check by its full name", () => {
        assert.equal(checkTitle("STR", skills), "Ability Check: Strength");
        assert.equal(checkTitle("Wisdom", skills), "Ability Check: Wisdom");
    });

    it("anything else keeps its own name, as PF2e does", () => {
        assert.equal(checkTitle("Move Object", skills), "Move Object");
        assert.equal(checkTitle("Grapple", skills), "Grapple");
        assert.equal(checkTitle("", skills), "");
    });

    it("lists an actor's skills with their situational variants", () => {
        const actor = {system: {skills: {Perception: {situationalSkills: [{label: "Perception (Hearing)"}]}, Stealth: {}}}};
        assert.deepEqual(actorSkillNames(actor), ["Perception", "Perception (Hearing)", "Stealth"]);
        assert.equal(checkTitle("Perception (Hearing)", actorSkillNames(actor)), "Skill Check: Perception (Hearing)");
    });
});

describe("sheet attack tooltips", () => {
    it("attack: the total bonus, then each line", () => {
        const html = rollTooltipHtml("attack", vaderAttack);
        assert.match(html, /Attack bonus<\/span><strong>\+23<\/strong>/);
        assert.match(html, /<span>Base Attack Bonus<\/span><span>\+19<\/span>/);
        assert.match(html, /<span>Weapon Focus<\/span><span>\+1<\/span>/);
    });

    it("damage: the dice with the total bonus, then the dice and each line", () => {
        const html = rollTooltipHtml("damage", vaderDamage);
        assert.match(html, /Damage<\/span><strong>3d8 \+14<\/strong>/);
        assert.match(html, /<span>Dice<\/span><span>3d8<\/span>/);
        assert.match(html, /<span>Half Heroic Level<\/span><span>\+9<\/span>/);
    });

    it("a penalty line is flagged, and no roll gives no tooltip", () => {
        assert.match(rollTooltipHtml("attack", roll([die(1, 20), op("-"), num(5, "Dual Weapon")])), /<li class="is-negative"><span>Dual Weapon<\/span><span>−5<\/span>/);
        assert.equal(rollTooltipHtml("attack", undefined), "");
    });
});

describe("attack card view", () => {
    it("names the damage type's color, Ion before Energy", () => {
        assert.equal(damageTypeKey("Energy"), "energy");
        assert.equal(damageTypeKey("Energy (Ion)"), "ion");
        assert.equal(damageTypeKey("Stun"), "stun");
        assert.equal(damageTypeKey("Slashing"), "physical");
        assert.equal(damageTypeKey("Varies"), "other");
    });

    it("turns each roll-time result into a verdict", () => {
        assert.deepEqual([["Critical Hit!"], ["Hit"], ["Half Damage"], ["Automatic Miss"], ["Miss"]].map(([result]) => targetView({name: "x", result}).verdictKey),
            ["critical", "hit", "half", "miss", "miss"]);
        assert.equal(targetView({name: "Kath Hound", result: "Hit", defenseType: "Ref", defense: 15}).defense, "Ref 15");
    });

    it("builds a card from a resolved attack, with the weapon's picture and the apply payload", () => {
        const attack = {name: "Lightsaber", item: {img: "systems/swse/icon/item/lightsaber.webp", system: {subtype: "Lightsabers"}}, isLightsaberAttack: true, type: "Energy", notesHTML: ""};
        const band = {range: "Point Blank", attack: roll([die(1, 20, [20]), op("+"), num(7, "Base Attack Bonus")], 27), damage: roll([die(3, 8, [6, 4, 7]), op("+"), num(3, "Attribute Modifier")], 20),
            damageType: "Energy", critical: true, fail: false, notes: [], targets: [{name: "Kath Hound", result: "Critical Hit!", defenseType: "Ref", defense: 15}]};
        const view = attackCardView({rangeBreakdown: [band], attackSummaries: "[]"}, attack);
        assert.equal(view.img, "systems/swse/icon/item/lightsaber.webp");
        assert.equal(view.damageTypeKey, "energy");
        assert.equal(view.critical, true);
        assert.equal(text(view.bands[0].attack.math), "d20 20 +7 Critical");
        assert.deepEqual(view.bands[0].attack.chips, [{text: "Base Attack Bonus +7", negative: false}]);
        assert.equal(text(view.bands[0].damage.math), "3d8 17 +3 Critical");
        assert.equal(view.bands[0].targets[0].verdict, "Critical");
        assert.deepEqual(JSON.parse(view.apply), {damage: 20, damageType: "Energy", lightsaber: true});
    });

    it("an automatic miss says so on the attack, not on the damage", () => {
        const attack = {name: "Blaster Rifle", item: {img: "rifle.webp", system: {}}, type: "Energy"};
        const band = {attack: roll([die(1, 20, [1]), op("+"), num(9, "Base Attack Bonus")], 10), damage: roll([die(3, 8, [5, 6, 2])], 13), damageType: "Energy", critical: false, fail: true, targets: []};
        const view = attackCardView({rangeBreakdown: [band], attackSummaries: "[]"}, attack);
        assert.equal(text(view.bands[0].attack.math), "d20 1 +9 Auto Miss");
        assert.equal(text(view.bands[0].damage.math), "3d8 13");
    });

    it("an attack with no target still has a card and an apply payload", () => {
        const attack = {name: "Blaster Rifle", item: {img: "rifle.webp", system: {subtype: "Rifles"}}, isLightsaberAttack: false, type: "Energy"};
        const band = {attack: roll([die(1, 20, [11])], 11), damage: roll([die(3, 8, [5, 6, 2])], 13), damageType: "Energy", critical: false, fail: false, targets: []};
        const view = attackCardView({rangeBreakdown: [band], attackSummaries: "[]"}, attack);
        assert.equal(JSON.parse(view.apply).damage, 13);
    });

    it("states the Full Attack penalties once, from the first attack", () => {
        const attacks = [{options: {modifiers: [{source: "Dual Weapon", value: -5}, {source: "Double Attack", value: -5}, {source: "Battle Meditation", value: 1}]}}];
        assert.equal(roundPenaltyText(attacks), "−5 Dual Weapon, −5 Double Attack");
        assert.equal(roundPenaltyText([{options: {}}]), "");
    });
});

describe("Apply buttons", () => {
    const pc = {name: "Miralukan Jedi"};
    const hound = {name: "Kath Hound"};
    const rancor = {name: "Rancor"};
    const actors = {hound, rancor};
    const summaries = [
        {uuid: "hound", result: "Hit", damage: 20, damageType: "Energy", lightsaber: true},
        {uuid: "rancor", result: "Miss", damage: 20, damageType: "Energy", lightsaber: true}
    ];
    const base = {damage: 20, damageType: "Energy", lightsaber: true};
    const plan = (type, selected) => planApplications(type, {selected, summaries, base, resolveActor: uuid => actors[uuid]});

    it("applies to the token selected on the map, whatever was targeted", () => {
        assert.deepEqual(plan("damage", [pc]).map(a => [a.actor.name, a.amount, a.lightsaber]), [["Miralukan Jedi", 20, true]]);
    });

    it("with nothing selected, applies to the targets it hit and skips the misses", () => {
        assert.deepEqual(plan("damage", []).map(a => [a.actor.name, a.amount]), [["Kath Hound", 20]]);
    });

    it("Half halves and Double doubles", () => {
        assert.equal(plan("half", [pc])[0].amount, 10);
        assert.equal(plan("double", [pc])[0].amount, 40);
        assert.equal(plan("half", [])[0].amount, 10);
    });

    it("an area near miss takes half from the roll-time targets", () => {
        const area = planApplications("damage", {summaries: [{uuid: "hound", result: "Half Damage", damage: 21, damageType: "Energy"}], resolveActor: uuid => actors[uuid]});
        assert.equal(area[0].amount, 10);
    });

    it("no selection and no roll-time target applies to no one", () => {
        assert.deepEqual(planApplications("damage", {base, summaries: []}), []);
    });

    // A card rolled before the redesign has no data-apply payload: it never recorded a damage type,
    // so a selected token must not take its damage untyped.
    it("a card without a damage payload ignores the selection and uses its roll-time targets", () => {
        const old = planApplications("damage", {selected: [pc], summaries, resolveActor: uuid => actors[uuid]});
        assert.deepEqual(old.map(a => [a.actor.name, a.amount]), [["Kath Hound", 20]]);
        assert.deepEqual(planApplications("damage", {selected: [pc], summaries: []}), []);
    });
});

describe("applied result lines", () => {
    it("say why the damage changed", () => {
        const notes = [];
        resolveDamageTaken(20, ["Energy"], {damageReductions: [{value: 2}], notes, takesIonDamage: false, takesStunDamage: true});
        assert.deepEqual(notes, ["Damage Reduction 2"]);
        const saber = [];
        resolveDamageTaken(20, ["Energy"], {lightsaber: true, damageReductions: [{value: 2}], notes: saber, takesStunDamage: true});
        assert.deepEqual(saber, ["lightsabers ignore Damage Reduction"]);
        const droid = [];
        assert.equal(resolveDamageTaken(14, ["Stun"], {damageReductions: [], notes: droid, takesStunDamage: false}), 0);
        assert.deepEqual(droid, ["immune to Stun"]);
    });

    it("render damage, healing and zero with a sign and an escaped name", () => {
        assert.match(resultLineContent("Kath Hound", -18, "20 Energy, Damage Reduction 2"), /is-damage[\s\S]*−18[\s\S]*Kath Hound[\s\S]*Damage Reduction 2/);
        assert.match(resultLineContent("Jedi", 6), /is-heal[\s\S]*\+6/);
        assert.match(resultLineContent("<b>x</b>", 0), /is-zero[\s\S]*&lt;b&gt;x&lt;\/b&gt;/);
    });
});
