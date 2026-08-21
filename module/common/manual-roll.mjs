import {applyRollMode} from "./util.mjs";

/**
 * Homebrew: not every player rolls in Foundry. Some roll physical dice at the table, some roll
 * in another app entirely, and they still need the sheet to do the rest of the work - apply
 * Exceptional Skill, read a force power's DC bands, hand healing to a target.
 *
 * A character can therefore be set to ask for the number its player rolled instead of rolling
 * itself. The switch lives on the actor (Settings tab, "Enter my own roll results"), not on the
 * user, because it follows the character: a physical-dice player's PC prompts even when the GM
 * opens it, and an NPC the GM rolls normally still rolls normally.
 *
 * @param actor {SWSEActor}
 * @returns {boolean}
 */
export function usesManualRollEntry(actor) {
    return !!actor?.system?.settings?.manualRollEntry;
}

/**
 * Produce an evaluated Roll for a formula, either by rolling it or - if this character is set to
 * manual roll entry - by asking its player what they rolled.
 *
 * Everything downstream (Exceptional Skill, force power DC bands, chat card rendering, Dice So
 * Nice) sees an ordinary evaluated Roll either way, which is the whole point: manual entry
 * changes where the number comes from, not what happens to it afterwards.
 *
 * @param baseFormula {string} the formula before any advantage/disadvantage rewrite
 * @param data {object} roll data the formula resolves @references against
 * @param options {object}
 * @param options.actor {SWSEActor} the character rolling, whose setting decides the behaviour
 * @param options.label {string} what is being rolled, used as the prompt's title
 * @param options.advantageMode {string} "advantage", "disadvantage", or undefined
 * @returns {Promise<Roll|null>} the evaluated roll, or null if the player cancelled the prompt
 */
export async function rollFormula(baseFormula, data, {actor, label = "", advantageMode} = {}) {
    if (!usesManualRollEntry(actor)) {
        return rollNormally(applyRollMode(baseFormula, advantageMode), data);
    }
    // Advantage/disadvantage is deliberately not applied here. The player rolled their own dice
    // and is telling us the single number they kept, so rewriting 1d20 into 2d20kh1 would ask
    // them to re-resolve something they already settled at the table.
    return promptForRollResult(baseFormula, data, label);
}

async function rollNormally(formula, data) {
    const roll = new Roll(formula, data);
    await roll.roll();
    return roll;
}

/**
 * Ask for the result, then build a Roll that reports it.
 *
 * Two ways in, because a player rolling away from Foundry may have either to hand:
 *  - the face on the die, which we substitute into the real Die term so the modifiers, the
 *    tooltip breakdown and the natural-roll homebrew all still work off it; or
 *  - a final total, when they only know "I got 24" - that becomes a flat roll, and nothing that
 *    keys off the die can fire, which is correct: there is no die result to key off.
 */
async function promptForRollResult(baseFormula, data, label) {
    // Evaluated privately, purely to learn the formula's shape - which die is rolled and what
    // the flat modifiers come to. This roll never reaches chat; it is either overwritten with
    // the entered face or discarded.
    const probe = new Roll(baseFormula, data);
    await probe.evaluate({allowInteractive: false});

    // A formula with no dice in it is a fixed value, not a roll - the Classes tab's "take the
    // average" button is exactly this. There is nothing the player could have rolled, so don't
    // ask them for it.
    const dice = probe.dice;
    if (!dice.length) return probe;

    // Only a single one-die term can take a face, because that is the only case where "the
    // number on the die" is unambiguous. Anything else (a pool, 2d6) gets the total field alone.
    const singleDie = (dice.length === 1 && dice[0].number === 1) ? dice[0] : null;
    const modifier = probe.total - dice.reduce((sum, die) => sum + die.total, 0);
    const signedModifier = modifier < 0 ? `${modifier}` : `+${modifier}`;

    const dieField = singleDie ? `
    <div class="medium labeled-input">
        <label class="text">d${singleDie.faces} result</label>
        <input class="input" type="number" name="die" min="1" max="${singleDie.faces}" autofocus/>
    </div>` : "";

    const content = `<fieldset>
    <legend>Your Roll</legend>
    <p class="notes">Rolling <code>${probe.formula}</code>, modifier <b>${signedModifier}</b>.</p>${dieField}
    <div class="medium labeled-input">
        <label class="text">Total${singleDie ? " instead" : ""}</label>
        <input class="input" type="number" name="total" ${singleDie ? "" : "autofocus"}/>
    </div>
    <p class="notes">${singleDie ? "Enter the number on the die and the modifier is added for you, or enter a finished total instead." : "Enter your finished total."}</p>
</fieldset>`;

    const entered = await Dialog.wait({
        title: label || "Enter Your Roll",
        content,
        buttons: {
            use: {
                label: "Use My Result",
                callback: (html) => ({
                    die: html.find('[name="die"]').val(),
                    total: html.find('[name="total"]').val()
                })
            },
            // The setting is per character, but a player who usually rolls physical dice still
            // rolls in Foundry sometimes. Without this they would have to go and turn the
            // setting off and back on again for one roll.
            roll: {label: "Roll in Foundry", callback: () => "roll"}
        },
        default: "use",
        close: () => null
    });

    if (!entered) return null;
    if (entered === "roll") return rollNormally(baseFormula, data);

    // A typed total wins outright - it is the more specific answer of the two. Both fields are
    // read defensively: number inputs can still hand back something unparseable, and a NaN would
    // silently poison the roll total rather than failing where anyone could see it.
    const typedTotal = readNumber(entered.total);
    if (typedTotal !== null) return markManual(await rollNormally(String(typedTotal), {}));

    const typedDie = readNumber(entered.die);
    if (singleDie && typedDie !== null) {
        const value = Math.clamp(typedDie, 1, singleDie.faces);
        // Same substitution the Exceptional Skill homebrew makes further down the roll pipeline:
        // replace the die's results and carry the difference onto the cached total, since an
        // evaluated Roll has no public way to recompute itself.
        const difference = value - singleDie.total;
        singleDie.results = [{result: value, active: true}];
        probe._total = probe._total + difference;
        return markManual(probe);
    }

    // Nothing entered in either field - treat it as "just roll it" rather than posting a zero.
    return rollNormally(baseFormula, data);
}

/**
 * @returns {number|null} a rounded number, or null if the field was blank or unparseable
 */
function readNumber(value) {
    if (value === "" || value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

/**
 * Flags a roll as reported rather than rolled, so the chat card can say so. Rolls carry their
 * options through serialisation, so this survives onto the message for anyone reading it back.
 */
function markManual(roll) {
    roll.options.manualEntry = true;
    return roll;
}

/**
 * @returns {string[]} a note for the chat card when the result was typed in, otherwise nothing
 */
export function manualRollNotes(roll) {
    return roll?.options?.manualEntry ? ["<i>Result entered by the player, not rolled in Foundry.</i>"] : [];
}

/**
 * The same disclosure as manualRollNotes, for the roll paths that post Foundry's own roll card
 * rather than one of ours and so have nowhere to put a note but the flavor line.
 *
 * @returns {string} a flavor suffix when the result was typed in, otherwise an empty string
 */
export function manualRollFlavor(roll) {
    return roll?.options?.manualEntry ? " (result entered by the player)" : "";
}
