import {diceText, modifierChips, naturalD20, summarizeRoll} from "./roll-summary.mjs";

function escapeHTML(text) {
    return `${text ?? ""}`.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// itemFlavor defaults to "" rather than being left undefined: it is interpolated straight into
// the template below, so every three-argument caller (First Aid, macro rolls) was rendering the
// literal string "undefined" at the top of its chat card.
//
// The check's name arrives as the message flavor, which Foundry draws above this content.
export function buildRollContent(formula, roll, notes = [], itemFlavor = "") {
    // data-action="expandRoll" and the .wrapper inside .dice-tooltip are both load-bearing, and
    // both were missing. Core collapses a roll breakdown with `grid-template-rows: 0fr` on
    // .dice-tooltip and relies on `.wrapper { overflow: hidden }` to clip it, then toggles an
    // `expanded` class from the element carrying data-action="expandRoll". Without the wrapper
    // the content simply overflowed the zero-height row, so every card in the system showed its
    // full dice breakdown permanently, and nothing responded to a click. Structure copied from
    // core's own templates/dice/roll.hbs and tooltip.hbs.
    const summary = summarizeRoll(roll);
    const natural = naturalD20(summary);
    const totalClass = natural === 20 ? " is-critical" : natural === 1 ? " is-fail" : "";
    const beside = natural !== undefined
        ? `<span class="swse-natural${totalClass}">${natural === 20 || natural === 1 ? "Nat" : "d20 &middot;"} ${natural}</span>`
        : `<span class="swse-roll-dice">${escapeHTML(summary.complex ? formula : diceText(summary))}</span>`;
    const chips = summary.complex ? [] : modifierChips(summary);
    return `<div class="swse-card swse-check">
${itemFlavor}
        <div class="dice-roll swse-roll" data-action="expandRoll">
            <div class="dice-result">
                <h4 class="dice-total swse-roll-total${totalClass}">${roll.total}</h4>
                ${beside}
                ${getTooltip(roll)}
            </div>
        </div>
        ${chips.length ? `<div class="swse-chips">${chips.map(chip => `<span class="swse-chip${chip.negative ? " is-negative" : ""}">${escapeHTML(chip.text)}</span>`).join("")}</div>` : ""}
        ${notes.length ? `<div class="swse-card-notes">${notes.map(note => `<div>${note}</div>`).join("")}</div>` : ""}
    </div>`
}

/**
 * One applied result: who, by how much (negative is damage, positive healing) and why.
 */
export function resultLineContent(name, change, detail = "") {
    const amount = Number(change) || 0;
    const kind = amount < 0 ? "is-damage" : amount > 0 ? "is-heal" : "is-zero";
    const text = amount < 0 ? `−${Math.abs(amount)}` : amount > 0 ? `+${amount}` : "0";
    return `<div class="swse-card swse-result ${kind}">
        <span class="swse-result-amount">${text}</span>
        <div class="swse-result-body">
            <span class="swse-result-name">${escapeHTML(name)}</span>
            ${detail ? `<span class="swse-result-detail">${escapeHTML(detail)}</span>` : ""}
        </div>
    </div>`
}

function getTooltip(roll) {
    let sections = [];

    for (let term of roll.terms) {
        if (!(term instanceof foundry.dice.terms.Die)) continue;

        // The die classes were hardcoded to "die d20", so a d8 hit die styled itself as a d20 and
        // a dropped die from an advantage roll looked identical to the one that counted.
        const rolls = term.results.map(result => {
            const classes = ["roll", "die", `d${term.faces}`];
            if (result.discarded || result.rerolled) classes.push("discarded");
            else if (result.result === term.faces) classes.push("max");
            else if (result.result === 1) classes.push("min");
            return `<li class="${classes.join(" ")}">${result.result}</li>`;
        }).join("");

        const partFormula = `<span class="part-formula">${term.number}d${term.faces}</span>`
        const partTotal = `<span class="part-total">${term.total}</span>`
        const partHeader = `<header class="part-header flexrow">${partFormula}${partTotal}</header>`

        sections.push(`<section class="tooltip-part"><div class="dice">${partHeader}<ol class="dice-rolls">${rolls}</ol></div></section>`)
    }

    if (!sections.length) return "";
    return `<div class="dice-tooltip"><div class="wrapper">${sections.join("")}</div></div>`;
}
