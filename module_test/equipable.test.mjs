import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { SWSEItem } from "../module/item/item.mjs";
import SWSEActor from "../module/actor/actor.mjs";

// The getters read only type and subType, so they run against plain objects carrying the real
// prototype getters rather than constructed documents.
const GETTERS = ["isEquipable", "isBioPart", "isDroidPart"];
const makeItem = (type, subType) => {
    const item = {type, subType};
    for (const name of GETTERS) {
        Object.defineProperty(item, name, {get: Object.getOwnPropertyDescriptor(SWSEItem.prototype, name).get});
    }
    return item;
};

describe("SWSEItem#isEquipable", () => {
    // Subtypes read off the compendium: every implant carries a bio subtype and every droid
    // system a droid-part subtype, which is what the old exclusion keyed on.
    it("offers an Equip toggle on an implant", () => {
        assert.equal(makeItem("implant", "Cybernetic Devices").isEquipable, true);
    });

    it("offers an Equip toggle on a droid system", () => {
        assert.equal(makeItem("droid system", "Processor Systems").isEquipable, true);
    });

    it("offers an Equip toggle on equipment with a droid-part subtype", () => {
        assert.equal(makeItem("equipment", "Droid Accessories (Translator Units)").isEquipable, true);
    });

    it("still offers none on a vehicle system", () => {
        assert.equal(makeItem("vehicleSystem", "Weapon Systems").isEquipable, false);
    });
});

describe("SWSEActor#isEquipable", () => {
    // actor.equipped filters on this, and a droid built on a hand-made species reads isDroid false.
    it("accepts a droid system on an actor whose species does not flag it as a droid", () => {
        const item = makeItem("droid system", "Appendages");
        assert.equal(SWSEActor.prototype.isEquipable.call({isDroid: false}, item), true);
    });

    it("accepts an implant on a droid", () => {
        const item = makeItem("implant", "Implants");
        assert.equal(SWSEActor.prototype.isEquipable.call({isDroid: true}, item), true);
    });
});
