import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { meetsPrerequisites } from "../module/prerequisite.mjs";
import { SWSEItem } from "../module/item/item.mjs";

const source = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "packs", "_source");
const readPack = (pack, prefix) => {
    const file = fs.readdirSync(path.join(source, pack)).find(f => f.startsWith(prefix));
    assert.ok(file, `${pack}/${prefix}* not found`);
    return JSON.parse(fs.readFileSync(path.join(source, pack, file), "utf8"));
};

// The prerequisite under test is read off the pack, with #payload# substituted the way
// SWSEItem#setPayload does it when the item is taken.
const prerequisiteOf = (pack, prefix, payload) => {
    const json = JSON.stringify(readPack(pack, prefix).system.prerequisite);
    return JSON.parse(payload ? json.replace(/#payload#/g, payload) : json);
};

// An owned feat or talent. finalName comes from the real SWSEItem.buildItemName, so a selection
// appears in the name exactly as it does on a character: "Weapon Specialization (Rifles)".
const owned = (type, name, selection, system = {}) => {
    const item = {
        type, name, _source: {name}, effects: [], items: [],
        system: {selectedChoices: selection ? [selection] : [], changes: [], possibleProviders: [], talentTree: "", prerequisite: null, ...system}
    };
    Object.defineProperty(item, "finalName", {get: () => SWSEItem.buildItemName(item)});
    return item;
};

// meetsPrerequisites catches its own exceptions, logs them and reports a pass, so a check that
// threw would read as met. Any console output during a check fails the test instead.
const check = (prerequisite, items, bab = 0) => {
    const logged = [];
    const {error, warn} = console;
    console.error = (...args) => logged.push(args);
    console.warn = (...args) => logged.push(args);
    try {
        return meetsPrerequisites({system: {}, _baseAttackBonus: () => bab}, prerequisite, {embeddedItemOverride: items});
    } finally {
        console.error = error;
        console.warn = warn;
        assert.equal(logged.length, 0, `meetsPrerequisites logged: ${logged.map(args => args.map(String).join(" ")).join("; ")}`);
    }
};
const passes = (...args) => !check(...args).doesFail;

// An owned item built from the pack JSON itself, carrying whatever selection the JSON has.
const ownedFromPack = (pack, prefix) => {
    const json = readPack(pack, prefix);
    const item = {...json, _source: json, items: []};
    Object.defineProperty(item, "finalName", {get: () => SWSEItem.buildItemName(item)});
    return item;
};

describe("house rule: Greater Weapon Focus, Weapon Specialization and Greater Weapon Specialization as feats", () => {
    it("the feats exist in the feats pack, keyed to the same change as the talent", () => {
        for (const [prefix, key] of [["Greater_Weapon_Focus_", "greaterWeaponFocus"], ["Weapon_Specialization_", "weaponSpecialization"], ["Greater_Weapon_Specialization_", "greaterWeaponSpecialization"]]) {
            const feat = readPack("feats", prefix);
            assert.equal(feat.type, "feat");
            assert.deepEqual(feat.system.changes.find(c => c.key === key)?.value, "#payload#");
            assert.deepEqual(feat.system.changes.map(c => c.key), readPack("talents", prefix).system.changes.map(c => c.key));
        }
    });

    const gws = prerequisiteOf("talents", "Greater_Weapon_Specialization_yW0", "Rifles");
    const gwsFeat = prerequisiteOf("feats", "Greater_Weapon_Specialization_", "Rifles");

    for (const [label, prerequisite] of [["talent", gws], ["feat", gwsFeat]]) {
        it(`Greater Weapon Specialization ${label} accepts the Weapon Specialization feat`, () => {
            assert.equal(passes(prerequisite, [owned("feat", "Weapon Specialization", "Rifles")]), true);
        });

        it(`Greater Weapon Specialization ${label} accepts the Weapon Specialization talent`, () => {
            assert.equal(passes(prerequisite, [owned("talent", "Weapon Specialization", "Rifles")]), true);
        });

        it(`Greater Weapon Specialization ${label} needs Weapon Specialization in the same weapon`, () => {
            assert.equal(passes(prerequisite, [owned("feat", "Weapon Specialization", "Pistols")]), false);
            assert.equal(passes(prerequisite, [owned("talent", "Greater Weapon Focus", "Rifles")]), false);
        });
    }

    it("Greater Devastating Attack accepts the Greater Weapon Focus feat", () => {
        const prerequisite = prerequisiteOf("talents", "Greater_Devastating_Attack_", "Rifles");
        const devastating = owned("talent", "Devastating Attack", "Rifles");
        assert.equal(passes(prerequisite, [owned("feat", "Greater Weapon Focus", "Rifles"), devastating]), true);
        assert.equal(passes(prerequisite, [owned("feat", "Greater Weapon Focus", "Pistols"), devastating]), false);
    });

    it("Juyo accepts Weapon Specialization (Lightsabers) as a feat", () => {
        const prerequisite = prerequisiteOf("talents", "Juyo_");
        const focus = owned("feat", "Weapon Focus", "Lightsabers");
        assert.equal(passes(prerequisite, [focus, owned("feat", "Weapon Specialization", "Lightsabers")], 10), true);
        assert.equal(passes(prerequisite, [focus, owned("feat", "Weapon Specialization", "Rifles")], 10), false);
    });
});

describe("the Lightsabers variants", () => {
    // buildItemName appended the talent's own weaponSpecialization value to a name that already
    // carried it: "Weapon Specialization (Lightsabers) (Lightsabers)".
    it("the Weapon Specialization (Lightsabers) talent is named once", () => {
        assert.equal(ownedFromPack("talents", "Weapon_Specialization__Lightsabers__").finalName, "Weapon Specialization (Lightsabers)");
    });

    it("Juyo and Greater Weapon Specialization (Lightsabers) accept the Weapon Specialization (Lightsabers) talent", () => {
        const focus = owned("feat", "Weapon Focus", "Lightsabers");
        const specialization = ownedFromPack("talents", "Weapon_Specialization__Lightsabers__");
        assert.equal(passes(prerequisiteOf("talents", "Juyo_"), [focus, specialization], 10), true);
        assert.equal(passes(prerequisiteOf("talents", "Greater_Weapon_Specialization__Lightsabers__"), [focus, specialization]), true);
        assert.equal(passes(prerequisiteOf("talents", "Greater_Weapon_Specialization__Lightsabers__"), [focus]), false);
    });

    it("a granted item with no selection still takes its weapon from its change", () => {
        const proficiency = owned("feat", "Weapon Proficiency", undefined, {changes: [{key: "weaponProficiency", value: "Pistols", mode: 2}]});
        assert.equal(proficiency.finalName, "Weapon Proficiency (Pistols)");
    });

    it("Greater Weapon Focus and Greater Weapon Specialization (Lightsabers) carry the bonus their text grants", () => {
        assert.deepEqual(readPack("talents", "Greater_Weapon_Focus__Lightsabers__").system.changes.map(c => [c.key, c.value]), [["greaterWeaponFocus", "Lightsabers"]]);
        assert.deepEqual(readPack("talents", "Greater_Weapon_Specialization__Lightsabers__").system.changes.map(c => [c.key, c.value]), [["greaterWeaponSpecialization", "Lightsabers"]]);
    });
});

describe("an (Any) requirement", () => {
    // Crushing Assault asked for a bare "Weapon Specialization", which no talent taken with a
    // weapon selection is ever named.
    it("Crushing Assault accepts Weapon Specialization in any weapon, as a talent or a feat", () => {
        const prerequisite = prerequisiteOf("talents", "Crushing_Assault_");
        assert.equal(passes(prerequisite, [owned("talent", "Weapon Specialization", "Rifles")]), true);
        assert.equal(passes(prerequisite, [owned("feat", "Weapon Specialization", "Simple Weapons")]), true);
        assert.equal(passes(prerequisite, [owned("feat", "Weapon Focus", "Rifles")]), false);
    });

    it("Automated Strike accepts Double Attack in any weapon", () => {
        const prerequisite = prerequisiteOf("talents", "Automated_Strike_");
        assert.equal(passes(prerequisite, [owned("feat", "Double Attack", "Pistols")]), true);
        assert.equal(passes(prerequisite, [owned("feat", "Dual Weapon Mastery I")]), false);
    });
});

describe("two OR nodes in one check", () => {
    // Each OR used to be cached under {type: "OR", requirement: undefined}, so the second OR
    // returned the first one's answer.
    const eliteTrooper = prerequisiteOf("classes", "Elite_Trooper_");
    const feats = ["Armor Proficiency", "Martial Arts I", "Point-Blank Shot"].map(name => owned("feat", name));

    it("Elite Trooper fails without a talent from one of its four trees, though Point-Blank Shot satisfies the first OR", () => {
        assert.equal(passes(eliteTrooper, feats, 7), false);
    });

    it("Elite Trooper passes with a talent from the Weapon Specialist Talent Tree", () => {
        const talent = owned("talent", "Weapon Specialization", "Rifles", {talentTree: "Weapon Specialist Talent Tree"});
        assert.equal(passes(eliteTrooper, [...feats, talent], 7), true);
    });
});
