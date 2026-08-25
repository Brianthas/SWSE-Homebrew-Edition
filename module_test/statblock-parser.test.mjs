/**
 * Unit tests for the wiki statblock parser.
 *
 * Runs under plain `node --test module_test/statblock-parser.test.mjs` with no Foundry mocks,
 * because statblock-parser.mjs imports nothing. Keep it that way: the mocks in setup.mjs are
 * currently incomplete (the system module graph throws "Handlebars is not defined" at
 * module/common/helpers.mjs:401), so any test that reaches into the graph cannot run at all.
 *
 * Fixtures in resources/statblocks/ are verbatim wikitext from the SWSE fandom wiki, fetched via
 * the MediaWiki API. They are checked in so these tests never depend on the network or on the wiki
 * staying unchanged.
 */
import {test, describe} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import path from "node:path";

import {parseStatblock, stripMarkup, splitTop, parseEntry} from "../module/import/statblock-parser.mjs";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "resources", "statblocks");
const load = name => parseStatblock(readFileSync(path.join(FIXTURES, `${name}.wikitext`), "utf8"));

const names = list => (list ?? []).map(entry => entry.name);

describe("stripMarkup", () => {
    test("keeps the display half of a piped link", () => {
        // The pack item is named "Lightsaber"; the wiki page is "Lightsaber (Weapon)". Taking the
        // target instead of the display text would make this unresolvable.
        assert.equal(stripMarkup("[[Lightsaber (Weapon)|Lightsaber]]"), "Lightsaber");
    });

    test("keeps a payload that is part of the item name", () => {
        assert.equal(stripMarkup("[[Weapon Focus (Rifles)]]"), "Weapon Focus (Rifles)");
    });

    test("removes bold and italic runs", () => {
        assert.equal(stripMarkup("'''[[Block]]'''"), "Block");
        assert.equal(stripMarkup("''[[Force Grip]]''"), "Force Grip");
    });
});

describe("splitTop", () => {
    test("does not split commas nested inside parentheses", () => {
        const parts = splitTop("Use the Force +17 (may reroll, may substitute), Pilot +17");
        assert.deepEqual(parts, ["Use the Force +17 (may reroll, may substitute)", "Pilot +17"]);
    });

    test("survives nested parentheses", () => {
        const parts = splitTop("Custom Armor (As Flight Suit with Helmet (+8 Reflex, Low-Light)), Sith Robes");
        assert.equal(parts.length, 2);
        assert.equal(parts[1], "Sith Robes");
    });
});

describe("parseEntry", () => {
    test("reads a numeric parenthetical as a quantity", () => {
        const entry = parseEntry("[[Force Training]] (3)");
        assert.equal(entry.name, "Force Training");
        assert.equal(entry.quantity, 3);
        assert.equal(entry.payload, null);
    });

    test("reads a non-numeric parenthetical as a payload and keeps the full name", () => {
        const entry = parseEntry("[[Weapon Focus (Rifles)]]");
        assert.equal(entry.name, "Weapon Focus (Rifles)");
        assert.equal(entry.payload, "Rifles");
        assert.equal(entry.baseName, "Weapon Focus");
        assert.equal(entry.quantity, 1);
    });
});

describe("Kath Hound (CL 3 beast)", () => {
    const block = load("kath_hound");

    test("reads the heading and type line", () => {
        assert.equal(block.name, "Kath Hound");
        assert.equal(block.cl, "3");
        assert.equal(block.size, "Small");
        assert.equal(block.species, null);
        assert.deepEqual(block.classes, [{name: "Beast", levels: 4}]);
    });

    test("reads all six ability scores", () => {
        assert.deepEqual(block.abilities, {str: 14, dex: 10, con: 12, int: 2, wis: 9, cha: 8});
    });

    test("reads every printed defensive number", () => {
        // These are captured for the divergence report only, never written to the actor.
        assert.equal(block.printed.reflex, 14);
        assert.equal(block.printed.flatFooted, 14);
        assert.equal(block.printed.fortitude, 12);
        assert.equal(block.printed.will, 10);
        assert.equal(block.printed.hitPoints, 18);
        assert.equal(block.printed.damageThreshold, 12);
        assert.equal(block.printed.baseAttackBonus, 3);
        assert.equal(block.printed.grapple, 0);
    });

    test("reads a plural natural weapon as a quantity", () => {
        // The compendium entry is "Claw", singular; "Claws (2)" means two of them.
        const claws = block.attacks.find(a => a.name === "Claws");
        assert.ok(claws, "expected a Claws attack");
        assert.equal(claws.quantity, 2);
    });

    test("captures the skill that this fork no longer has", () => {
        // Jump was folded into Athletics by the house rules. The parser reports it faithfully;
        // remapping is the mapper's job.
        assert.deepEqual(block.skills.map(s => [s.name, s.bonus]), [["Jump", 9]]);
    });

    test("accounts for every line", () => {
        assert.deepEqual(block.unparsed, []);
    });
});

