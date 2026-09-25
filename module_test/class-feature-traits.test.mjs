import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import SWSEActor from "../module/actor/actor.mjs";

const classes = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "packs", "_source", "classes");
const readClass = file => JSON.parse(fs.readFileSync(path.join(classes, file), "utf8"));

// The pack JSON stands in for the class item: _classFeatureTraits reads only `effects`, and the
// JSON's effects carry the same flags and system.changes the embedded documents do.
const gunslinger = readClass("Gunslinger_tWGM0A8Re3poIKQx.json");
const eliteTrooper = readClass(fs.readdirSync(classes).find(file => file.startsWith("Elite_Trooper_")));
const traitsFor = (classItem, level, ownedTraits = []) => SWSEActor.prototype._classFeatureTraits.call(
    {items: ownedTraits.map(name => ({type: "trait", name}))}, classItem, level);

describe("_classFeatureTraits", () => {
    it("grants the trait a level provides", () => {
        assert.deepEqual(traitsFor(gunslinger, 2), [{name: "Trusty Sidearm", type: "trait"}]);
    });

    it("grants nothing at a level that provides no trait", () => {
        assert.deepEqual(traitsFor(gunslinger, 1), []);
        assert.deepEqual(traitsFor(gunslinger, 3), []);
    });

    it("does not grant a trait the actor already has", () => {
        assert.deepEqual(traitsFor(gunslinger, 4, ["Trusty Sidearm"]), []);
    });

    it("grants each trait named at the level, once", () => {
        assert.deepEqual(traitsFor(eliteTrooper, 1).map(trait => trait.name), ["Delay Damage"]);
        assert.deepEqual(traitsFor(eliteTrooper, 2).map(trait => trait.name), ["Damage Reduction"]);
    });

    it("ignores an owned item of another type with the same name", () => {
        const owner = {items: [{type: "talent", name: "Trusty Sidearm"}]};
        assert.deepEqual(SWSEActor.prototype._classFeatureTraits.call(owner, gunslinger, 2), [{name: "Trusty Sidearm", type: "trait"}]);
    });
});
