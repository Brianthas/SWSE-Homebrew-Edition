import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import SWSEActor from "../module/actor/actor.mjs";
import { Attack } from "../module/actor/attack/attack.mjs";
import { SIZE_CHANGES, SCALABLE_CHANGES, skillDetails, getGroupedSkillMap } from "../module/common/constants.mjs";
import { fullAttackPenalties, attacksFromChoices } from "../module/actor/attack/attackDelegate.mjs";
import { parseAttackChoice } from "../module/common/util.mjs";

const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(repo, "packs", "_source");
const readPack = (pack, prefix) => {
    const file = fs.readdirSync(path.join(source, pack)).find(f => f.startsWith(prefix));
    assert.ok(file, `${pack}/${prefix}* not found`);
    return JSON.parse(fs.readFileSync(path.join(source, pack, file), "utf8"));
};
const allDocs = pack => fs.readdirSync(path.join(source, pack)).map(f => JSON.parse(fs.readFileSync(path.join(source, pack, f), "utf8")));

// applyDamage and applyHealing post their result to chat; the stubs capture the message so the
// test reads the number the GM's client would apply.
const posted = [];
const saved = {};
before(() => {
    for (const k of ["ChatMessage", "getDocumentClass"]) saved[k] = global[k];
    saved.sounds = global.CONFIG.sounds;
    saved.styles = global.CONST.CHAT_MESSAGE_STYLES;
    global.ChatMessage = {getSpeaker: () => ({}), applyMode: () => {}};
    global.getDocumentClass = () => class {
        constructor(data) { this.data = data; }
        static async create(msg) { posted.push(msg.data); return msg; }
    };
    global.CONFIG.sounds = {dice: ""};
    global.CONST.CHAT_MESSAGE_STYLES = {IC: 1, OOC: 2};
});
after(() => {
    for (const k of ["ChatMessage", "getDocumentClass"]) global[k] = saved[k];
    global.CONFIG.sounds = saved.sounds;
    global.CONST.CHAT_MESSAGE_STYLES = saved.styles;
});

// A target whose damage reduction and lightsaber blocking come from its own changes, read by the
// real getInheritableAttribute. Battle Armor's DR value is read from the pack.
const battleArmorDR = readPack("armor", "Battle_Armor_").system.damageReduction;
const target = ({droid = false, changes = [], cybernetic = false} = {}) => ({
    name: "Target", uuid: "Actor.target", type: droid ? "character" : "character",
    changes, effects: [],
    system: {shields: {active: false, value: 0}, health: {value: 10, max: 40}},
    takesFullDamageFromIon: droid || cybernetic,
    isEffectedByStun: !droid,
});
async function damage(actor, options) {
    posted.length = 0;
    await SWSEActor.prototype.applyDamage.call(actor, {skipShields: true, ...options});
    assert.equal(posted.length, 1);
    return posted[0].flags.swse.context.damage;
}

