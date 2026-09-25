import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
    ATTACK_OPTION_DEFINITIONS,
    COMBAT_TOGGLE_DEFINITIONS,
    getAvailableCombatToggles,
    getClassLevel
} from "../module/actor/attack/combat-toggle.mjs";

const definition = id => [...COMBAT_TOGGLE_DEFINITIONS, ...ATTACK_OPTION_DEFINITIONS].find(def => def.id === id);
const amountAt = (id, level) => definition(id).bonus.amount(level);
const classItem = (name, levels) => ({type: "class", name, levelsTaken: Array.from({length: levels}, (_, i) => i + 1)});

describe("getClassLevel", () => {
    it("counts levels in the named class only", () => {
        const actor = {items: [classItem("Operative", 3), classItem("Soldier", 7)]};
        assert.equal(getClassLevel(actor, "Operative"), 3);
        assert.equal(getClassLevel(actor, "Soldier"), 7);
    });

    it("sums every class item of that name", () => {
        // Older actors carry one class item per level rather than one item with levelsTaken.
        const actor = {items: [classItem("Bounty Hunter", 1), classItem("Bounty Hunter", 1), classItem("Bounty Hunter", 1)]};
        assert.equal(getClassLevel(actor, "Bounty Hunter"), 3);
    });

    it("ignores a talent or trait sharing the class's name", () => {
        const actor = {items: [classItem("Agent", 2), {type: "talent", name: "Agent", levelsTaken: [1, 2, 3]}]};
        assert.equal(getClassLevel(actor, "Agent"), 2);
    });

    it("is 0 without the class", () => {
        assert.equal(getClassLevel({items: [classItem("Jedi", 5)]}, "Operative"), 0);
    });
});

describe("class feature bonus ladders", () => {
    it("Hunter's Target is the full class level", () => {
        assert.deepEqual([1, 2, 7].map(level => amountAt("huntersTarget", level)), [1, 2, 7]);
    });

    for (const id of ["mark", "familiarFoe", "targetedSuspect", "surpriseAttack"]) {
        it(`${id} is one-half class level, rounded down`, () => {
            assert.deepEqual([1, 2, 3, 4, 9, 10].map(level => amountAt(id, level)), [0, 1, 1, 2, 4, 5]);
        });
    }

    it("Unarmed Stun steps up at 2nd, 6th and 10th level", () => {
        assert.deepEqual([1, 2, 5, 6, 9, 10].map(level => amountAt("unarmedStun", level)), [0, 1, 1, 2, 2, 3]);
    });

    it("Veteran Privateer is +2 from the first level with a use", () => {
        assert.deepEqual([1, 2, 8].map(level => amountAt("veteranPrivateer", level)), [0, 2, 2]);
    });

});

describe("getAvailableCombatToggles", () => {
    // Hunter's Target is gated on a talent item rather than a change key, so a plain actor
    // exercises the class-level lookup end to end without the attribute pipeline.
    const bountyHunter = (levels, talents) => ({
        items: [classItem("Bounty Hunter", levels), ...talents.map(name => ({type: "talent", name}))],
        system: {combatToggles: {huntersTarget: true}},
    });
    const huntersTarget = actor => getAvailableCombatToggles(actor).find(toggle => toggle.id === "huntersTarget");

    it("offers Hunter's Target at the Bounty Hunter level with the talent", () => {
        assert.deepEqual(huntersTarget(bountyHunter(3, ["Hunter's Target"])),
            {id: "huntersTarget", label: "Hunter's Target", summary: "+3 damage", active: true});
    });

    it("does not offer it without the talent", () => {
        assert.equal(huntersTarget(bountyHunter(3, ["Hunter's Mark"])), undefined);
    });

    it("does not offer it with the talent but no Bounty Hunter levels", () => {
        assert.equal(huntersTarget(bountyHunter(0, ["Hunter's Target"])), undefined);
    });
});

describe("definitions agree with the packs", () => {
    const source = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "packs", "_source");
    const readDir = dir => fs.readdirSync(path.join(source, dir))
        .filter(file => file.endsWith(".json"))
        .map(file => JSON.parse(fs.readFileSync(path.join(source, dir, file), "utf8")));

    // Class name -> every change key its level effects write.
    const classKeys = new Map(readDir("classes").map(cls => [cls.name,
        new Set((cls.effects || []).flatMap(effect => effect.system?.changes || []).map(change => change.key))]));
    const talentNames = new Set(readDir("talents").map(talent => talent.name));

    for (const def of [...COMBAT_TOGGLE_DEFINITIONS, ...ATTACK_OPTION_DEFINITIONS].filter(def => def.bonus.className)) {
        it(`${def.id}: ${def.bonus.className} exists and grants it`, () => {
            assert.ok(classKeys.has(def.bonus.className), `no class named ${def.bonus.className}`);
            const key = def.availability.grantAttributeKey;
            if (key) {
                assert.ok(classKeys.get(def.bonus.className).has(key), `${def.bonus.className} never writes ${key}`);
            } else {
                assert.ok(talentNames.has(def.availability.talentName), `no talent named ${def.availability.talentName}`);
            }
        });
    }
});
