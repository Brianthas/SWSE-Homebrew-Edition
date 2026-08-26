/**
 * Tests for building an item out of a statblock entry this fork has no match for.
 *
 * The strings here are copied verbatim from live wiki statblocks (Darth Vader's Possessions line,
 * a Stormtrooper's armor) because the whole risk in this feature is reading a real bracket wrong.
 * Runs under plain `node --test`; the module has no imports.
 */
import {test, describe} from "node:test";
import assert from "node:assert/strict";

import {buildImprovisedItem, readBonuses, splitPrinted} from "../module/import/statblock-improvise.mjs";
import {skills} from "../module/common/constants.mjs";

const SKILLS = skills("character");

/** Darth Vader's Possessions line, exactly as the wiki prints it. */
const VADER_ARMOR = "Custom Armor (As Armored Flight Suit with Helmet Package "
    + "(+8 Reflex; +2 Perception, Low-Light Vision))";

describe("splitPrinted", () => {
    test("takes the whole outer bracket, not the first inner one", () => {
        const {name, detail} = splitPrinted(VADER_ARMOR);
        assert.equal(name, "Custom Armor");
        // The failure this guards: a lazy regex stops at the inner ")" and silently drops
        // "+2 Perception, Low-Light Vision", so the item would carry only half its bonuses.
        assert.match(detail, /\+2 Perception/);
        assert.match(detail, /Low-Light Vision/);
    });

    test("leaves an entry with no bracket alone", () => {
        assert.deepEqual(splitPrinted("Sith Robes"), {name: "Sith Robes", detail: ""});
    });

    test("ignores a bracket that does not close the entry", () => {
        const {name, detail} = splitPrinted("Cybernetic Prosthesis (4) both arms");
        assert.equal(name, "Cybernetic Prosthesis (4) both arms");
        assert.equal(detail, "");
    });
});

describe("readBonuses", () => {
    const names = new Set(SKILLS.map(s => s.toLowerCase()));

    test("reads defenses and skills out of Vader's armor", () => {
        const {changes, applied, leftover} = readBonuses(splitPrinted(VADER_ARMOR).detail, names);
        const byKey = Object.fromEntries(changes.map(c => [c.key, c.value]));
        assert.equal(byKey.reflexDefenseBonus, "8");
        assert.equal(byKey.skillBonus, "Perception:2:IMPORTED");
        assert.deepEqual(applied, ["+8 Reflex", "+2 Perception"]);
        // Low-Light Vision is a trait, not a bonus, so it stays as text for the GM.
        assert.ok(leftover.some(l => /Low-Light Vision/.test(l)));
    });

    test("reads a plain armor bracket", () => {
        const {changes} = readBonuses("+6 Reflex, +2 Fortitude", names);
        assert.deepEqual(changes.map(c => `${c.key}=${c.value}`),
            ["reflexDefenseBonus=6", "fortitudeDefenseBonus=2"]);
    });

    test("accepts 'Reflex Defense' as well as 'Reflex'", () => {
        const {changes} = readBonuses("+4 Reflex Defense", names);
        assert.equal(changes[0].key, "reflexDefenseBonus");
    });

    test("never invents a change for something this fork has no key for", () => {
        // A dead change is worse than none: getInheritableAttribute returns nothing for an unknown
        // key, so the sheet would show a bonus that never applies to any roll.
        const {changes, leftover} = readBonuses("+3 Threat Range, +2 Nonsense Skill", names);
        assert.deepEqual(changes, []);
        assert.equal(leftover.length, 2);
    });

    test("handles a negative bonus", () => {
        const {changes} = readBonuses("-2 Will", names);
        assert.equal(changes[0].value, "-2");
    });
});

describe("buildImprovisedItem", () => {
    test("builds a usable armor item from Vader's line", () => {
        const row = {name: "Custom Armor", type: "armor", printed: VADER_ARMOR};
        const {payload, applied, leftover} = buildImprovisedItem(row, {skills: SKILLS});
        assert.equal(payload.name, "Custom Armor");
        // equipment, NOT armor or weapon: the row's type is only the resolver's first candidate,
        // and building a weapon gave Vader an attack with his own armour.
        assert.equal(payload.type, "equipment");
        assert.equal(payload.system.changes.length, 2);
        assert.deepEqual(applied, ["+8 Reflex", "+2 Perception"]);
        assert.ok(leftover.length > 0);
        // The GM has to be able to read what was and was not automated.
        assert.match(payload.system.description, /Applied as bonuses/);
        assert.match(payload.system.description, /Not automated/);
    });

    test("never builds a weapon, whatever the row's guessed type says", () => {
        for (const type of ["weapon", "armor", "possession", undefined]) {
            const {payload} = buildImprovisedItem({name: "Odd Thing", type}, {skills: SKILLS});
            assert.equal(payload.type, "equipment", `row type ${type} must still build equipment`);
        }
        const {payload} = buildImprovisedItem({name: "Odd Thing", type: "possession"}, {skills: SKILLS});
        assert.deepEqual(payload.system.changes, []);
        assert.match(payload.system.description, /No bonuses were applied/);
    });

    test("escapes wiki text rather than trusting it as HTML", () => {
        const row = {name: "X", type: "equipment", printed: 'X (<img src=x onerror=alert(1)> +2 Perception)'};
        const {payload} = buildImprovisedItem(row, {skills: SKILLS});
        assert.ok(!payload.system.description.includes("<img"));
        assert.match(payload.system.description, /&lt;img/);
    });
});