describe("damage types (house rules)", () => {
    it("Battle Armor's damage reduction is 2", () => assert.equal(battleArmorDR, 2));

    it("droids are immune to Stun, organics are not", async () => {
        assert.equal(await damage(target({droid: true}), {damage: 12, damageType: "Stun"}), 0);
        assert.equal(await damage(target(), {damage: 12, damageType: "Stun"}), 12);
        assert.equal(await damage(target({droid: true}), {damage: 12, damageType: "Energy (Stun)"}), 0);
    });

    it("organics are immune to Ion, droids and cybernetics take it in full", async () => {
        assert.equal(await damage(target(), {damage: 12, damageType: "Ion"}), 0);
        assert.equal(await damage(target(), {damage: 12, damageType: "Energy (Ion)"}), 0);
        assert.equal(await damage(target({droid: true}), {damage: 12, damageType: "Ion"}), 12);
        assert.equal(await damage(target({cybernetic: true}), {damage: 12, damageType: "Ion"}), 12);
    });

    it("damage reduction applies to an Energy blaster hit", async () => {
        const armored = target({changes: [{key: "damageReduction", value: battleArmorDR, mode: 2}]});
        assert.equal(await damage(armored, {damage: 12, damageType: "Energy"}), 12 - battleArmorDR);
    });

    it("lightsabers ignore damage reduction, unless the target blocks lightsabers", async () => {
        const armored = target({changes: [{key: "damageReduction", value: battleArmorDR, mode: 2}]});
        assert.equal(await damage(armored, {damage: 12, damageType: "Energy", lightsaber: true}), 12);
        const cortosis = target({changes: [{key: "damageReduction", value: battleArmorDR, mode: 2}, {key: "blocksLightsaber", value: true, mode: 2}]});
        assert.equal(await damage(cortosis, {damage: 12, damageType: "Energy", lightsaber: true}), 12 - battleArmorDR);
    });

    it("a DR modifier still names the damage types that bypass it", async () => {
        const energyBypass = target({changes: [{key: "damageReduction", value: 5, modifier: "Energy", mode: 2}]});
        assert.equal(await damage(energyBypass, {damage: 12, damageType: "Energy"}), 12);
        assert.equal(await damage(energyBypass, {damage: 12, damageType: "Physical"}), 7);
    });

    it("an attack with a lightsaber reports itself as one; a blaster pistol does not", () => {
        const get = Object.getOwnPropertyDescriptor(Attack.prototype, "isLightsaberAttack").get;
        assert.equal(get.call({item: readPack("weapon", "Lightsaber_JDuBll")}), true);
        assert.equal(get.call({item: readPack("weapon", "Blaster_Pistol_")}), false);
        assert.equal(get.call({item: {type: "beastAttack", system: {}}}), false);
    });
});

describe("Toughness", () => {
    it("carries +1 healing received", () => {
        const changes = readPack("feats", "Toughness_").system.changes;
        assert.deepEqual(changes.filter(c => c.key === "healingReceivedBonus").map(c => c.value), [1]);
    });

    it("applyHealing adds the bonus to a heal and caps at maximum HP", async () => {
        const healed = async (bonus, heal) => {
            posted.length = 0;
            const actor = {...target(), healingReceivedBonus: bonus};
            await SWSEActor.prototype.applyHealing.call(actor, {heal});
            return -posted[0].flags.swse.context.damage;
        };
        assert.equal(await healed(0, 8), 8);
        assert.equal(await healed(2, 8), 10);
        assert.equal(await healed(2, 29), 30);
    });
});

describe("Maneuver Defense", () => {
    it("is Damage Threshold + 5, not Fortitude + 5", () => {
        const get = Object.getOwnPropertyDescriptor(SWSEActor.prototype, "maneuverDefense").get;
        const actor = {type: "character", getCached: (k, fn) => fn(), system: {defense: {fortitude: {total: 15}, damageThreshold: {total: 20}}}};
        assert.equal(get.call(actor), 25);
    });
});

describe("unarmed damage and Stealth by size", () => {
    const unarmed = rows => Object.fromEntries(["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"]
        .map(size => [size, rows[size].find(c => c.key === "unarmedDamage")?.value]));
    const RULE = {Tiny: "1d3", Small: "1d4", Medium: "1d6", Large: "1d8", Huge: "1d10", Gargantuan: "1d12"};

    it("both size tables give the house-rule unarmed die", () => {
        assert.deepEqual(unarmed(SIZE_CHANGES), RULE);
        assert.deepEqual(unarmed(SCALABLE_CHANGES.unarmedDamageScalable["1d4"]), RULE);
    });

    it("Small gets Stealth training instead of +5, Large keeps -5", () => {
        const stealth = SCALABLE_CHANGES.skillBonusScalable["stealth:0"];
        assert.deepEqual(stealth.Small.map(c => c.value), ["stealth:0"]);
        assert.deepEqual(stealth.Large.map(c => c.value), ["stealth:-5"]);
    });
});

