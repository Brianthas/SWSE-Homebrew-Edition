import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import SWSEActor from "../module/actor/actor.mjs";
import { Attack } from "../module/actor/attack/attack.mjs";
import { SIZE_CHANGES, SCALABLE_CHANGES } from "../module/common/constants.mjs";

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

    it("Force Disciples, Jedi Masters and Sith Lords reach every Force Tradition talent", () => {
        const tradition = talents.filter(t => t.system.possibleProviders.includes("Force Tradition Talent Trees") && t.system.talentTree !== "Aing-Tii Monk Talent Tree");
        assert.ok(tradition.length > 100);
        for (const pool of ["Force Disciple Talent Trees", "Jedi Master Talent Trees", "Sith Lord Talent Trees"]) {
            assert.deepEqual(tradition.filter(t => !t.system.possibleProviders.includes(pool)).map(t => t.name), [], pool);
        }
        // A Noble does not: the pools are per class
        assert.equal(tradition.filter(t => t.system.possibleProviders.includes("Noble Talent Trees")).length, 0);
    });

    it("the banned Agent of Ossus, Iron Knight and White Current Adept trees are gone", () => {
        for (const tree of ["Agent of Ossus", "Iron Knight", "White Current Adept"]) {
            assert.equal(providersOf(`${tree} Talent Tree`).length, 0, tree);
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