describe("Rancor (CL 11 beast)", () => {
    const block = load("rancor");

    test("reads size and beast levels", () => {
        assert.equal(block.size, "Huge");
        assert.deepEqual(block.classes, [{name: "Beast", levels: 12}]);
    });

    test("flags footnoted attacks", () => {
        // "Bite +11* (2d6+20)" with "*Includes 6 points of Power Attack". The asterisk means the
        // printed bonus already bakes in a feat that does not exist in this fork.
        const bite = block.attacks.find(a => a.name === "Bite");
        assert.equal(bite.bonus, 11);
        assert.equal(bite.footnoted, true);
    });

    test("reads species traits as entries", () => {
        assert.deepEqual(names(block.speciesTraits), ["Fast Healing 5", "Low-Light Vision"]);
    });

    test("reports the deleted feat rather than hiding it", () => {
        assert.ok(names(block.feats).includes("Power Attack"));
    });

    test("keeps a trailing prose section as notes, not as fields", () => {
        assert.deepEqual(block.unparsed, []);
        assert.ok(block.notes.some(n => n.startsWith("Fast Healing 5: A Rancor")));
    });
});

describe("Stormtrooper (CL 1 nonheroic)", () => {
    const block = load("stormtrooper");

    test("separates species from class on the type line", () => {
        assert.equal(block.size, "Medium");
        assert.equal(block.species, "Human");
        assert.deepEqual(block.classes, [{name: "Nonheroic", levels: 4}]);
    });

    test("reads feats with their payloads intact", () => {
        assert.ok(names(block.feats).includes("Weapon Focus (Rifles)"));
        assert.ok(names(block.feats).includes("Weapon Proficiency (Simple Weapons)"));
    });

    test("reads languages and possessions", () => {
        assert.deepEqual(block.languages, ["Basic"]);
        assert.ok(names(block.possessions).some(n => n.startsWith("Stormtrooper Armor")));
        assert.ok(names(block.possessions).includes("Blaster Rifle"));
    });

    test("accounts for every line", () => {
        assert.deepEqual(block.unparsed, []);
    });
});

describe("Darth Vader (CL 19 heroic, five classes)", () => {
    const block = load("darth_vader");

    test("reads a multiclass type line in order", () => {
        assert.equal(block.species, "Human");
        assert.deepEqual(block.classes, [
            {name: "Jedi", levels: 7},
            {name: "Jedi Knight", levels: 5},
            {name: "Ace Pilot", levels: 2},
            {name: "Sith Apprentice", levels: 2},
            {name: "Sith Lord", levels: 3}
        ]);
    });

    test("reads a repeated feat as a quantity", () => {
        const forceTraining = block.feats.find(f => f.name === "Force Training");
        assert.equal(forceTraining.quantity, 3);
    });

    test("reads the merged-away talents so the mapper can collapse them", () => {
        // Block and Deflect both become Dueling Stance here, and Redirect Shot becomes
        // Redirection Stance. The parser must surface all three for that to be possible.
        const talents = names(block.talents);
        assert.ok(talents.includes("Block"));
        assert.ok(talents.includes("Deflect"));
        assert.ok(talents.includes("Redirect Shot"));
    });

    test("reads the force power suite and its governing skill", () => {
        assert.equal(block.forceSuiteSkill, "use the force +17");
        assert.equal(block.forcePowers.length, 9);
        assert.ok(names(block.forcePowers).includes("Move Object"));
        assert.deepEqual(names(block.forceSecrets), ["Distant Power", "Multitarget Power"]);
        assert.equal(block.forceTechniques.length, 3);
    });

    test("keeps a skill note without splitting on its internal comma", () => {
        const useTheForce = block.skills.find(s => s.name === "Use the Force");
        assert.equal(useTheForce.bonus, 17);
        assert.match(useTheForce.note, /may substitute for Pilot checks/);
    });

    test("printed lightsaber damage is RAW and must not be imported", () => {
        // This is the whole reason numbers are not imported: the wiki prints 2d8 because that is
        // RAW, while this fork's Lightsaber is 3d8 (packs/_source/weapon/Lightsaber_*.json).
        // Importing the printed damage would give every imported Jedi the wrong dice.
        const primary = block.attacks.find(a => a.name === "Lightsaber" && a.bonus === 23);
        assert.equal(primary.damage, "2d8+17");
    });

    test("accounts for every line", () => {
        assert.deepEqual(block.unparsed, []);
    });
});