describe("full attack penalties", () => {
    const weapon = (subtype, weaponReduction = 0) => ({standardAttack: true, subtype, weaponReduction});
    const total = mods => mods.reduce((sum, m) => sum + m.value, 0);
    const reductionOf = prefix => readPack("weapon", prefix).system.changes.filter(c => c.key === "dualWieldPenaltyReduction").map(c => c.value);

    it("two weapons: -10, or the Dual Weapon Mastery value", () => {
        const two = [weapon("Pistols"), weapon("Rifles")];
        assert.deepEqual(fullAttackPenalties(two), [{type: "attack", value: -10, source: "Dual Weapon"}]);
        assert.equal(total(fullAttackPenalties(two, {dualWeaponModifier: -5})), -5);
        assert.deepEqual(fullAttackPenalties(two, {dualWeaponModifier: 0}), []);
    });

    it("each weapon that reduces the dual-wielding penalty takes 2 off, never past 0", () => {
        const knives = [weapon("Advanced Melee", 2), weapon("Advanced Melee", 2)];
        assert.equal(total(fullAttackPenalties(knives)), -6);
        assert.equal(total(fullAttackPenalties(knives, {dualWeaponModifier: -5})), -1);
        assert.deepEqual(fullAttackPenalties(knives, {dualWeaponModifier: -2}), []);
        assert.equal(total(fullAttackPenalties([weapon("Advanced Melee", 2), weapon("Pistols")])), -8);
    });

    it("Shoto Master takes another 2 off only when both weapons are lightsabers", () => {
        const shoto = readPack("talents", "Shoto_Master_").system.changes.filter(c => c.key === "dualWieldPenaltyReduction").map(c => c.value);
        assert.deepEqual(shoto, ["2:Lightsabers"]);
        const sabers = [weapon("Lightsabers"), weapon("Lightsabers", reductionOf("Shotosaber_")[0])];
        assert.equal(total(fullAttackPenalties(sabers, {talentReductions: shoto})), -6);
        assert.equal(total(fullAttackPenalties([weapon("Lightsabers"), weapon("Pistols")], {talentReductions: shoto})), -10);
    });

    it("Double Attack is -5 and Triple Attack another -5; one weapon alone is no dual-wielding", () => {
        const double = [weapon("Pistols"), {doubleAttack: true, subtype: "Pistols"}];
        assert.deepEqual(fullAttackPenalties(double).map(m => [m.source, m.value]), [["Double Attack", -5]]);
        const triple = [...double, {tripleAttack: true, subtype: "Pistols"}];
        assert.equal(total(fullAttackPenalties(triple)), -10);
        assert.equal(total(fullAttackPenalties([weapon("Pistols"), weapon("Rifles"), {doubleAttack: true}])), -15);
    });

    it("a weapon and a natural attack count as dual-wielding", () => {
        assert.equal(total(fullAttackPenalties([weapon("Pistols"), {beastAttack: true}])), -10);
    });

    it("Additional Arms reduces the combined penalty by 2, never into a bonus", () => {
        const two = [weapon("Pistols"), weapon("Rifles")];
        assert.equal(total(fullAttackPenalties(two, {multipleAttackModifiers: [2]})), -8);
        assert.deepEqual(fullAttackPenalties(two, {dualWeaponModifier: 0, multipleAttackModifiers: [2]}), []);
    });

    it("the six weapons with the property carry a reduction of 2 and nothing reads the old -8", () => {
        for (const prefix of ["Crystal_Tomahawk_", "Electrostaff_", "Lightsaber_Staff_", "Shotosaber_", "Vibroknife_", "Vibrostaff_"]) {
            assert.deepEqual(reductionOf(prefix), [2], prefix);
            assert.equal(readPack("weapon", prefix).system.changes.some(c => c.key === "dualWeaponModifier"), false, prefix);
        }
    });
});

