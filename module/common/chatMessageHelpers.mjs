// itemFlavor defaults to "" rather than being left undefined: it is interpolated straight into
// the template below, so every three-argument caller (First Aid, macro rolls) was rendering the
// literal string "undefined" at the top of its chat card.
export function buildRollContent(formula, roll, notes = [], itemFlavor = "") {
    // data-action="expandRoll" and the .wrapper inside .dice-tooltip are both load-bearing, and
    // both were missing. Core collapses a roll breakdown with `grid-template-rows: 0fr` on
    // .dice-tooltip and relies on `.wrapper { overflow: hidden }` to clip it, then toggles an
    // `expanded` class from the element carrying data-action="expandRoll". Without the wrapper
    // the content simply overflowed the zero-height row, so every card in the system showed its
    // full dice breakdown permanently, and nothing responded to a click. Structure copied from
    // core's own templates/dice/roll.hbs and tooltip.hbs.
    return `<div class="message-content">
${itemFlavor}
        <div class="dice-roll" data-action="expandRoll">
            <div class="dice-result">
                <div class="dice-formula">${formula}</div>
                ${getTooltip(roll)}
                <h4 class="dice-total">${roll.total}</h4>
            </div>
        </div>
        <div>${notes.map(note => `<div>${note}</div>`).join("")}</div>
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
