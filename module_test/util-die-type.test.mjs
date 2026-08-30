import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { increaseDieType } from "../module/common/util.mjs";
import { dieType } from "../module/common/constants.mjs";

// Expected sizes are read off dieType rather than typed in, so these assertions compare the code
// against the system's own ladder instead of against someone's memory of it.
const MAX = dieType[dieType.length - 1];
const stepUp = (size, by = 1) => dieType[dieType.indexOf(size) + by];

describe("increaseDieType", () => {
    describe("inside the ladder", () => {
        it("raises the die one step", () => {
            assert.equal(increaseDieType("1d6", 1), `1d${stepUp("6")}`);
        });

        it("leaves the die alone with no bonus", () => {
            assert.equal(increaseDieType("1d6", 0), "1d6");
        });

        it("lands exactly on the top of the ladder", () => {
            assert.equal(increaseDieType(`1d${stepUp(MAX, -1)}`, 1), `1d${MAX}`);
        });
    });

    describe("past the top of the ladder", () => {
        // Martial Arts and Sneak Attack add dice rather than growing the die, so the ladder
        // overflows into extra dice at max size.
        it("adds a die instead of growing the size", () => {
            assert.equal(increaseDieType(`1d${MAX}`, 1), `2d${MAX}`);
        });

        it("adds one die per step past the top", () => {
            assert.equal(increaseDieType(`1d${MAX}`, 3), `4d${MAX}`);
        });

        it("keeps the dice a weapon already has", () => {
            assert.equal(increaseDieType(`3d${MAX}`, 1), `4d${MAX}`);
        });

        it("counts the steps that land beyond the top, not the whole bonus", () => {
            assert.equal(increaseDieType(`1d${stepUp(MAX, -1)}`, 2), `2d${MAX}`);
        });
    });

    describe("vehicle-scale multiplier suffix", () => {
        // Two thirds of the damage values in packs/_source carry an x2 or x5 suffix. Before the
        // suffix was split off the lookup failed and the whole expression collapsed to "0".
        it("preserves the suffix through a raise", () => {
            assert.equal(increaseDieType("4d10x2", 1), `4d${stepUp("10")}x2`);
        });

        it("preserves the suffix when overflowing into extra dice", () => {
            assert.equal(increaseDieType("4d10x2", 2), `5d${MAX}x2`);
        });

        it("handles an x5 suffix the same way", () => {
            assert.equal(increaseDieType("5d10x5", 1), `5d${stepUp("10")}x5`);
        });
    });

    describe("below the bottom of the ladder", () => {
        it("returns the quantity alone at the bottom", () => {
            assert.equal(increaseDieType("1d2", -1), "1");
        });

        it("clamps rather than running off the end", () => {
            assert.equal(increaseDieType("1d2", -2), "1");
        });
    });

    describe("input it cannot parse", () => {
        it("fails closed on a size that is not on the ladder", () => {
            assert.equal(increaseDieType("1d7", 1), "0");
        });

        it("fails closed on a value with no die at all", () => {
            assert.equal(increaseDieType("4", 1), "0");
        });

        it("never returns a formula containing undefined", () => {
            for (const die of ["1d2", "1d6", `1d${MAX}`, `4d${MAX}`, "4d10x2"]) {
                for (let bonus = -10; bonus <= 10; bonus++) {
                    assert.ok(
                        !increaseDieType(die, bonus).includes("undefined"),
                        `${die} with ${bonus} produced ${increaseDieType(die, bonus)}`
                    );
                }
            }
        });
    });
});