describe("full attack choices", () => {
    const base = Attack.create({actorId: "Actor.a", weaponId: "Actor.a.Item.pistol", operatorId: "Actor.a"});
    const delegate = {attacks: [base, Attack.create({actorId: "Actor.a", weaponId: "CustomAttack:x", operatorId: "Actor.a"})]};

    it("reads a dialog value and a bare key", () => {
        assert.deepEqual(parseAttackChoice("Actor.a.Item.pistol|DOUBLE_ATTACK|0"), {attackKey: "Actor.a.Item.pistol", kind: "DOUBLE_ATTACK", instance: 0,
            standardAttack: false, beastAttack: false, doubleAttack: true, tripleAttack: false, additionalAttack: 0});
        assert.equal(parseAttackChoice("Actor.a.Item.pistol").standardAttack, true);
        assert.equal(parseAttackChoice("CustomAttack:x|STANDARD|0").attackKey, "CustomAttack:x");
    });

    it("keeps a Double Attack and a second copy of the same weapon as separate attacks", () => {
        const picked = attacksFromChoices(delegate, ["Actor.a.Item.pistol|STANDARD|0", "Actor.a.Item.pistol|DOUBLE_ATTACK|0", "Actor.a.Item.pistol|STANDARD|1"]);
        assert.equal(picked.length, 3);
        assert.deepEqual(picked.map(a => [!!a.options.doubleAttack, a.options.duplicateCount]), [[false, 0], [true, 0], [false, 1]]);
        assert.ok(picked.every(a => a !== base));
        assert.deepEqual(base.options, {});
    });

    it("a bare key and a custom attack key still resolve", () => {
        assert.equal(attacksFromChoices(delegate, ["Actor.a.Item.pistol"])[0], base);
        assert.equal(attacksFromChoices(delegate, ["CustomAttack:x|STANDARD|0"]).length, 1);
        assert.equal(attacksFromChoices(delegate, ["--", "Actor.a.Item.unknown|STANDARD|0"]).length, 0);
    });
});

describe("armor check penalty skills", () => {
    it("applies to Acrobatics, Athletics, Endurance, Initiative and Stealth only", () => {
        const acp = Object.entries(skillDetails).filter(([, d]) => d.acp).map(([name]) => name).sort();
        assert.deepEqual(acp, ["Acrobatics", "Endurance", "Initiative", "Stealth"]);
        assert.equal(getGroupedSkillMap().get("Athletics").acp, true);
        assert.equal(getGroupedSkillMap().get("Knowledge (Sciences)").acp, undefined);
    });

    it("the non-proficiency -10 is gone", () => {
        assert.equal(fs.existsSync(path.join(repo, "module", "actor", "armor-check-penalty.mjs")), false);
    });
});

describe("pack content (house rules)", () => {
    const talents = allDocs("talents").filter(d => d.type === "talent");
    const providersOf = tree => talents.filter(t => t.system.talentTree === tree).map(t => t.system.possibleProviders);

    it("Nobles reach Fortune, Misfortune, Run and Gun, Smuggling and Spy", () => {
        for (const tree of ["Fortune", "Misfortune", "Run and Gun", "Smuggling", "Spy"]) {
            const providers = providersOf(`${tree} Talent Tree`);
            assert.ok(providers.length > 0, tree);
            assert.ok(providers.every(p => p.includes("Noble Talent Trees")), tree);
        }
    });

    it("Soldiers reach Awareness and Opportunist", () => {
        for (const tree of ["Awareness", "Opportunist"]) {
            const providers = providersOf(`${tree} Talent Tree`);
            assert.ok(providers.length > 0 && providers.every(p => p.includes("Soldier Talent Trees")), tree);
        }
    });

    // Banned for play unless the GM agrees; they stay in the compendium so the GM can grant them.
    const BANNED = ["Agent of Ossus", "Aing-Tii Monk", "Iron Knight", "White Current Adept"].map(t => `${t} Talent Tree`);

    it("Force Disciples, Jedi Masters and Sith Lords reach every Force Tradition talent outside the banned trees", () => {
        const tradition = talents.filter(t => t.system.possibleProviders.includes("Force Tradition Talent Trees") && !BANNED.includes(t.system.talentTree));
        assert.ok(tradition.length > 100);
        for (const pool of ["Force Disciple Talent Trees", "Jedi Master Talent Trees", "Sith Lord Talent Trees"]) {
            assert.deepEqual(tradition.filter(t => !t.system.possibleProviders.includes(pool)).map(t => t.name), [], pool);
        }
        // A Noble does not: the pools are per class
        assert.equal(tradition.filter(t => t.system.possibleProviders.includes("Noble Talent Trees")).length, 0);
    });

    it("the banned trees stay in the compendium, outside the prestige classes' tradition access", () => {
        for (const tree of BANNED) {
            const providers = providersOf(tree);
            assert.ok(providers.length >= 4, tree);
            assert.ok(providers.every(p => !p.includes("Noble Talent Trees")), tree);
        }
        for (const tree of BANNED.filter(t => t !== "Aing-Tii Monk Talent Tree")) {
            assert.ok(providersOf(tree).every(p => !p.includes("Force Disciple Talent Trees")), tree);
        }
        assert.ok(talents.some(t => t.name === "Many Shades of the Force"));
    });

    it("Force Training and Force Regimen Mastery count from Intelligence", () => {
        const grants = name => readPack("feats", name).system.changes.filter(c => c.key === "provides").map(c => c.value);
        assert.deepEqual(grants("Force_Training_"), ["Force Powers:MAX(1 + @INTMOD,1)"]);
        assert.deepEqual(grants("Force_Regimen_Mastery_"), ["Force Regimen:MAX(1 + @INTMOD,1)"]);
    });

    it("no prerequisite names a skill the house rules folded away", () => {
        const found = [];
        const walk = (p, where) => {
            if (!p || typeof p !== "object") return;
            if (typeof p.requirement === "string" && (/^(Climb|Jump|Swim)$/.test(p.requirement) || /(Life|Physical|Social) Sciences/.test(p.requirement))) found.push(`${where}: ${p.requirement}`);
            for (const c of p.children ? Object.values(p.children) : []) walk(c, where);
        };
        for (const pack of ["feats", "talents", "beasts"]) {
            for (const d of allDocs(pack)) {
                walk(d.system?.prerequisite, d.name);
                for (const it of d.items || []) walk(it.system?.prerequisite, `${d.name} > ${it.name}`);
            }
        }
        assert.deepEqual(found, []);
        assert.ok(readPack("feats", "Recall_").system.prerequisite.children.every(c => c.type === "TRAINED SKILL"));
    });

    it("item text carries the house rule", () => {
        const text = (pack, prefix) => readPack(pack, prefix).system.description;
        assert.ok(!text("talents", "Lightsaber_Throw_").includes("DC 20"));
        assert.ok(text("talents", "Blaster_Turret_I_").includes("Reflex Defense 14 + INT, HP is 10 + LVL"));
        assert.ok(text("talents", "Blaster_Turret_II_").includes("Reflex Defense 18 + INT, HP is 15 + LVL"));
        assert.ok(!text("talents", "Blaster_Turret_III_").includes("-5"));
        assert.ok(text("force-powers", "Negate_Energy_").includes("damage reduction"));
        assert.ok(text("talents", "Folded_Space_Mastery_").includes("extremely slow"));
        assert.ok(!text("talents", "Folded_Space_Mastery_").includes("instantaneous"));
        assert.ok(!text("feats", "Force_Boon_").includes("three additional"));
        assert.equal(readPack("feats", "Force_Boon_").system.prerequisite, null);
        assert.equal(readPack("droid-system", "Vocabulator_").system.cost, "1000");
    });

    it("the Legacy Weapons pack is gone", () => {
        const system = JSON.parse(fs.readFileSync(path.join(repo, "system.json"), "utf8"));
        assert.equal(system.packs.filter(p => /legacy/i.test(p.name)).length, 0);
        assert.equal(fs.existsSync(path.join(source, "legacy-weapon")), false);
    });
});
